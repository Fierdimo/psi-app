import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { rellenarIngreso } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * El circuito de invitación, desde el enlace del correo.
 *
 * Las pruebas de base (`invitaciones.test.sql`) ya verifican la higiene del
 * testigo y el enlace por cédula. Lo que NO pueden ver es lo que pasa en el
 * navegador: que la pantalla diga quién convoca ANTES de pedir nada, que se
 * pueda llegar sin sesión, y que aceptar enlace de verdad la ficha con la
 * cuenta.
 *
 * El testigo se crea aquí con privilegios de servidor porque en la aplicación
 * solo existe en claro el instante del envío: en la tabla queda su hash, y de
 * un hash no se vuelve.
 */

const TOKEN =
  "e2e0000000000000000000000000000000000000000000000000000000000001";

/** El mismo cálculo que hace Postgres al guardar. */
async function hashDe(token: string) {
  const resumen = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const ORGANIZACION = "77777777-7777-7777-7777-777777777777";
const SESION = "88888888-0000-4000-8000-0000000000aa";
/** La cédula de Beto en la siembra: ya tiene cuenta. */
const DOCUMENTO_BETO = "1032118844";

test.describe.serial("Invitación a una evaluación", () => {
  let personaId: string;

  test.beforeAll(async () => {
    const db = admin();

    // Se limpia por si quedó de una ejecución anterior: una prueba que solo
    // pasa la primera vez no es una prueba.
    await db
      .from("invitations")
      .delete()
      .eq("token_hash", await hashDe(TOKEN));
    await db
      .from("organization_people")
      .delete()
      .eq("organization_id", ORGANIZACION)
      .eq("documento", DOCUMENTO_BETO);

    const { data: persona } = await db
      .from("organization_people")
      .insert({
        organization_id: ORGANIZACION,
        documento: DOCUMENTO_BETO,
        nombre: "Beto",
        apellidos: "Cárdenas",
        email: "beto@distribuciones.test",
        vinculo: "aspirante",
      })
      .select("id")
      .single();

    personaId = persona!.id;

    await db.from("invitations").insert({
      person_id: personaId,
      appointment_id: SESION,
      token_hash: await hashDe(TOKEN),
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
  });

  test("sin sesión dice quién convoca y ofrece las dos puertas", async ({
    page,
  }) => {
    await page.goto(`/invitacion/${TOKEN}`);

    // La empresa se nombra ANTES de pedir nada: quien recibe esto tiene
    // derecho a saber de parte de quién viene y a marcharse.
    await expect(
      page.getByText(/Distribuciones del Caribe/i).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /crear mi cuenta/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /ya tengo cuenta/i }),
    ).toBeVisible();

    // Y se dice que aceptar no equivale a consentir la evaluación.
    await expect(page.getByText(/sin él no se te evalúa/i)).toBeVisible();
  });

  test("un testigo inventado no revela nada", async ({ page }) => {
    await page.goto(`/invitacion/${"f".repeat(64)}`);

    await expect(page.getByText(/no es válida/i)).toBeVisible();
    await expect(page.getByText(/Distribuciones del Caribe/i)).toHaveCount(0);
  });

  test("quien ya tiene cuenta acepta con ella y queda enlazado", async ({
    page,
  }) => {
    // Llega por el enlace, no tiene sesión, y entra con la cuenta que ya tenía.
    await page.goto(`/invitacion/${TOKEN}`);
    await page.getByRole("link", { name: /ya tengo cuenta/i }).click();
    await rellenarIngreso(page, CUENTAS.otroPaciente);

    // El destino sobrevive al ingreso y vuelve a la invitación.
    await page.waitForURL(new RegExp(`/invitacion/${TOKEN}`));

    await page.getByRole("button", { name: /activar mi acceso/i }).click();

    // Vuelve a la invitación con acuse, no al panel: el panel exige el
    // consentimiento clínico, que es de tratamiento y no de evaluación.
    await page.waitForURL(/aceptada=1/);
    await expect(page.getByText(/tu acceso está activo/i)).toBeVisible();

    // Lo que importa no es la pantalla, es el vínculo en la base.
    const { data } = await admin()
      .from("organization_people")
      .select("profile_id")
      .eq("id", personaId)
      .single();

    expect(data!.profile_id).not.toBeNull();

    const { data: invitacion } = await admin()
      .from("invitations")
      .select("accepted_at")
      .eq("token_hash", await hashDe(TOKEN))
      .single();

    expect(invitacion!.accepted_at).not.toBeNull();
  });
});

test.describe("Mis evaluaciones", () => {
  /*
   * La prueba asignada tiene que PODER ENCONTRARSE.
   *
   * Lo encontró el cliente: la evaluación se asignaba y en la cuenta de la
   * persona no aparecía por ningún lado. Existía la pantalla de UNA evaluación
   * pero nada enlazaba a ella. Una prueba que nadie encuentra es una prueba
   * que nadie hace.
   */
  test("la persona ve su evaluación pendiente y quién la pidió", async ({
    page,
  }) => {
    const db = admin();

    const { data: prueba } = await db
      .from("assessments")
      .select("id")
      .eq("clave", "disc_dominancia")
      .single();

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

    await db.from("assignments").insert({
      assessment_id: prueba!.id,
      person_id: persona!.id,
      organization_id: persona!.organization_id,
      assigned_by: doctor!.id,
      status: "asignada",
    });

    await page.goto("/ingresar");
    await rellenarIngreso(page, CUENTAS.paciente);
    // Ana es paciente sin consentimiento firmado, así que el ingreso la lleva
    // al documento clínico. Da igual: sus evaluaciones NO están detrás de él.
    await page.waitForURL(/consentimiento|panel/, { timeout: 20000 });
    await page.goto("/evaluacion");

    /*
     * `.first()` porque otras pruebas dejan a Ana con más de una evaluación.
     * Es la cuarta vez que un localizador sin acotar se rompe al crecer los
     * datos: en una base compartida, «el único» dura poco.
     */
    await expect(
      page.getByText(/Perfil DISC y dominancia cerebral/i).first(),
    ).toBeVisible();

    // Quien va a ser evaluado tiene derecho a saber de parte de quién.
    await expect(
      page.getByText(/Distribuciones del Caribe/i).first(),
    ).toBeVisible();
  });
});

test.describe("El ejecutor de la prueba", () => {
  /*
   * Tres fallos que encontró el cliente respondiendo, y que ninguna prueba
   * veía porque todas miraban la base y no la pantalla.
   */
  test("marca lo elegido y no deja avanzar a medias", async ({ page }) => {
    const db = admin();

    const { data: prueba } = await db
      .from("assessments")
      .select("id")
      .eq("clave", "disc_dominancia")
      .single();
    const { data: persona } = await db
      .from("organization_people")
      .select("id, organization_id, profile_id")
      .eq("documento", "1047373301")
      .single();
    const { data: doctor } = await db
      .from("profiles")
      .select("id")
      .eq("role", "profesional")
      .single();

    const { data: asignacion } = await db
      .from("assignments")
      .insert({
        assessment_id: prueba!.id,
        person_id: persona!.id,
        organization_id: persona!.organization_id,
        assigned_by: doctor!.id,
        status: "en_curso",
        habilitado_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    await db.from("consents").insert({
      user_id: persona!.profile_id,
      document_key: "consentimiento_evaluacion",
      version: "1",
      decision: "aceptado",
      assignment_id: asignacion!.id,
    });

    await page.goto("/ingresar");
    await rellenarIngreso(page, CUENTAS.paciente);
    await page.waitForURL(/consentimiento|panel/, { timeout: 20000 });
    await page.goto(`/evaluacion/${asignacion!.id}`);

    const siguiente = page.getByRole("button", { name: /^Siguiente$/ });
    const radios = page.locator('input[type="radio"]');

    // Sin responder no se avanza.
    await expect(siguiente).toBeDisabled();

    // Con MEDIA respuesta tampoco: un bloque necesita «más» Y «menos», y con
    // uno solo la escala se calcula mal sin que nada lo avise.
    await radios.nth(0).check();
    await expect(siguiente).toBeDisabled();

    await radios.nth(3).check();
    await expect(siguiente).toBeEnabled();

    // Y lo elegido se ve elegido. La escala Likert se pintaba con clases que
    // no existen en este proyecto, así que la respuesta se guardaba sin que
    // la persona tuviera forma de saberlo.
    await siguiente.click();
    await expect(page.getByText(/2 de 68/)).toBeVisible();
  });
});
