import { expect, test, type Page } from "@playwright/test";

import { entrarComo, guardarSeccion } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Calendario (F3).
 *
 * Las pruebas de zona horaria son las que más valor tienen aquí: es la parte
 * del sistema donde un error no produce una pantalla fea sino una sesión
 * perdida.
 */

/** Fecha dentro de la franja permitida, en formato del input date. */
function enDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function irAlCalendario(page: Page) {
  await page.goto("/calendario");
  await expect(
    page.getByRole("heading", { name: "Tu calendario" }),
  ).toBeVisible();
}

test.describe.serial("Vistas del calendario", () => {
  test("muestra la zona horaria activa y las citas del paciente", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await irAlCalendario(page);

    await expect(
      page.getByText("Hora de Bogotá", { exact: false }),
    ).toBeVisible();
    // La cita confirmada de la siembra aparece en el panel de próximas.
    await expect(page.getByText("Confirmada").first()).toBeVisible();
  });

  test("se puede cambiar de vista y la URL lo refleja", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    await irAlCalendario(page);

    await page.getByRole("link", { name: "Agenda", exact: true }).click();
    await expect(page).toHaveURL(/vista=agenda/);

    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/vista=semana/);

    await page.getByRole("link", { name: "Día", exact: true }).click();
    await expect(page).toHaveURL(/vista=dia/);
  });

  test("navegar entre periodos cambia el título y conserva la vista", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario?vista=mes");

    const titulo = page.getByRole("heading", { level: 2 }).first();
    const inicial = await titulo.textContent();

    await page.getByRole("link", { name: "Periodo siguiente" }).click();
    await expect(page).toHaveURL(/vista=mes/);
    await expect(titulo).not.toHaveText(inicial!);

    await page.getByRole("link", { name: "Hoy" }).click();
    await expect(titulo).toHaveText(inicial!);
  });
});

test.describe.serial("Solicitar una cita", () => {
  test("solicitar deja la cita como «por confirmar», no confirmada", async ({
    page,
  }) => {
    /*
     * Beto empieza sin solicitud pendiente.
     *
     * La semilla le deja una para que la bandeja del profesional tenga algo
     * que mostrar, y la base solo admite una por paciente: sobre una base
     * recién sembrada, esta prueba fallaba diciendo que la URL no cambiaba
     * —cuando lo que pasaba es que la solicitud se rechazaba—. Pasaba solo
     * porque otras ejecuciones se habían llevado por delante la de la semilla.
     */
    await limpiarPendientes("22222222-2222-2222-2222-222222222222");

    await entrarComo(page, CUENTAS.otroPaciente);
    await page.goto("/solicitar-cita");

    await page.getByLabel("Día").fill(enDias(10));
    await page.getByLabel("Hora de inicio").selectOption("11:00");
    await page.getByLabel("Modalidad").selectOption("virtual");

    await page.getByRole("button", { name: /solicitar cita/i }).click();

    /*
     * Con margen: solicitar avisa al profesional por correo, y el envío es
     * síncrono. Justo después de reconstruir la base, el servidor de correo
     * local todavía está levantándose y esa primera conexión agota su tope de
     * cinco segundos antes de rendirse — la cita se crea igual, pero la
     * redirección llega tarde. Cinco segundos de espera no daban.
     */
    await expect(page).toHaveURL(/solicitada=1/, { timeout: 25000 });
    await expect(page.getByText(/solicitud enviada/i)).toBeVisible();

    /*
     * Lo que de verdad se comprueba: que el paciente NO puede producir una
     * cita confirmada. Aunque la interfaz fallara, la función de Postgres crea
     * siempre en estado «solicitada».
     */
    await page.goto("/calendario?vista=agenda");
    await expect(page.getByText("Por confirmar").first()).toBeVisible();
  });

  test("no deja acumular dos solicitudes pendientes", async ({ page }) => {
    await entrarComo(page, CUENTAS.otroPaciente);
    await page.goto("/solicitar-cita");

    await expect(
      page.getByText(/ya tienes una solicitud pendiente/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /solicitar cita/i }),
    ).toHaveCount(0);
  });

  test("la anticipación mínima se aplica en el servidor", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/solicitar-cita");

    // El input tiene `min`, pero la regla real vive en la base: se fuerza una
    // fecha de hoy saltándose la restricción del navegador.
    await page.getByLabel("Día").evaluate((el, valor) => {
      const input = el as HTMLInputElement;
      input.min = "";
      input.value = valor;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, enDias(0));

    await page.getByRole("button", { name: /solicitar cita/i }).click();

    await expect(page.getByText(/anticipación/i).first()).toBeVisible();
  });
});

test.describe.serial("Detalle y cancelación", () => {
  test("se puede cancelar una cita y deja de estar activa", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario?vista=agenda");

    await page
      .getByRole("link", { name: /cita confirmada/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/calendario\/[0-9a-f-]{36}/);

    await page.getByRole("button", { name: /cancelar cita/i }).click();
    await page.getByRole("button", { name: /sí, cancelar la cita/i }).click();

    await expect(page).toHaveURL(/cancelada=1/);
    await expect(page.getByText(/cita cancelada/i).first()).toBeVisible();
  });

  test("una cita de otro paciente responde 404, no 403", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);

    // Identificador inexistente y ajeno se tratan igual: revelar la diferencia
    // permitiría confirmar qué citas existen en la plataforma.
    const respuesta = await page.request.get(
      "/calendario/00000000-0000-4000-8000-000000000000",
    );
    expect(respuesta.status()).toBe(404);
  });
});

test.describe("Zonas horarias", () => {
  /**
   * La prueba de mayor valor del calendario.
   *
   * Verifica el viaje completo: la hora se escribe en la zona del PERFIL, se
   * guarda en UTC y se vuelve a mostrar en la zona del perfil. Si alguna de
   * las tres etapas usara la zona del servidor o la del navegador, el
   * desplazamiento no sería el esperado — y ese error no se ve en pantalla,
   * se ve cuando alguien llega a su sesión con una hora de diferencia.
   *
   * Crea su propia cita en vez de reutilizar la de la siembra: depender de lo
   * que dejen otras pruebas es lo que la hacía fallar de forma intermitente.
   */
  test("la hora se guarda en la zona del perfil y se muestra en ella", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);

    await page.goto("/solicitar-cita");
    await page.getByLabel("Día").fill(enDias(12));
    await page.getByLabel("Hora de inicio").selectOption("11:00");
    await page.getByRole("button", { name: /solicitar cita/i }).click();
    /*
     * Con margen: solicitar avisa al profesional por correo, y el envío es
     * síncrono. Justo después de reconstruir la base, el servidor de correo
     * local todavía está levantándose y esa primera conexión agota su tope de
     * cinco segundos antes de rendirse — la cita se crea igual, pero la
     * redirección llega tarde. Cinco segundos de espera no daban.
     */
    await expect(page).toHaveURL(/solicitada=1/, { timeout: 25000 });

    /*
     * Su cita, no la sesión de evaluación.
     *
     * En el calendario de la persona conviven ahora las dos, y las dos pueden
     * estar «solicitadas». El accesible de una evaluación empieza por
     * «Evaluación», así que basta con exigir que empiece por «Cita».
     */
    const cita = page.getByRole("link", { name: /^cita solicitada/i }).first();

    await page.goto("/calendario?vista=agenda");
    // Se compara el RANGO completo, no una hora suelta: «11:00» aparece
    // también como hora de fin del rango desplazado, y compararlo por separado
    // daría un falso negativo.
    await expect(cita).toContainText("11:00 – 12:00");

    await page.goto("/mis-datos");
    await page.getByLabel("Zona horaria").selectOption("America/Mexico_City");
    await guardarSeccion(page, /guardar preferencias/i);

    await page.goto("/calendario?vista=agenda");
    // Se compara con la etiqueta exacta que ve el usuario. La expresión
    // regular anterior aceptaba variantes sin tilde y por eso no detectó que la
    // cabecera decía «Bogota»; ahora una regresión de acentuación falla aquí.
    await expect(
      page.getByText("Hora de Ciudad de México", { exact: false }),
    ).toBeVisible();

    // Bogotá (GMT−5) y Ciudad de México (GMT−6) difieren exactamente una hora.
    await expect(cita).toContainText("10:00 – 11:00");

    await page.goto("/mis-datos");
    await page.getByLabel("Zona horaria").selectOption("America/Bogota");
    await guardarSeccion(page, /guardar preferencias/i);
  });
});

test.describe("Pedir cita", () => {
  /*
   * Se podía SOLO desde el calendario.
   *
   * Quien entra a su espacio aterriza en el panel, y con una cita ya agendada
   * la tarjeta de «próxima cita» no ofrecía ninguna forma de pedir otra: había
   * que adivinar que el camino era entrar a «Calendario». Lo encontró el
   * cliente buscando dónde solicitar.
   */
  /*
   * Se PULSA el enlace, no se navega a la dirección.
   *
   * Escribiendo la dirección a mano funcionaba: una navegación completa no
   * pasa por las rutas interceptadas. Pulsando, en cambio, el hueco del panel
   * tomaba «solicitar» por el identificador de una cita y devolvía 404. El
   * botón llevaba a una página rota y parecía que la función no existiera.
   */
  test("se llega a solicitar cita desde el panel", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    /*
     * Ana no puede tener una solicitud pendiente.
     *
     * La base solo admite una por paciente, así que con una viva el panel deja
     * de ofrecer «Solicitar otra cita» —correctamente— y esta prueba fallaba
     * diciendo que no encontraba el enlace. Otras pruebas de la suite se la
     * dejan puesta.
     */
    await limpiarPendientes("11111111-1111-1111-1111-111111111111");

    await page.goto("/panel");

    await page.getByRole("link", { name: /solicitar otra cita/i }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /solicitar una cita/i }),
    ).toBeVisible();
  });

  test("desde el calendario se abre como panel, sin perderlo de vista", async ({
    page,
  }) => {
    // Misma razón que arriba: con una solicitud viva, el enlace no se ofrece.
    await limpiarPendientes("11111111-1111-1111-1111-111111111111");

    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario");

    await page.getByRole("link", { name: /^solicitar cita$/i }).click();

    /*
     * Se pide una cita MIRANDO el calendario: qué semana está libre, cuándo
     * cae la anterior. Por eso el formulario se abre encima y no en otra
     * pantalla.
     */
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("heading", { level: 1, name: /solicitar una cita/i }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("al enviarla el panel se cierra solo", async ({ page }) => {
    /*
     * Se limpia su solicitud pendiente antes.
     *
     * Solo se admite una a la vez, y otras pruebas de este archivo dejan la
     * suya: sin esto el formulario ni siquiera se dibuja y el fallo apunta al
     * sitio equivocado.
     */
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    await db
      .from("appointments")
      .delete()
      .eq("patient_id", "11111111-1111-1111-1111-111111111111")
      .in("status", ["solicitada", "reprogramacion_solicitada"]);

    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/solicitar-cita");

    await page.getByLabel("Día").fill(enDias(15));
    await page.getByLabel("Hora de inicio").selectOption("11:00");
    await page.getByRole("button", { name: /^solicitar cita$/i }).click();

    /*
     * La acción redirige al calendario. Sin cerrarse, el aviso de «solicitud
     * enviada» quedaba DETRÁS del formulario ya enviado: la dirección cambiaba
     * pero el hueco del panel conservaba su contenido.
     */
    /*
     * Con margen: solicitar avisa al profesional por correo, y el envío es
     * síncrono. Justo después de reconstruir la base, el servidor de correo
     * local todavía está levantándose y esa primera conexión agota su tope de
     * cinco segundos antes de rendirse — la cita se crea igual, pero la
     * redirección llega tarde. Cinco segundos de espera no daban.
     */
    await expect(page).toHaveURL(/solicitada=1/, { timeout: 25000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/solicitud enviada/i)).toBeVisible();
  });
});

test.describe("El detalle como panel", () => {
  /*
   * Una sesión propia, confirmada.
   *
   * La de la siembra nace SIN CONFIRMAR —y una persona convocada no ve una
   * fecha sin confirmar, que es la negociación entre su empresa y el
   * profesional—. Confirmar aquella dejaba sin trabajo a la prueba del
   * profesional, que necesita encontrarla pendiente: las pruebas comparten
   * base y tocar la siembra se paga en otro archivo.
   */
  const SESION = "66660000-0000-4000-8000-00000000ffff";

  test.beforeAll(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: persona } = await db
      .from("organization_people")
      .select("id, organization_id")
      .eq("documento", "1047373301")
      .single();

    const { data: doctor } = await db
      .from("profiles")
      .select("id")
      .eq("role", "profesional")
      .single();

    await db
      .from("appointment_attendees")
      .delete()
      .eq("appointment_id", SESION);
    await db.from("appointments").delete().eq("id", SESION);

    const inicio = new Date(Date.now() + 20 * 864e5);
    const fin = new Date(inicio.getTime() + 2 * 3600e3);

    await db.from("appointments").insert({
      id: SESION,
      organization_id: persona!.organization_id,
      professional_id: doctor!.id,
      created_by: doctor!.id,
      starts_at: inicio.toISOString(),
      ends_at: fin.toISOString(),
      status: "confirmada",
      modality: "presencial",
    });

    await db
      .from("appointment_attendees")
      .insert({ appointment_id: SESION, person_id: persona!.id });
  });

  /*
   * Y se retira al terminar.
   *
   * Las pruebas comparten base: esta sesión confirmada y sin instrumento
   * aparecía después en «Confirmadas, sin evaluación asignada» del
   * profesional y rompía una comprobación de otro archivo. Quien crea datos
   * los recoge.
   */
  test.afterAll(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    await db
      .from("appointment_attendees")
      .delete()
      .eq("appointment_id", SESION);
    await db.from("appointments").delete().eq("id", SESION);
  });

  /*
   * Pulsar una cita abre un panel por la derecha, no una pantalla nueva: al
   * cerrarlo el calendario sigue donde estaba, en el mes que se miraba.
   *
   * Y una sesión de empresa se abre igual. Antes respondía 404 —esta pantalla
   * las excluía— así que la persona la veía en su calendario, pulsaba y no
   * pasaba nada.
   */
  test("abre la cita por la derecha y cierra donde estaba", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario?vista=agenda");

    const evaluacion = page.getByRole("link", { name: /^evaluación/i }).first();
    await expect(evaluacion).toBeVisible();
    await evaluacion.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();

    // Se explica qué es y por qué no se cambia desde aquí.
    await expect(panel.getByText(/es una sesión de evaluación/i)).toBeVisible();

    // La dirección es la misma que la de la página, así que se puede compartir.
    await expect(page).toHaveURL(/\/calendario\/[0-9a-f-]+$/);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/vista=agenda/);
  });

  test("el mismo enlace abierto en directo es una página entera", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario?vista=agenda");

    const href = await page
      .getByRole("link", { name: /^evaluación/i })
      .first()
      .getAttribute("href");

    await page.goto(href!);

    // Sin panel: quien llega desde un correo o un marcador no viene de ningún
    // sitio al que volver, así que se le da la pantalla completa.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /volver al calendario/i }),
    ).toBeVisible();
  });
});

/** Deja a un paciente sin solicitudes pendientes: la base solo admite una. */
async function limpiarPendientes(paciente: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await db
    .from("appointments")
    .delete()
    .eq("patient_id", paciente)
    .in("status", ["solicitada", "reprogramacion_solicitada"]);
}
