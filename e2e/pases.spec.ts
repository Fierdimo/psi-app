import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Los pases de acceso, en manos de la empresa.
 *
 * Cubre el caso que no se ve desde la base: que la pantalla de una sesión ya
 * confirmada —que antes era un callejón, «esto ya no se edita»— ofrezca lo
 * único que la empresa puede hacer en ese momento, y que el enlace de quien
 * todavía no tiene cuenta funcione de verdad al abrirlo.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const ORGANIZACION = "77777777-7777-7777-7777-777777777777";

let citaId = "";

test.describe.serial("Pases de acceso", () => {
  test.beforeAll(async () => {
    const db = admin();

    /*
     * Una sesión propia y confirmada, montada aquí y desmontada al final.
     *
     * Usar la que trae la semilla ensuciaría las demás pruebas: confirmar o
     * emitir sobre ella cambia su estado y el siguiente que la mire ve otra
     * cosa. Ya pasó antes y el fallo aparecía en un archivo distinto del que
     * lo causaba.
     */
    const { data: persona } = await db
      .from("organization_people")
      .insert({
        organization_id: ORGANIZACION,
        documento: "PASE-0001",
        nombre: "Sin",
        apellidos: "Cuenta",
        email: "sin-cuenta@caribe.test",
        cargo: "Operaria",
        vinculo: "aspirante" as const,
      })
      .select("id")
      .single();

    const [{ data: profesional }, { data: jefe }] = await Promise.all([
      db.from("profiles").select("id").eq("role", "profesional").single(),
      db
        .from("profiles")
        .select("id")
        .eq("organization_id", ORGANIZACION)
        .single(),
    ]);

    /*
     * Una hora rara y lejana, a propósito.
     *
     * La agenda tiene una exclusión que impide dos sesiones confirmadas
     * solapadas para el mismo profesional. Cayendo sobre lo que ya trae la
     * semilla, el insert falla y el error que se ve es «cita es null» tres
     * líneas más abajo, que no dice nada.
     */
    const inicio = new Date(Date.now() + 40 * 24 * 3600 * 1000);
    inicio.setUTCHours(5, 30, 0, 0);
    const fin = new Date(inicio.getTime() + 2 * 3600 * 1000);

    const { data: cita, error } = await db
      .from("appointments")
      .insert({
        organization_id: ORGANIZACION,
        professional_id: profesional!.id,
        created_by: jefe!.id,
        starts_at: inicio.toISOString(),
        ends_at: fin.toISOString(),
        status: "confirmada" as const,
        modality: "presencial" as const,
        location: "Consultorio",
      })
      .select("id")
      .single();

    if (error) throw new Error(`no se pudo montar la sesión: ${error.message}`);
    citaId = cita!.id;

    await db
      .from("appointment_attendees")
      .insert({ appointment_id: citaId, person_id: persona!.id });
  });

  test.afterAll(async () => {
    const db = admin();
    await db.from("appointments").delete().eq("id", citaId);
    await db.from("organization_people").delete().eq("documento", "PASE-0001");
  });

  /*
   * Se llega desde el listado, no escribiendo la dirección.
   *
   * La tarjeta solo enlazaba mientras la sesión era una solicitud —para
   * editarla—, así que una vez confirmada la pantalla de los pases existía y
   * no había forma de entrar en ella. Esta prueba es el camino que hace la
   * empresa de verdad.
   */
  test("desde el listado se llega a los pases", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/sesiones");

    await page
      .getByRole("link", { name: /repartir accesos/i })
      .first()
      .click();

    await expect(
      page.getByRole("button", { name: /generar pases de acceso/i }),
    ).toBeVisible();
  });

  test("la empresa saca el pase de cada convocado", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto(`/empresa/sesiones/${citaId}`);

    // La pantalla de una sesión confirmada ya no es solo un aviso.
    await page
      .getByRole("button", { name: /generar pases de acceso/i })
      .click();

    const fila = page.getByRole("listitem").filter({ hasText: "Sin Cuenta" });
    await expect(fila).toBeVisible();

    // El QR se dibuja en el navegador: si la librería fallara, el botón
    // quedaría pulsado y no aparecería nada.
    await fila.getByRole("button", { name: /ver qr/i }).click();
    await expect(fila.getByRole("img", { name: /código qr/i })).toBeVisible();
  });

  /*
   * La imagen, que es como se reparte de verdad.
   *
   * Por WhatsApp o por correo se pega una imagen; un enlace de sesenta
   * caracteres se corta al copiarlo o llega convertido en texto muerto. Se
   * comprueba que el PNG se genera y que lleva el nombre escrito, porque un QR
   * suelto es indistinguible de otro.
   */
  test("el QR se copia y se descarga como imagen", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await entrarComo(page, CUENTAS.empresa);
    await page.goto(`/empresa/sesiones/${citaId}`);
    await page
      .getByRole("button", { name: /generar pases de acceso/i })
      .click();

    const fila = page.getByRole("listitem").filter({ hasText: "Sin Cuenta" });
    await fila.getByRole("button", { name: /ver qr/i }).click();

    /*
     * Copiar va PRIMERO, y no da igual el orden.
     *
     * Descargar abre el diálogo del navegador y el documento pierde el foco;
     * después, leer el portapapeles devuelve vacío aunque la copia haya
     * funcionado. La prueba fallaba por eso y señalaba a la copia, que estaba
     * bien.
     */
    await fila.getByRole("button", { name: /copiar imagen/i }).click();
    await expect(fila.getByText("Copiada")).toBeVisible();

    const tipo = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      return item?.types.join(",") ?? "";
    });
    expect(tipo).toContain("image/png");

    const descarga = page.waitForEvent("download");
    await fila.getByRole("button", { name: /descargar/i }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^pase-sin-cuenta\.png$/);
  });

  test("el enlace que reparte lleva a la invitación", async ({
    page,
    context,
  }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto(`/empresa/sesiones/${citaId}`);
    await page
      .getByRole("button", { name: /generar pases de acceso/i })
      .click();

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const fila = page.getByRole("listitem").filter({ hasText: "Sin Cuenta" });
    await fila.getByRole("button", { name: /copiar enlace/i }).click();

    const enlace = await page.evaluate(() => navigator.clipboard.readText());
    expect(enlace).toContain("/invitacion/");

    /*
     * Lo que importa: que el enlace copiado ABRA algo.
     *
     * Un pase que se copia bien pero cae en «enlace no válido» es peor que no
     * tenerlo, porque se reparte a cincuenta personas antes de descubrirlo.
     */
    await page.goto(enlace);
    await expect(page.getByText(/enlace no válido|no es válida/i)).toHaveCount(
      0,
    );
  });
});
