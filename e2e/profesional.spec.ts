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
  await page.goto("/solicitar-cita");

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

  /*
   * La navegación del profesional, después del giro a evaluaciones por usos.
   *
   * Comprobaba «Agenda» y «Pacientes», y las dos se retiraron del menú: no hay
   * citas que organizar ni personas atendidas a las que seguir. Lo que la
   * prueba defiende sigue siendo lo mismo —que cada papel llega a SUS
   * secciones— y por eso se reescribe en vez de borrarse.
   */
  test("el profesional ve sus secciones en la navegación", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");

    const nav = page.getByRole("navigation", { name: "Secciones" });
    await expect(nav.getByRole("link", { name: "Solicitudes" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Empresas" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Evaluaciones" })).toBeVisible();

    // Y ya no llega a lo retirado.
    await expect(nav.getByRole("link", { name: "Agenda" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Pacientes" })).toHaveCount(0);
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

test.describe("El detalle como panel", () => {
  /*
   * Mismo gesto que en el área del paciente, y aquí importa más: quien revisa
   * su agenda entra y sale de varias citas seguidas, y volver a situarse en el
   * mes cada vez es justo el trabajo que esta pantalla debería ahorrar.
   */
  test("una cita de la agenda se abre por la derecha", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional);

    // En vista de mes se ven las citas de todo el periodo, no solo las de esta
    // semana, que en la siembra está vacía.
    await page.goto("/profesional/agenda?vista=mes");

    await page.locator('a[href^="/profesional/citas/"]').first().click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/profesional\/citas\/[0-9a-f-]+$/);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/vista=mes/);
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
    /*
     * La sesión de la semilla, devuelta a «solicitada».
     *
     * Esta prueba la confirma y no la deshacía, así que a la segunda ejecución
     * no había ninguna solicitud pendiente y fallaba diciendo que no
     * encontraba la tarjeta —un error que apunta a la vista, no a la falta de
     * limpieza, y se busca en el sitio equivocado. Ya pasó dos veces.
     *
     * Se deja preparada al empezar y no al terminar: la prueba siguiente la
     * quiere ya confirmada, y encadenarlas es deliberado.
     */
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await db
      .from("appointments")
      .update({ status: "solicitada" })
      .eq("id", "88888888-0000-4000-8000-0000000000aa");

    await entrarComo(page, CUENTAS.profesional);

    /*
     * En la agenda, no en «Solicitudes».
     *
     * `/profesional/solicitudes` dejó de ser la bandeja de citas: ahora es la
     * de compras de usos. La bandeja de sesiones sigue viva en la agenda, que
     * es donde estuvo siempre además de allí, y ahí es donde esta prueba tiene
     * que mirar mientras el calendario exista.
     */
    await page.goto("/profesional/agenda");

    /*
     * Dentro de la bandeja, no en cualquier `li` de la pantalla.
     *
     * La agenda abre en la rejilla del mes, y sus celdas también son `li`:
     * buscar por texto en toda la página resolvía a catorce elementos ocultos
     * y la espera moría en «unexpected value hidden». Se ancla en el
     * encabezado de la bandeja, que es lo que esta prueba mira de verdad.
     */
    const bandeja = page.getByRole("heading", {
      name: /solicitudes pendientes/i,
    });
    await expect(bandeja).toBeVisible();

    const solicitud = page
      .getByRole("listitem")
      .filter({ hasText: /Distribuciones del Caribe/i })
      .filter({ has: page.getByRole("button", { name: "Confirmar" }) })
      .first();

    await expect(solicitud).toBeVisible();

    // Una sesión de empresa se encabeza con la EMPRESA. Antes salía como un
    // paciente sin nombre, porque el calendario usaba el ayudante equivocado.
    await expect(page.getByText(/Sin nombre/i)).toHaveCount(0);

    /*
     * Los convocados van PLEGADOS: se ve a cuántos alcanza, que es lo que hace
     * falta para aceptar, y quiénes son se despliega. El listado abierto
     * ocupaba más que la fecha y los botones juntos.
     */
    await expect(solicitud.getByText(/2 personas convocadas/i)).toBeVisible();
    await expect(solicitud.getByText("Ana María Restrepo")).toBeHidden();

    await solicitud.locator("summary").click();
    await expect(solicitud.getByText("Ana María Restrepo")).toBeVisible();

    await solicitud.getByRole("button", { name: /confirmar/i }).click();

    // Que no aparezca la pantalla de error de Next, que es lo que veía el
    // cliente.
    await expect(page.getByText(/Expected parameter to be UUID/i)).toHaveCount(
      0,
    );
    await expect(page.getByText(/Runtime Error/i)).toHaveCount(0);

    /*
     * El primero VISIBLE, no el primero del árbol.
     *
     * La rejilla del mes lleva una insignia «Confirmada» por cada cita de cada
     * celda, todas ocultas hasta que se abre el día: `.first()` a secas
     * resolvía a treinta y tres nodos y se quedaba esperando a uno oculto.
     */
    await expect(
      page
        .getByText(/confirmad|confirmó/i)
        .locator("visible=true")
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("asigna una evaluación una vez y alcanza a todos los convocados", async ({
    page,
  }) => {
    // La prueba anterior de este bloque `serial` ya la confirmó: asignar solo
    // tiene sentido sobre una sesión que va a ocurrir.

    /*
     * Y se retiran las evaluaciones que dejó la ejecución anterior.
     *
     * Sin esto, la sesión ya tenía instrumento asignado y no aparecía en
     * «Confirmadas, sin evaluación asignada», que es lo primero que esta
     * prueba comprueba. Como la anterior, se limpia al empezar: recoger al
     * final rompería el encadenamiento del bloque `serial`.
     */
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    /*
     * Solo las de ESTA sesión.
     *
     * Borrar por persona se llevaba también las de la otra convocatoria que
     * trae la semilla —la misma gente está en las dos— y dejaba sus pases
     * apuntando a una evaluación que ya no existía. El fallo salía en otro
     * archivo, que es lo que hace estas fugas tan caras de encontrar.
     */
    await db
      .from("assignments")
      .delete()
      .eq("appointment_id", SESION_DE_EMPRESA);

    await entrarComo(page, CUENTAS.profesional);

    /*
     * Confirmar no puede hacer que la sesión desaparezca de la vista. El paso
     * siguiente es asignar, así que la sesión confirmada y sin instrumento
     * tiene que verse DESDE Evaluaciones y no solo en el calendario.
     */
    await page.goto("/profesional/evaluaciones");
    await expect(
      page.getByText(/confirmadas, sin evaluación asignada/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Distribuciones del Caribe/i).first(),
    ).toBeVisible();

    await page.goto(`/profesional/citas/${SESION_DE_EMPRESA}`);

    /*
     * Cada convocado aparece UNA vez.
     *
     * Esta pantalla llegó a listar a la misma gente tres veces —el tablero con
     * su hora, «Convocados» con su cargo, y los pases con su enlace—, así que
     * los nombres ocupaban la altura entera y las acciones quedaban abajo,
     * invisibles y sin nada que indicara que estaban ahí.
     *
     * Antes esto se comprobaba mirando el «Ocultar» del listado plegable. Ese
     * listado ya no existe: sus datos viven en la fila del tablero, que es lo
     * que hace que sobre.
     */
    for (const nombre of ["Ana María Restrepo", "Jorge Salas"]) {
      /*
       * Una vez A LA VISTA.
       *
       * El bloque de accesos sigue en el documento, plegado: es la herramienta
       * para repartir enlaces y ahí los nombres tienen que estar. Lo que no
       * puede pasar es que se pinten dos veces nada más abrir la sesión.
       */
      await expect(
        page.getByText(nombre).filter({ visible: true }),
      ).toHaveCount(1);
    }

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

    // Y una vez asignada deja de reclamarlo.
    await page.goto("/profesional/evaluaciones");
    await expect(
      page.getByText(/confirmadas, sin evaluación asignada/i),
    ).toHaveCount(0);

    /*
     * Recién asignada NO está en la pestaña por defecto, y es correcto: esa
     * es «Por revisar» y nadie ha respondido todavía. Vive en «En marcha»,
     * que es donde se mira quién va contestando.
     *
     * Antes la lista era una sola y todo caía junto; con dos años de uso eso
     * es lo que la volvía inservible.
     */
    await page.getByRole("link", { name: /en marcha/i }).click();
    await expect(page.getByText("Ana María Restrepo").first()).toBeVisible();

    await page.goto(`/profesional/citas/${SESION_DE_EMPRESA}`);

    // Repetir no duplica.
    await page
      .getByRole("button", { name: /asignar a los convocados/i })
      .click();
    await expect(page.getByText(/no se duplicó ninguna/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("consentir deja el examen disponible, sin un paso más", async ({
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

    // Mientras no haya consentido, la pantalla lo dice y no hay nada que hacer.
    await expect(page.getByText(/esperando su consentimiento/i)).toBeVisible();

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

    /*
     * Y en cuanto acepta queda disponible, sin que el profesional tenga que
     * abrirlo. Ese paso no decidía nada y en una sesión grande eran tantos
     * clics como convocados.
     */
    await page.reload();
    await expect(page.getByText(/puede empezar cuando quiera/i)).toBeVisible();
  });

  /*
   * La cola de evaluaciones, cuando ya no es corta.
   *
   * Era una lista de tarjetas sin filtro ni tope: con veinte pendientes había
   * que desplazarse para compararlas, y con dos años de uso no se podía ni
   * abrir. Se comprueba lo que la hace manejable —tabla, filtro, paginación— y
   * la acción que evita veinte vueltas al detalle.
   */
  test("la cola se filtra, se pagina y se califica en lote", async ({
    page,
  }) => {
    /*
     * Calificar en lote es lento a propósito: cada evaluación pasa por el
     * motor, una a una, para que el fallo de una no arrastre a las demás.
     * Veinticinco no caben en los treinta segundos por defecto, y el aborto se
     * leía como «el mensaje no apareció».
     */
    test.setTimeout(240000);

    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

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

    await db.from("organization_people").delete().like("documento", "COLA%");
    const { data: gente } = await db
      .from("organization_people")
      .insert(
        Array.from({ length: 30 }, (_, i) => ({
          organization_id: "77777777-7777-7777-7777-777777777777",
          documento: `COLA${String(i).padStart(3, "0")}`,
          nombre: "Persona",
          apellidos: `De la cola ${i + 1}`,
          email: `cola${i}@caribe.test`,
          vinculo: "aspirante" as const,
        })),
      )
      .select("id");

    await db.from("assignments").insert(
      (gente ?? []).map((g) => ({
        assessment_id: prueba!.id,
        person_id: g.id,
        organization_id: "77777777-7777-7777-7777-777777777777",
        assigned_by: doctor!.id,
        status: "enviada" as const,
      })),
    );

    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/evaluaciones");

    // Veinticinco por página, no las treinta: la lista tiene tope.
    await expect(page.locator("tbody tr")).toHaveCount(25);
    // La paginación es ahora la misma pieza que usan las listas de la empresa,
    // así que nombra lo que cuenta en vez de decir «en total».
    await expect(
      page.getByText(/30 evaluaciones · página 1 de 2/),
    ).toBeVisible();

    // El acceso de una persona concreta, en su fila.
    await page
      .getByRole("button", { name: /^acceso$/i })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();

    // Buscar acota sin cambiar de pestaña.
    await page.getByLabel(/buscar una evaluación/i).fill("COLA007");
    await page.getByRole("button", { name: /^buscar$/i }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.goto("/profesional/evaluaciones");

    /*
     * Y calificar varias de una vez, que es lo que ahorra veinte vueltas.
     *
     * Estas treinta no tienen respuestas —nadie contestó nada—, así que el
     * motor no puede con ninguna. Eso es justo lo que se quiere comprobar
     * aquí: que el lote NO se detiene en la primera que falla y que informa,
     * en vez de quedarse callado o a medias sin decir dónde. Que el motor
     * califique bien lo verifican las pruebas de base y las unitarias, con
     * respuestas de verdad.
     */
    await page.getByLabel(/seleccionar todas/i).check();
    await page.getByRole("button", { name: /calificar las elegidas/i }).click();

    await expect(
      page.getByText(/no se pudo calificar ninguna|calificad/i).first(),
    ).toBeVisible({ timeout: 60000 });

    // Publicar en lote NO se ofrece, y no es un olvido: publicar es la firma.
    await expect(
      page.getByRole("button", { name: /publicar las elegidas/i }),
    ).toHaveCount(0);

    await db
      .from("assignments")
      .delete()
      .in(
        "person_id",
        (gente ?? []).map((g) => g.id),
      );
    await db.from("organization_people").delete().like("documento", "COLA%");
  });

  /*
   * La sesión no desaparece al aceptarla.
   *
   * «Solicitudes» solo enseñaba lo que esperaba decisión, así que confirmar una
   * sesión la borraba de la vista justo cuando empieza lo que importa: si la
   * gente consintió, si está respondiendo, si hay informes que firmar.
   */
  test("una sesión aceptada sigue en Solicitudes, con su estado", async ({
    page,
  }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    await db
      .from("appointments")
      .update({ status: "confirmada" })
      .eq("id", SESION_DE_EMPRESA);

    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/solicitudes");

    await expect(page.getByText(/sesiones en marcha/i)).toBeVisible();

    /*
     * Dentro de «Sesiones en marcha», no en cualquier lista.
     *
     * La misma empresa puede tener una solicitud esperando arriba, y buscar su
     * nombre en toda la página encontraba esa tarjeta —que no lleva estado— en
     * vez de la del seguimiento.
     */
    const fila = page
      .locator("section")
      .filter({ hasText: /sesiones en marcha/i })
      .getByRole("listitem")
      .filter({ hasText: /Distribuciones del Caribe/i })
      .first();

    await expect(fila).toBeVisible();

    /*
     * Y dice qué falta, no cinco cifras.
     *
     * De los recuentos que trae la base se enseña el primero que estorba;
     * enumerarlos todos obliga a compararlos para deducir en qué punto está.
     */
    await expect(
      fila.getByText(
        /sin hora|sin consentir|por revisar|respondiendo|informes listos|falta asignar|todo listo/i,
      ),
    ).toBeVisible();
  });
});
