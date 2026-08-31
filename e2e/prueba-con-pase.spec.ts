import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/** El buzón de desarrollo que levanta `supabase start`. */
const MAILPIT = "http://127.0.0.1:54324";

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

    /*
     * EL BUZÓN ES COMPARTIDO, y esta prueba cuenta correos.
     *
     * Mailpit acumula lo de toda la suite: cuando `usos` y `empresa` han
     * corrido antes, quedan varios «Informe disponible» de otras empresas. Las
     * aserciones de abajo afirman CUÁNTOS correos con informe salen, así que
     * mirar el buzón entero las hace depender del orden de los archivos.
     *
     * Se marca el instante de arranque y solo se cuenta lo posterior. Vale
     * `Date.now()` porque Mailpit sella cada mensaje con su `Created`.
     *
     * La versión anterior de esta prueba pedía «al menos dos» y por eso no le
     * afectaba. Al pasar a «exactamente uno» —que es lo que de verdad protege
     * el cambio— el aislamiento dejó de ser opcional.
     */
    const desde = Date.now();

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
     * Y LA DESPEDIDA, que ya no es el informe.
     *
     * Decisión del cliente: el perfil sale por correo SOLO a la empresa —a la
     * persona le llega el acuse de recibo, sin resultados— y esta pantalla
     * dice qué pasó, con quién sigue el proceso y que puede irse. Se
     * comprueban las cuatro cosas porque cada una responde a una pregunta
     * distinta de quien acaba de terminar, y la última —«puedes cerrar»— es la
     * que evita que se quede esperando algo que no va a salir.
     */
    await expect(page.getByText(/terminaste tu evaluación/i)).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText(/los resultados no viajan por ese correo/i),
    ).toBeVisible();
    await expect(page.getByText(/continúa el proceso contigo/i)).toBeVisible();
    await expect(page.getByText(/ya puedes cerrar esta página/i)).toBeVisible();

    /*
     * Y EL PERFIL NO ESTÁ EN LA PANTALLA. Es el punto del cambio.
     *
     * Sin esta aserción, volver a dibujar el informe aquí pasaría todas las
     * demás: la despedida seguiría estando, solo que con el perfil debajo.
     */
    await expect(page.getByText(/perfil disc evaluado/i)).toHaveCount(0);
    await expect(page.getByText(/perfil neurolateral/i)).toHaveCount(0);

    /*
     * Y NO HAY POR DÓNDE LLEVARSE EL INFORME. Es el segundo punto del cambio.
     *
     * Aquí hubo un botón de descarga y esta prueba comprobaba que bajaba un
     * PDF de verdad. Se retiró con el adjunto del correo: los resultados los
     * recibe solo la empresa que encargó la evaluación.
     */
    await expect(
      page.getByRole("button", { name: /descargar mi informe en pdf/i }),
    ).toHaveCount(0);

    /*
     * Y EL PDF TAMPOCO VIAJA ESCONDIDO EN LA RESPUESTA.
     *
     * Quitar el botón y seguir componiendo el archivo en `enviarConPase` sería
     * entregar el informe igual, solo que a la pestaña de red del navegador.
     * No se puede mirar la respuesta de la acción desde aquí, así que se mira
     * lo que sí es observable: nada en la página carga un base64 de ese
     * tamaño. Un `pdf` de vuelta lo dejaría en el árbol de datos de React.
     */
    const rastro = await page.evaluate(() =>
      document.documentElement.innerHTML.includes("JVBERi0"),
    );
    expect(rastro).toBe(false);

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

    /*
     * EL PDF SALE POR CORREO A LA EMPRESA, Y SOLO A ELLA.
     *
     * A la persona evaluada le llega un acuse de recibo SIN adjunto y sin
     * resultados: la dirección la escribió la empresa al convocar y en un
     * proceso de selección puede ser un buzón corporativo.
     *
     * Se miran las dos caras, y la segunda es la que de verdad protege el
     * cambio: que exista el acuse, y que NO exista un segundo correo con el
     * informe dentro. Comprobar solo lo primero pasaría igual si alguien
     * reactivara el envío del PDF a la persona.
     */
    type MensajeMailpit = {
      ID: string;
      Subject: string;
      Attachments: number;
      Created: string;
    };

    /** Lo que ha llegado al buzón DESDE que empezó esta prueba. */
    const mios = async (): Promise<MensajeMailpit[]> => {
      const r = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
      const { messages } = await r.json();
      return ((messages ?? []) as MensajeMailpit[]).filter(
        (m) => new Date(m.Created).getTime() >= desde,
      );
    };

    const correos = await expect
      .poll(
        async () =>
          (await mios()).filter((m) =>
            /recibimos tus respuestas/i.test(m.Subject),
          ).length,
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(1)
      .then(mios);

    const conInforme = correos.filter(
      (m) => /informe/i.test(m.Subject) && m.Attachments > 0,
    );

    // Uno, el de la empresa. Dos significaría que la persona volvió a recibirlo.
    expect(conInforme).toHaveLength(1);

    const acuses = correos.filter((m) =>
      /recibimos tus respuestas/i.test(m.Subject),
    );

    // Y el acuse va vacío: es la confirmación de que terminó, no su informe.
    expect(acuses[0].Attachments).toBe(0);

    // Y es un PDF de verdad, no un adjunto vacío con nombre bonito.
    const detalle = await fetch(
      `${MAILPIT}/api/v1/message/${conInforme[0].ID}`,
    ).then((r) => r.json());

    const adjunto = detalle.Attachments[0];
    expect(adjunto.ContentType).toBe("application/pdf");
    expect(adjunto.FileName).toMatch(/\.pdf$/);
    expect(adjunto.Size).toBeGreaterThan(10_000);

    /*
     * Y el acuse NO lleva los resultados en el cuerpo.
     *
     * Quitar el adjunto y dejar el perfil escrito en el texto sería el mismo
     * fallo con otra forma, y es el error fácil de cometer al redactar la
     * plantilla.
     */
    const cuerpoAcuse = await fetch(
      `${MAILPIT}/api/v1/message/${acuses[0].ID}`,
    ).then((r) => r.json());

    expect(cuerpoAcuse.Text).toMatch(/continúa tu proceso/i);
    expect(cuerpoAcuse.Text).not.toMatch(/perfil|dominancia|puntuación/i);

    // Volver a abrir el enlace no enseña nada, y lo dice con su motivo: no es
    // «venció», que llevaría a pedirle uno nuevo a la empresa.
    await page.goto(`/prueba/${pase}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/este enlace ya se usó/i)).toBeVisible();
    // Y no queda rastro de la despedida: el enlace no reabre nada.
    await expect(page.getByText(/terminaste tu evaluación/i)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /descargar mi informe en pdf/i }),
    ).toHaveCount(0);
  });
});
