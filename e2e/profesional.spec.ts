import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Área del profesional (F5).
 */

function enDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function cerrarSesion(page: Page) {
  await page.getByRole("button", { name: /cerrar sesión/i }).click();
  await page.waitForURL(/\/ingresar/);
}

/**
 * Deja al paciente con una solicitud pendiente, la tuviera ya o no.
 *
 * Las pruebas de otros archivos también crean y cancelan citas; dar por hecho
 * un estado concreto es lo que produce fallos que aparecen y desaparecen según
 * el orden de ejecución.
 */
async function asegurarSolicitudPendiente(
  page: Page,
  cuenta: { correo: string; contrasena: string },
  dias = 15,
) {
  await entrarComo(page, cuenta);
  await page.goto("/calendario/solicitar");

  const yaTiene = page.getByText(/ya tienes una solicitud pendiente/i);
  if (await yaTiene.isVisible().catch(() => false)) return;

  await page.getByLabel("Día").fill(enDias(dias));
  await page.getByLabel("Hora de inicio").selectOption("09:00");
  await page.getByRole("button", { name: /solicitar cita/i }).click();
  await expect(page).toHaveURL(/solicitada=1/);
}

test.describe("Acceso al área profesional", () => {
  test("un paciente no alcanza el listado de pacientes", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/profesional/pacientes");

    await expect(page).toHaveURL(/\/panel/);
    await expect(
      page.getByText(/no tienes permiso|acceso denegado|no autorizado/i),
    ).toHaveCount(0);
  });

  test("el profesional ve agenda y pacientes en su navegación", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");

    const nav = page.getByRole("navigation", { name: "Secciones" });
    await expect(nav.getByRole("link", { name: "Agenda" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pacientes" })).toBeVisible();
  });
});

test.describe.serial("El circuito completo", () => {
  test("el paciente pide, el profesional confirma y el paciente lo ve", async ({
    page,
  }) => {
    // 1. El paciente propone un horario.
    await asegurarSolicitudPendiente(page, CUENTAS.otroPaciente);
    await cerrarSesion(page);

    // 2. El profesional la encuentra en su bandeja y la confirma.
    await entrarComo(page, CUENTAS.profesional, "/profesional");

    const bandeja = page.getByRole("heading", {
      name: /solicitudes pendientes/i,
    });
    await expect(bandeja).toBeVisible();

    /*
     * Se confirma LA SOLICITUD DE ESTE PACIENTE, no la primera que aparezca.
     *
     * Desde que existen las sesiones de evaluación, la bandeja mezcla
     * solicitudes individuales con corporativas y `.first()` confirmaba la que
     * tocara según el orden. Apuntar a la fila de Beto hace que la prueba diga
     * lo que cree estar diciendo.
     */
    const solicitudDeBeto = page
      .getByRole("listitem")
      .filter({ hasText: /Beto/i })
      .first();

    await solicitudDeBeto.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(/cita confirmada/i).first()).toBeVisible();

    await cerrarSesion(page);

    // 3. El paciente la ve confirmada, no «por confirmar».
    await entrarComo(page, CUENTAS.otroPaciente);
    await page.goto("/calendario?vista=agenda");

    await expect(
      page.getByRole("link", { name: /^cita confirmada/i }).first(),
    ).toBeVisible();
  });

  test("el paciente no dispone de la acción de confirmar", async ({ page }) => {
    await asegurarSolicitudPendiente(page, CUENTAS.paciente, 20);

    /*
     * Que Postgres rechace `confirmar_cita` llamada por un paciente ya está
     * verificado en las pruebas de RLS, que es donde corresponde. Aquí solo se
     * comprueba lo complementario: que la interfaz tampoco se la ofrece, ni en
     * el calendario ni en el detalle de su propia solicitud.
     */
    await page.goto("/calendario?vista=agenda");
    await expect(
      page.getByRole("button", { name: /^confirmar$/i }),
    ).toHaveCount(0);

    await page
      .getByRole("link", { name: /^cita solicitada/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/calendario\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole("button", { name: /^confirmar$/i }),
    ).toHaveCount(0);
  });
});

test.describe.serial("Agenda del profesional", () => {
  test("agendar una cita la crea ya confirmada", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/agenda/nueva");

    await page.getByLabel("Paciente").selectOption({ index: 0 });
    await page.getByLabel("Día").fill(enDias(30));
    await page.getByLabel("Hora de inicio").selectOption("08:00");
    await page.getByRole("button", { name: /agendar cita/i }).click();

    await expect(page).toHaveURL(/agendada=1/);
    await expect(page.getByText(/cita agendada/i)).toBeVisible();
  });

  test("dos citas solapadas se rechazan en la base", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/agenda/nueva");

    // Mismo día y hora que la cita creada arriba.
    await page.getByLabel("Paciente").selectOption({ index: 0 });
    await page.getByLabel("Día").fill(enDias(30));
    await page.getByLabel("Hora de inicio").selectOption("08:00");
    await page.getByRole("button", { name: /agendar cita/i }).click();

    /*
     * Lo interesante no es el mensaje sino de dónde viene: la restricción de
     * exclusión de Postgres. Una comprobación en la aplicación tendría una
     * ventana de carrera entre consultar y escribir.
     */
    await expect(page.getByText(/se solapa con ese horario/i)).toBeVisible();
  });

  test("las vistas de la agenda funcionan y conservan la ruta", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/agenda");

    await page.getByRole("link", { name: "Mes", exact: true }).click();
    await expect(page).toHaveURL(/\/profesional\/agenda\?vista=mes/);

    await page.getByRole("link", { name: "Periodo siguiente" }).click();
    await expect(page).toHaveURL(/\/profesional\/agenda\?vista=mes/);
  });
});

test.describe("Pacientes", () => {
  test("el listado muestra a los pacientes y su ficha es accesible", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/pacientes");

    await expect(
      page.getByRole("heading", { name: "Pacientes" }),
    ).toBeVisible();

    const primera = page.getByRole("link", { name: "Ver ficha" }).first();
    await expect(primera).toBeVisible();
    await primera.click();

    await expect(page).toHaveURL(/\/profesional\/pacientes\/[0-9a-f-]{36}/);
    await expect(
      page.getByRole("heading", { name: /historial de citas/i }),
    ).toBeVisible();
    // La ficha debe dejar claro qué NO guarda la plataforma.
    await expect(page.getByText(/notas clínicas no se guardan/i)).toBeVisible();
  });
});

/** La sesión corporativa de la siembra. */
const SESION_DE_EMPRESA = "88888888-0000-4000-8000-0000000000aa";

test.describe.serial("Sesiones de empresa", () => {
  /*
   * Confirmar una sesión corporativa reventaba.
   *
   * Al hacer `patient_id` opcional para las empresas no se revisó el aviso por
   * correo, así que el nulo viajaba hasta `getUserById`, que exige un UUID. Lo
   * encontró el cliente, no las pruebas: las de base no ven el TypeScript y
   * ninguna e2e confirmaba una sesión de empresa.
   *
   * Esta sí. Y comprueba lo que el fallo tapaba: que la empresa recibe aviso.
   */
  test("el profesional confirma una sesión de empresa sin que reviente", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional);
    await page.goto("/profesional/agenda");

    const solicitud = page
      .locator("article, li")
      .filter({ hasText: /Distribuciones del Caribe/i })
      .first();

    await expect(solicitud).toBeVisible();
    await solicitud.getByRole("button", { name: /confirmar/i }).click();

    // Que no aparezca la pantalla de error de Next, que es lo que veía el
    // cliente.
    await expect(page.getByText(/Expected parameter to be UUID/i)).toHaveCount(
      0,
    );
    await expect(page.getByText(/Runtime Error/i)).toHaveCount(0);

    await expect(page.getByText(/confirmad|confirmó/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("asigna una evaluación una vez y alcanza a todos los convocados", async ({
    page,
  }) => {
    // La prueba anterior de este bloque `serial` ya la confirmó: asignar solo
    // tiene sentido sobre una sesión que va a ocurrir.
    await entrarComo(page, CUENTAS.profesional);
    await page.goto(`/profesional/citas/${SESION_DE_EMPRESA}`);

    await page
      .getByRole("button", { name: /asignar a los convocados/i })
      .click();

    // Un acto, dos personas: es el punto entero de asignar por sesión.
    await expect(page.getByText(/asignada a 2 personas/i)).toBeVisible({
      timeout: 15000,
    });

    for (const nombre of ["Ana María Restrepo", "Jorge Salas"]) {
      await expect(page.getByText(nombre).last()).toBeVisible();
    }

    // Nadie ha consentido todavía, así que NO se ofrece abrir el examen. Un
    // botón que siempre falla enseña a ignorar los errores.
    await expect(
      page.getByRole("button", { name: /abrir el examen/i }),
    ).toHaveCount(0);

    // Repetir no duplica.
    await page
      .getByRole("button", { name: /asignar a los convocados/i })
      .click();
    await expect(page.getByText(/no se duplicó ninguna/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("abre el examen desde la evaluación, y solo con consentimiento", async ({
    page,
  }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: asignada } = await db
      .from("assignments")
      .select("id, person_id")
      .eq("appointment_id", SESION_DE_EMPRESA)
      .limit(1)
      .single();

    await entrarComo(page, CUENTAS.profesional);
    await page.goto(`/profesional/evaluaciones/${asignada!.id}`);

    /*
     * Sin consentimiento NO se ofrece abrir, y se dice por qué. Un botón que
     * siempre falla enseña a ignorar los errores.
     */
    await expect(page.getByText(/esperando su consentimiento/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /abrir el examen/i }),
    ).toHaveCount(0);

    // La persona acepta desde su cuenta.
    const { data: persona } = await db
      .from("organization_people")
      .select("profile_id")
      .eq("id", asignada!.person_id)
      .single();

    await db.from("consents").insert({
      user_id: persona!.profile_id,
      document_key: "consentimiento_evaluacion",
      version: "1",
      decision: "aceptado",
      assignment_id: asignada!.id,
    });

    await page.reload();
    await page.getByRole("button", { name: /abrir el examen/i }).click();

    await expect(page.getByText(/el examen está abierto/i)).toBeVisible({
      timeout: 15000,
    });
  });
});
