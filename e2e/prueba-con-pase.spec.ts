import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/**
 * La evaluación de quien no tiene cuenta, y su cierre automático.
 *
 * Dos cosas que cambian el producto entero y conviene verlas juntas: se puede
 * responder sin registrarse, y al enviar el informe sale solo hacia la empresa
 * sin que ningún profesional lo lea.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const SESION = "88888888-0000-4000-8000-0000000000aa";

test.describe.serial("Evaluación con pase", () => {
  let pase = "";
  let asignacion = "";
  let invitacionDelPase = "";

  test.beforeAll(async () => {
    const db = admin();

    // La sesión sembrada, confirmada y con instrumento: es lo que crea los
    // pases y las evaluaciones.
    await db
      .from("appointments")
      .update({ status: "confirmada" })
      .eq("id", SESION);

    await db.rpc("preparar_invitaciones", { p_appointment_id: SESION });

    const { data: convocados } = await db
      .from("appointment_attendees")
      .select("person_id")
      .eq("appointment_id", SESION);

    const personas = (convocados ?? []).map((c) => c.person_id);

    /*
     * Solo las de ESTA sesión.
     *
     * La semilla trae una segunda convocatoria con la misma gente, y borrar
     * por persona se llevaba también aquella: su pase quedaba apuntando a una
     * evaluación que ya no existía.
     */
    await db.from("assignments").delete().eq("appointment_id", SESION);

    const { data: prueba } = await db
      .from("assessments")
      .select("id")
      .eq("clave", "disc_dominancia")
      .single();
    const { data: doctor } = await db
      .from("profiles")
      .select("id")
      .eq("role", "profesional")
      .single();

    const { data: creadas } = await db
      .from("assignments")
      .insert(
        personas.map((p) => ({
          assessment_id: prueba!.id,
          person_id: p,
          /*
           * La convocatoria, que no es opcional.
           *
           * Las de verdad las crea `asignar_evaluacion` y siempre la llevan.
           * Sin ella, el pase —que resuelve por la cita a la que pertenece—
           * no encuentra la evaluación, y el fallo aparece como «no tienes
           * ninguna pendiente» en vez de señalar el fixture.
           */
          appointment_id: SESION,
          organization_id: "77777777-7777-7777-7777-777777777777",
          assigned_by: doctor!.id,
          status: "asignada" as const,
        })),
      )
      .select("id, person_id");

    const { data: invitacion } = await db
      .from("invitations")
      .select("id, token, person_id")
      // Por la convocatoria: cada pase abre la evaluación de SU sesión.
      .eq("appointment_id", SESION)
      .not("token", "is", null)
      .limit(1)
      .single();

    pase = invitacion!.token;
    invitacionDelPase = invitacion!.id;
    asignacion = (creadas ?? []).find(
      (a) => a.person_id === invitacion!.person_id,
    )!.id;
  });

  test("se responde sin cuenta, y al enviar el informe sale solo", async ({
    page,
  }) => {
    /*
     * Con margen: esta prueba recorre el circuito entero —consentir, empezar,
     * enviar, calificar 68 respuestas y publicar— y la calificación ocurre en
     * el servidor al pulsar «enviar». Treinta segundos no dan.
     */
    test.setTimeout(180000);

    await page.goto(`/prueba/${pase}`, { waitUntil: "domcontentloaded" });

    // Sin login, sin registro: la primera pantalla ya es el consentimiento.
    await expect(
      page.getByText(/tu participación es voluntaria/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /acepto participar/i }).click();

    // Aceptar va al servidor y la pantalla se repinta: el botón de empezar no
    // existe hasta que vuelve.
    const empezar = page.getByRole("button", { name: /empezar la prueba/i });
    await expect(empezar).toBeVisible({ timeout: 20000 });
    await empezar.click();

    await expect(page.getByText(/0 de 68 respondidas/i)).toBeVisible({
      timeout: 15000,
    });

    /*
     * Las 68 respuestas se siembran por la base, no clicando.
     *
     * Responder a mano en el navegador serían más de cien clics y varios
     * minutos por ejecución. Lo que esta prueba verifica es el CIERRE, y para
     * eso hace falta un examen completo, no el camino para completarlo —que ya
     * cubre la prueba del ejecutor.
     */
    const db = admin();
    const { data: items } = await db
      .from("assessment_items")
      .select("id, tipo, opciones")
      .eq(
        "assessment_id",
        (
          await db
            .from("assignments")
            .select("assessment_id")
            .eq("id", asignacion)
            .single()
        ).data!.assessment_id,
      );

    await db.from("responses").insert(
      (items ?? []).map((i) => ({
        assignment_id: asignacion,
        item_id: i.id,
        /*
         * Los identificadores de opción, no sus posiciones.
         *
         * Un bloque se contesta con «cuál me describe más» y «cuál menos», y
         * se guarda con el id de cada opción («a», «b»…). Con índices, el cero
         * se lee como «sin responder» —`Boolean(0)` es falso— y el examen se
         * quedaba en 40 de 68 sin decir por qué.
         */
        valor:
          i.tipo === "forced_choice"
            ? {
                mas: (i.opciones as { id: string }[])[0].id,
                menos: (i.opciones as { id: string }[])[1].id,
              }
            : 3,
      })),
    );

    await page.reload();
    await expect(page.getByText(/68 de 68 respondidas/i)).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: /terminar y enviar/i }).click();

    // El cierre: publicada, sin que nadie la firmara.
    await expect
      .poll(
        async () => {
          const { data } = await db
            .from("assignments")
            .select("status")
            .eq("id", asignacion)
            .single();
          return data?.status;
        },
        { timeout: 60000 },
      )
      .toBe("publicada");

    const { data: resultado } = await db
      .from("results")
      .select("released_at, released_by, released_automatically")
      .eq("assignment_id", asignacion)
      .single();

    expect(resultado?.released_at).not.toBeNull();

    /*
     * Y queda escrito que salió solo.
     *
     * `released_by` nulo y `released_automatically` verdadero son la diferencia
     * entre un informe publicado y uno firmado. El día que haya que responder
     * por uno, la base tiene que poder distinguirlos.
     */
    expect(resultado?.released_by).toBeNull();
    expect(resultado?.released_automatically).toBe(true);

    /*
     * Y SU COPIA, en la misma pantalla y una sola vez.
     *
     * Es la corrección de seguridad de la migración 0055: el enlace deja de
     * ser una llave permanente al informe, así que el único momento en que la
     * persona puede leerlo es este —cuando acaba de responder y sabemos con
     * certeza que es ella—. La advertencia va ENCIMA del informe porque quien
     * termina baja leyendo y cierra.
     */
    await expect(
      page.getByText(/guarda esto ahora: no podrás volver a abrirlo/i),
    ).toBeVisible({ timeout: 30000 });

    await expect(
      page.getByRole("button", { name: /imprimir o guardar como pdf/i }),
    ).toBeVisible();

    // Y el cuestionario desaparece: no se revisan respuestas que ya no se
    // pueden cambiar.
    await expect(page.getByText(/68 de 68 respondidas/i)).toHaveCount(0);

    /*
     * El pase queda apagado EN LA BASE, no solo en la pantalla.
     *
     * El testigo en claro desaparece —era la llave guardada junto a la
     * cerradura— y la marca de uso es lo que hace que el enlace deje de
     * resolver.
     */
    /*
     * Por el identificador de LA invitación, no por persona ni por evaluación.
     *
     * Por evaluación no vale: este fixture emite el pase con la forma heredada
     * —por convocatoria, sin `assignment_id`—, que es justamente la que la
     * primera versión de `cerrar_pase` se dejaba fuera. Y por persona tampoco:
     * la misma puede estar convocada a dos sesiones y tener dos pases vivos,
     * de los que solo debe cerrarse el de esta.
     */
    const { data: cerrada } = await db
      .from("invitations")
      .select("token, usado_at")
      .eq("id", invitacionDelPase)
      .single();

    expect(cerrada?.token).toBeNull();
    expect(cerrada?.usado_at).not.toBeNull();

    // Volver a abrir el enlace no enseña nada, y lo dice con su motivo: no es
    // «venció», que llevaría a pedirle uno nuevo a la empresa.
    await page.goto(`/prueba/${pase}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/este enlace ya se usó/i)).toBeVisible();
    await expect(page.getByText(/guarda esto ahora/i)).toHaveCount(0);
  });
});
