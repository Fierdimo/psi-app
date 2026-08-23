import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * El circuito nuevo, de punta a punta.
 *
 * Una empresa pide usos, el profesional los autoriza tras comprobar un pago
 * que ocurre fuera de la plataforma, y con ese saldo la empresa encarga una
 * evaluación: se descuenta un uso, se guardan los datos de quien responde y le
 * sale un correo con su enlace y su QR.
 *
 * Sustituye a media suite de citas. Lo que prueba no es cada pantalla por
 * separado —eso ya lo cubren las pruebas de SQL— sino que las piezas encajan:
 * el saldo que sube en una pantalla es el que baja en otra, y el enlace que
 * genera la base es el que abre la prueba sin sesión.
 */

const ORGANIZACION = "77777777-7777-7777-7777-777777777777";
const MAILPIT = "http://127.0.0.1:54324";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * El saldo, sumando el libro.
 *
 * No se usa `saldo_de_usos` a propósito: esa función exige ser la empresa
 * dueña o el profesional, y la clave de servicio no es ninguna de las dos —se
 * comprobó aquí, respondiendo «Ese saldo no es tuyo.»—. Que se niegue está
 * bien; lo que no vale es rodearlo dándole permisos de más a las pruebas.
 */
async function saldoDe(organizacion: string) {
  const { data } = await admin()
    .from("ticket_ledger")
    .select("cantidad")
    .eq("organization_id", organizacion);

  return (data ?? []).reduce((suma, m) => suma + m.cantidad, 0);
}

test.describe.serial("Usos y evaluaciones encargadas", () => {
  test.beforeAll(async () => {
    /*
     * Punto de partida sin saldo ni solicitudes.
     *
     * El libro se borra en orden inverso al de sus referencias: los
     * movimientos apuntan a las órdenes con `on delete restrict`, así que
     * borrar primero las órdenes falla — y falla bien, que es el punto de esa
     * restricción.
     */
    const db = admin();
    await db.from("ticket_ledger").delete().eq("organization_id", ORGANIZACION);
    await db.from("ticket_orders").delete().eq("organization_id", ORGANIZACION);
  });

  /*
   * Cada papel, su prueba.
   *
   * Encadenar los dos inicios de sesión en una sola no funciona y el fallo es
   * silencioso: con la sesión de empresa viva, `/profesional` no enseña el
   * formulario de entrada, redirige. Cada `test` estrena contexto y con él
   * cookies limpias, que es lo que hace falta para cambiar de papel.
   */
  test("la empresa pide usos, y pedir no carga saldo", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/usos");

    await expect(page.getByText("usos disponibles")).toBeVisible();

    await page.getByLabel("Cuántos usos").fill("3");
    await page.getByLabel(/Referencia/).fill("Cotización de prueba");
    await page.getByRole("button", { name: /solicitar usos/i }).click();

    /*
     * El acuse de recibo es el aviso de «hay una pendiente».
     *
     * La acción revalida, así que la pantalla vuelve sin formulario: el
     * mensaje de éxito del formulario no llega a verse nunca, y ese texto es
     * el que confirma el envío.
     */
    await expect(
      page.getByText("Tu solicitud está esperando respuesta"),
    ).toBeVisible();
    await expect(page.getByText("Cotización de prueba")).toBeVisible();

    // Sin autorizar no hay saldo: pedir no carga nada.
    expect(await saldoDe(ORGANIZACION)).toBe(0);
  });

  test("el profesional autoriza y el saldo entra", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/solicitudes");

    await expect(page.getByText("Cotización de prueba")).toBeVisible();

    await page.getByRole("button", { name: /^autorizar$/i }).click();
    await page
      .getByLabel(/Referencia del pago/)
      .fill("transferencia de prueba 001");
    // El de dentro del diálogo, que es el que envía el formulario.
    await page
      .getByRole("button", { name: /^autorizar$/i })
      .last()
      .click();

    await expect.poll(() => saldoDe(ORGANIZACION)).toBe(3);
  });

  /*
   * SE PULSA EL BOTÓN, no se navega con `goto`.
   *
   * Es la prueba que faltaba y que dejó pasar un fallo real: el formulario se
   * abría escribiendo la dirección, pero pulsar el botón cambiaba la
   * dirección y no pasaba nada en pantalla. La intercepción de rutas hacía
   * encajar «nueva» en `[id]`, se tragaba la navegación y dejaba el hueco del
   * panel vacío. Todas las pruebas usaban `goto` y ninguna lo vio.
   *
   * Desde los dos sitios donde vive la acción, porque son dos rutas distintas
   * hacia la misma pantalla.
   */
  test("el botón de encargar abre el formulario, desde el listado y desde el inicio", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.empresa);

    await page.goto("/empresa/evaluaciones");
    await page.getByRole("link", { name: /encargar una evaluación/i }).click();

    await expect(page).toHaveURL(/\/empresa\/evaluaciones\/nueva/);
    await expect(
      page.getByRole("dialog").getByLabel("Nombre", { exact: true }),
    ).toBeVisible({ timeout: 20000 });

    // Y el listado sigue detrás: cerrar devuelve a donde se estaba.
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("table")).toBeVisible();

    await page.goto("/empresa");
    await page.getByRole("link", { name: /encargar una evaluación/i }).click();

    await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible({
      timeout: 20000,
    });
  });

  test("encargar una evaluación gasta un uso y manda el enlace", async ({
    page,
  }) => {
    const marca = Date.now();
    const correo = `candidata-${marca}@caribe.test`;

    await entrarComo(page, CUENTAS.empresa);

    /*
     * Se llega pulsando, que es el camino real.
     *
     * Con `goto` se pintaba la página completa y quedaba sin probar el envío
     * DESDE EL MODAL, que es por donde pasa todo el mundo. Ahí el formulario
     * vive en un hueco interceptado y la redirección de la acción tiene que
     * cambiarlo por la ficha de la evaluación recién creada.
     */
    await page.goto("/empresa/evaluaciones");
    await page.getByRole("link", { name: /encargar una evaluación/i }).click();

    const formulario = page.getByRole("dialog");
    await expect(formulario.getByLabel("Nombre", { exact: true })).toBeVisible({
      timeout: 20000,
    });

    await page.getByLabel("Nombre", { exact: true }).fill("Candidata");
    await page.getByLabel(/Apellidos/).fill("De Prueba");
    await page.getByLabel(/^Correo/).fill(correo);
    await page.getByRole("button", { name: /encargar y enviar/i }).click();

    // Se aterriza en la ficha, con el enlace a la vista aunque el correo
    // hubiera fallado.
    await page.waitForURL(/\/empresa\/evaluaciones\/[0-9a-f-]{36}/);
    await expect(page.getByText("Evaluación encargada")).toBeVisible();

    expect(await saldoDe(ORGANIZACION)).toBe(2);

    /*
     * El correo, de verdad.
     *
     * Es la parte que ninguna prueba de SQL puede cubrir y donde el QR podría
     * romperse en silencio: va como adjunto en línea porque los clientes de
     * correo bloquean las imágenes en base64 dentro del `src`.
     */
    const mensaje = await expect
      .poll(
        async () => {
          const r = await fetch(
            `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`,
          );
          const cuerpo = await r.json();
          return cuerpo.messages?.[0] ?? null;
        },
        { timeout: 15_000 },
      )
      .not.toBeNull()
      .then(async () => {
        const r = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`,
        );
        return (await r.json()).messages[0];
      });

    const detalle = await fetch(`${MAILPIT}/api/v1/message/${mensaje.ID}`).then(
      (r) => r.json(),
    );

    expect(detalle.Subject).toContain("Tu evaluación");
    expect(detalle.HTML).toContain("cid:qr-evaluacion");
    // El QR viaja como adjunto, no como texto dentro del HTML.
    expect(
      detalle.Inline?.length ?? detalle.Attachments?.length,
    ).toBeGreaterThan(0);
  });

  test("el enlace abre la evaluación sin ninguna sesión", async ({
    browser,
  }) => {
    const db = admin();

    const { data: fila } = await db
      .from("organization_people")
      .select("id")
      .eq("organization_id", ORGANIZACION)
      .like("email", "candidata-%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: invitacion } = await db
      .from("invitations")
      .select("token")
      .eq("person_id", fila!.id)
      .maybeSingle();

    // Contexto limpio: sin cookies, que es como llega quien responde.
    const contexto = await browser.newContext();
    const page = await contexto.newPage();

    await page.goto(`/prueba/${invitacion!.token}`);

    // Lo primero que ve es el consentimiento, no la prueba.
    await expect(
      page.getByRole("heading", { name: /Perfil DISC/i }),
    ).toBeVisible();
    await expect(page.getByText(/consentimiento/i).first()).toBeVisible();

    await contexto.close();
  });

  test("sin saldo no se puede encargar", async ({ page }) => {
    const db = admin();
    await db.from("ticket_ledger").delete().eq("organization_id", ORGANIZACION);

    await entrarComo(page, CUENTAS.empresa);

    /*
     * El botón SIGUE ESTANDO en el inicio sin saldo.
     *
     * Esconderlo dejaría a quien entra sin usos sin descubrir dónde vive lo
     * único que ha venido a hacer. Lo que cambia es lo que encuentra al
     * pulsarlo: una explicación y el camino para resolverlo, no un formulario
     * que va a fallar al final.
     */
    await page.goto("/empresa");
    await page.getByRole("link", { name: /encargar una evaluación/i }).click();

    await expect(page.getByText("No te quedan usos")).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.getByRole("link", { name: /ir a solicitar usos/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /encargar y enviar/i }),
    ).toHaveCount(0);
  });
});
