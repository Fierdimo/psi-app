import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * El área de la empresa: listar, corregir y convocar.
 *
 * Hasta ahora una empresa solo podía AÑADIR: ni corregir un documento mal
 * escrito, ni quitar a quien se cargó por error, ni cambiar una solicitud
 * antes de que el profesional la respondiera. Un listado que solo crece no se
 * puede mantener.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const ORGANIZACION = "77777777-7777-7777-7777-777777777777";

test.describe.serial("Área de empresa", () => {
  test.beforeAll(async () => {
    // Doce personas más: con dos, el problema que el buscador resuelve no se
    // reproduce.
    const db = admin();
    await db.from("organization_people").delete().like("documento", "90000%");

    await db.from("organization_people").insert(
      Array.from({ length: 12 }, (_, i) => ({
        organization_id: ORGANIZACION,
        documento: `90000${String(i + 10)}`,
        nombre: "Persona",
        apellidos: `Número ${i + 1}`,
        email: `p${i + 1}@caribe.test`,
        cargo: "Operario",
        vinculo: "aspirante" as const,
      })),
    );
  });

  test("el listado es un listado: cargar abre un panel", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    // El formulario ya no vive incrustado encima de la tabla.
    await expect(page.getByLabel("Documento de identidad")).toHaveCount(0);

    await page.getByRole("link", { name: /cargar persona/i }).click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Documento de identidad")).toBeVisible();
  });

  test("se corrige a alguien del listado", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    await page
      .getByRole("link", { name: /^editar$/i })
      .nth(2)
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    /*
     * Un cargo distinto en cada ejecución.
     *
     * Con «Auxiliar de patio» fijo, a la segunda corrida había dos personas con
     * ese texto y el localizador fallaba por ambigüedad: la prueba se rompía
     * por su propio rastro, no por el código.
     */
    const cargo = `Auxiliar de patio ${Date.now().toString().slice(-5)}`;

    await page.getByLabel("Cargo al que aspira").fill(cargo);
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(page).toHaveURL(/guardada=1/);
    await expect(page.getByText(cargo)).toBeVisible();
  });

  test("y se retira a quien se cargó por error", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    /*
     * Se retira a alguien CONCRETO, buscándolo.
     *
     * Antes se pulsaba el cuarto «Editar» de la lista, y quién caía ahí
     * dependía de lo que hubieran dejado las pruebas anteriores: un día era
     * una persona convocada a una sesión, y quitarla se rechaza —con razón—,
     * pero el fallo se leía como «la URL no cambió».
     *
     * Estas fichas las siembra el `beforeAll` de este archivo y no están
     * convocadas a nada.
     */
    await page.getByLabel("Buscar").fill("9000010");
    await page.getByRole("button", { name: /^buscar$/i }).click();

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("link", { name: /^editar$/i }).click();

    await page.getByRole("button", { name: /quitar del listado/i }).click();

    await expect(page).toHaveURL(/retirada=1/);
  });

  test("convocar se hace buscando, no recorriendo la lista", async ({
    page,
  }) => {
    /*
     * Con su propia persona, y no una de las de arriba: las pruebas anteriores
     * de este bloque retiran a alguien, y buscar un documento que otra prueba
     * pudo borrar hace fallar esta por un motivo que no es el suyo.
     */
    const db = admin();
    await db.from("organization_people").delete().eq("documento", "77712345");
    await db.from("organization_people").insert({
      organization_id: ORGANIZACION,
      documento: "77712345",
      nombre: "Rosalía",
      apellidos: "Buscada",
      email: "rosalia@caribe.test",
      cargo: "Almacén",
      vinculo: "aspirante",
    });

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/sesiones/nueva");

    /*
     * Con catorce personas, la lista de casillas obligaba a recorrerlas con la
     * vista. Se busca por documento porque es lo que distingue a dos que se
     * llaman igual.
     */
    await page.getByLabel("Buscar personas").fill("77712345");

    const opciones = page.locator("fieldset ul li button");
    await expect(opciones).toHaveCount(1);

    await opciones.first().click();

    // Lo elegido queda arriba y visible, con su aspa para quitarlo.
    await expect(page.getByText(/1 de \d+/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /quitar de la convocatoria/i }),
    ).toBeVisible();
  });

  test("con cien personas el formulario sigue cabiendo", async ({ page }) => {
    /*
     * El caso real es «encargo cien exámenes».
     *
     * Con la lista completa desplegada la pantalla era una lista de nombres y
     * el botón de enviar quedaba fuera; y elegirlas de una en una son cien
     * clics. Se comprueban las dos cosas: que se añaden en bloque y que lo
     * elegido no empuja la acción fuera de la vista.
     */
    const db = admin();
    await db.from("organization_people").delete().like("documento", "700000%");

    await db.from("organization_people").insert(
      Array.from({ length: 60 }, (_, i) => ({
        organization_id: ORGANIZACION,
        documento: `700000${String(i).padStart(3, "0")}`,
        nombre: "Aspirante",
        apellidos: `Número ${i + 1}`,
        email: `a${i}@caribe.test`,
        cargo: "Operario",
        vinculo: "aspirante" as const,
      })),
    );

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/sesiones/nueva");

    // Los resultados están acotados: no se pintan sesenta filas.
    await expect(page.locator("fieldset ul li")).toHaveCount(8);

    const enviar = page.getByRole("button", { name: /enviar solicitud/i });
    const antes = (await enviar.boundingBox())!.y;

    await page.getByRole("button", { name: /^añadir \d+ personas$/i }).click();
    await expect(page.getByText(/Convocadas \(\d+\)/)).toBeVisible();

    /*
     * Lo que importa: elegir sesenta no empuja la acción sesenta filas abajo.
     *
     * Se mide cuánto se movió el botón, no si cabe en la pantalla. Este
     * formulario se abre SIEMPRE como panel —así se llega a él desde el
     * listado— y en un panel de 600px un formulario con fecha, hora, lugar y
     * convocados no cabe entero de todas formas; medir eso comprobaba la
     * variante de página completa, que ya no ve nadie.
     *
     * La cota es la del contenedor de convocadas (max-h-40 = 160px) más el
     * encabezado de la sección. Sin ella, cada persona añadida bajaba el botón
     * otra fila y con cien era inalcanzable.
     */
    const despues = (await enviar.boundingBox())!.y;
    expect(despues - antes).toBeLessThan(240);
  });

  /*
   * «Evaluaciones» e «Informes» son una sola lista.
   *
   * Antes eran dos secciones, y esta prueba vivía en la de informes. La
   * unificación cambia lo que hay que comprobar: ya no es «sin firmar no hay
   * enlace» —ahora TODA fila se abre— sino que al abrirla se encuentre lo que
   * corresponde al punto en que está: el estado mientras se prepara, y el
   * informe dentro cuando ya existe.
   */
  test("el informe aparece dentro de su evaluación cuando se firma", async ({
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

    /*
     * Se limpia lo de la corrida anterior ANTES de sembrar.
     *
     * Esta prueba creaba una evaluación y no la borraba, así que a la segunda
     * ejecución había dos «En revisión» y el localizador fallaba por
     * ambigüedad. El error apuntaba a la aserción, no a la falta de limpieza.
     *
     * Se acota a las SUYAS —las que no cuelgan de ninguna sesión— porque Ana
     * María sí tiene evaluaciones en la semilla, de una convocatoria real, y
     * borrar por persona se las llevaba: el fallo aparecía después, en el
     * archivo de invitaciones, con un pase apuntando a nada.
     */
    await db
      .from("assignments")
      .delete()
      .eq("person_id", persona!.id)
      .is("appointment_id", null);

    const { data: asignacion } = await db
      .from("assignments")
      .insert({
        assessment_id: prueba!.id,
        person_id: persona!.id,
        organization_id: persona!.organization_id,
        assigned_by: doctor!.id,
        status: "enviada",
      })
      .select("id")
      .single();

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/evaluaciones");

    /*
     * Sin firmar, la fila se abre igual y dice en qué punto está.
     *
     * Es el cambio de la unificación: antes la fila no era pulsable y quien
     * encargó veinte y veía cinco informes no sabía si las otras quince se
     * habían perdido. Ahora se abre y lo explica.
     */
    /*
     * Se apunta a ESTA evaluación por su dirección, no por el nombre.
     *
     * Ana María sale dos veces en el listado: la de la convocatoria de la
     * semilla y la que siembra esta prueba. Antes daba igual porque solo la
     * publicada era pulsable; ahora TODA fila se abre —que es el cambio— y
     * buscar por nombre resuelve a dos enlaces.
     */
    const suya = page.locator(
      `a[href="/empresa/evaluaciones/${asignacion!.id}"]`,
    );

    await expect(page.getByText(/preparando informe/i).first()).toBeVisible();

    await suya.click();

    /*
     * Con margen: es la primera vez que se pide la ruta interceptada del
     * modal, y en `next dev` esa compilación tarda más que la espera por
     * defecto. El fallo aparecía como «el modal no se abre».
     */
    await expect(
      page.getByRole("dialog").getByText(/terminó de responder/i),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Apto para el cargo/)).toHaveCount(0);

    // Cerrar devuelve al listado, que nunca se fue. `exact`, o «Cerrar» también
    // encaja con «Cerrar sesión» de la cabecera.
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("table")).toBeVisible();

    // El profesional firma.
    await db
      .from("assignments")
      .update({ status: "publicada" })
      .eq("id", asignacion!.id);
    await db.from("results").insert({
      assignment_id: asignacion!.id,
      released_at: new Date().toISOString(),
      nota_global: "Apto para el cargo.",
    });
    await db.from("result_values").insert({
      assignment_id: asignacion!.id,
      parameter_key: "D",
      valor: 3,
      sugerido: "Asertividad situacional baja.",
    });

    await page.reload();
    await expect(page.getByText(/informe listo/i).first()).toBeVisible();

    await suya.click();

    // El informe completo, dentro del modal: es lo que la empresa encargó.
    const modal = page.getByRole("dialog");
    await expect(modal.getByText(/Apto para el cargo/)).toBeVisible();
    await expect(modal.getByText(/Asertividad situacional baja/)).toBeVisible();

    // Y se recoge, para que la siguiente ejecución encuentre la casa como la
    // dejó la semilla.
    await db.from("assignments").delete().eq("id", asignacion!.id);
  });

  /*
   * La lista unificada: diez filas, orden por fecha y buscador.
   *
   * Los tres van juntos en una prueba porque son la misma decisión: una lista
   * que crece para siempre —una fila por evaluación encargada, sin borrarse
   * nunca— solo es utilizable si se pagina corto y se puede buscar. Comprobar
   * la paginación sin el buscador dejaría verde una pantalla en la que a la
   * cuarta tanda ya no se encuentra a nadie.
   */
  test("las evaluaciones se paginan de diez en diez y se buscan", async ({
    page,
  }) => {
    const db = admin();

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

    // Se limpia lo de la corrida anterior antes de sembrar: si no, a la
    // segunda ejecución hay veinticuatro y las cuentas dejan de cuadrar.
    await db.from("organization_people").delete().like("documento", "77000%");

    const { data: gente } = await db
      .from("organization_people")
      .insert(
        Array.from({ length: 12 }, (_, i) => ({
          organization_id: ORGANIZACION,
          documento: `77000${String(i + 10)}`,
          nombre: i === 0 ? "Zulema" : "Evaluado",
          apellidos: `Número ${i + 1}`,
          email: `ev${i + 1}@caribe.test`,
        })),
      )
      .select("id");

    await db.from("assignments").insert(
      (gente ?? []).map((p, i) => ({
        assessment_id: prueba!.id,
        person_id: p.id,
        organization_id: ORGANIZACION,
        assigned_by: doctor!.id,
        /*
         * Estados mezclados, para que el filtro tenga algo que filtrar.
         *
         * Nueve sin responder, dos con informe y una vencida. Con todas en el
         * mismo estado, un filtro roto que devolviera siempre la lista entera
         * pasaría la prueba.
         */
        status: (i < 9 ? "asignada" : i < 11 ? "publicada" : "vencida") as
          "asignada" | "publicada" | "vencida",
        // Fechas separadas, para poder afirmar el orden sin depender de los
        // milisegundos con que se insertaron.
        assigned_at: new Date(Date.now() - i * 86400000).toISOString(),
      })),
    );

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/evaluaciones");

    // Diez filas por página, ni once ni veinte.
    await expect(page.locator("tbody tr")).toHaveCount(10);

    /*
     * Y la más reciente arriba.
     *
     * Zulema se sembró con la fecha de hoy y el resto hacia atrás, así que si
     * el orden fuera alfabético o de inserción no encabezaría.
     */
    await expect(page.locator("tbody tr").first()).toContainText("Zulema");

    await page.getByRole("link", { name: "Siguiente" }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Buscar por nombre deja solo la suya, y la búsqueda vive en la dirección.
    await page.goto("/empresa/evaluaciones");
    await page
      .getByRole("searchbox", { name: /buscar una evaluación/i })
      .fill("Zulema");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/q=Zulema/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Zulema");

    // También por documento, que es lo que se tiene a mano cuando hay
    // homónimos.
    await page.goto("/empresa/evaluaciones?q=7700011");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Número 2");

    // Y una búsqueda sin resultados lo dice, en vez de enseñar una tabla vacía.
    await page.goto("/empresa/evaluaciones?q=nadieseasillama");
    await expect(page.getByText(/nada con estos filtros/i)).toBeVisible();

    /*
     * EL FILTRO POR ESTADO.
     *
     * Se combina con la búsqueda a propósito: la semilla trae sus propias
     * evaluaciones y sin acotar a las de esta prueba los números dependerían
     * de lo que hubieran dejado los demás archivos.
     */
    await page.goto("/empresa/evaluaciones?q=Evaluado");
    await expect(page.locator("tbody tr")).toHaveCount(10);

    await page.getByRole("link", { name: /informe listo/i }).click();
    await expect(page).toHaveURL(/estado=listas/);
    // La búsqueda sobrevive al cambio de grupo: quien busca a alguien y no lo
    // encuentra en un grupo mira en otro sin reescribir el nombre.
    await expect(page).toHaveURL(/q=Evaluado/);

    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText("Sin empezar")).toHaveCount(0);

    await page.getByRole("link", { name: /sin completar/i }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("Vencida");

    // Un grupo vacío lo dice, y ofrece la salida.
    await page.goto("/empresa/evaluaciones?q=Evaluado&estado=preparando");
    await expect(page.getByText(/nada con estos filtros/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /ver todas/i })).toBeVisible();

    // Y el grupo viaja con la paginación: pasar de página no lo pierde.
    await page.goto("/empresa/evaluaciones?estado=pendientes");
    await expect(page.getByRole("link", { name: "Siguiente" })).toHaveAttribute(
      "href",
      /estado=pendientes/,
    );

    // Un valor inventado en la dirección se trata como «todas», no como error.
    await page.goto("/empresa/evaluaciones?estado=inventado&q=Evaluado");
    await expect(page.locator("tbody tr")).toHaveCount(10);

    /*
     * LA EXPORTACIÓN SE LLEVA LO FILTRADO Y COMPLETO.
     *
     * Son las dos mitades de la misma decisión: no la página que se tenía
     * delante —serían diez de doce— y no la lista entera cuando hay un filtro
     * puesto. Y la hoja declara con qué filtros salió: una tabla impresa que
     * no lo dice engaña sin querer.
     */
    // El diálogo del navegador no se abre en la prueba: lo que se comprueba es
    // el documento, no el visor del sistema.
    await page.addInitScript(() => {
      window.print = () => {};
    });

    // Once, no diez: en pantalla cabía una página y en el papel van todas.
    await page.goto("/empresa/evaluaciones/exportar?q=Evaluado");
    await expect(page.locator("tbody tr")).toHaveCount(11);
    await expect(page.getByText(/11 evaluaciones/)).toBeVisible();
    await expect(page.getByText(/búsqueda: «Evaluado»/)).toBeVisible();

    await page.goto("/empresa/evaluaciones/exportar?q=Evaluado&estado=listas");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText(/Informe listo/).first()).toBeVisible();

    // Y el botón del listado la alcanza con sus filtros puestos.
    await page.goto("/empresa/evaluaciones?q=Evaluado&estado=listas");
    await expect(
      page.getByRole("link", { name: /imprimir o pdf/i }),
    ).toHaveAttribute("href", /estado=listas/);

    await db.from("organization_people").delete().like("documento", "77000%");
  });

  /*
   * LA DESCARGA DEL PDF, y que respeta de quién es.
   *
   * Es la misma función que genera el adjunto del correo, así que quien
   * archive desde aquí y quien archive desde el correo tienen el mismo
   * documento. Y la dirección es adivinable —`/api/informe/<uuid>`— así que lo
   * que se comprueba de verdad es que no baste con escribirla.
   */
  test("el informe se descarga en PDF, y solo por quien puede", async ({
    page,
  }) => {
    /*
     * Con margen: es la primera vez que se pide la ruta del PDF, y en
     * `next dev` esa compilación tarda más que la espera por defecto — a lo
     * que se suma generar el documento con sus tres imágenes.
     */
    test.setTimeout(120_000);

    const db = admin();

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

    // Su propia evaluación publicada: la de la prueba anterior se recoge al
    // terminar, así que apoyarse en ella la haría depender del orden.
    await db.from("organization_people").delete().eq("documento", "88000001");

    const { data: gente } = await db
      .from("organization_people")
      .insert({
        organization_id: ORGANIZACION,
        documento: "88000001",
        nombre: "Descarga",
        apellidos: "De Prueba",
        email: "descarga@caribe.test",
      })
      .select("id")
      .single();

    const { data: asignacion } = await db
      .from("assignments")
      .insert({
        assessment_id: prueba!.id,
        person_id: gente!.id,
        organization_id: ORGANIZACION,
        assigned_by: doctor!.id,
        status: "publicada" as const,
      })
      .select("id")
      .single();

    await db.from("results").insert({
      assignment_id: asignacion!.id,
      released_at: new Date().toISOString(),
      nota_global: "Apto.",
    });
    await db.from("result_values").insert([
      {
        assignment_id: asignacion!.id,
        parameter_key: "D",
        valor: 3,
        sugerido: "Asertividad moderada.",
      },
      {
        assignment_id: asignacion!.id,
        parameter_key: "I",
        valor: 2,
        sugerido: "Interacción selectiva.",
      },
      {
        assignment_id: asignacion!.id,
        parameter_key: "S",
        valor: 6,
        sugerido: "Prefiere la continuidad.",
      },
      {
        assignment_id: asignacion!.id,
        parameter_key: "C",
        valor: 4,
        sugerido: "Atención a la calidad.",
      },
    ]);

    await entrarComo(page, CUENTAS.empresa);

    const respuesta = await page.request.get(`/api/informe/${asignacion!.id}`);
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toBe("application/pdf");
    expect(respuesta.headers()["content-disposition"]).toContain("attachment");

    // Un PDF de verdad: la firma del formato y un tamaño creíble.
    const cuerpo = await respuesta.body();
    expect(cuerpo.subarray(0, 4).toString()).toBe("%PDF");
    expect(cuerpo.length).toBeGreaterThan(10_000);

    // Y el botón está donde tiene que estar, en la ficha.
    await page.goto(`/empresa/evaluaciones/${asignacion!.id}`);
    await expect(
      page.getByRole("link", { name: /descargar el pdf/i }),
    ).toBeVisible({ timeout: 20000 });

    /*
     * Una evaluación de OTRA empresa no se baja escribiendo su dirección.
     *
     * Responde 404 y no 403 a propósito: distinguirlos convertiría esta
     * dirección en un detector de evaluaciones ajenas.
     */
    const { data: ajena } = await db
      .from("assignments")
      .select("id")
      .neq("organization_id", ORGANIZACION)
      .limit(1)
      .maybeSingle();

    if (ajena) {
      const negada = await page.request.get(`/api/informe/${ajena.id}`);
      expect(negada.status()).toBe(404);
    }

    await db.from("organization_people").delete().eq("documento", "88000001");
  });

  test("la ficha de la empresa se puede corregir", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/datos");

    await page.getByLabel("Correo").fill("contacto.nuevo@caribe.test");
    await page.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(page.getByText(/datos actualizados/i)).toBeVisible();

    /*
     * Y no puede quedarse sin ningún canal: es por donde el profesional
     * resuelve el trámite antes de confirmar una sesión, así que una ficha
     * muda deja las solicitudes en un limbo.
     */
    await page.getByLabel("Correo").fill("");
    await page.getByLabel("Teléfono").fill("");
    await page.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(
      page.getByText(/al menos un correo o un teléfono/i),
    ).toBeVisible();
  });

  /*
   * Recargar con el panel abierto no cambia de pantalla.
   *
   * La intercepción de rutas solo actúa en la navegación de dentro de la
   * aplicación: al recargar, Next pinta la ruta real y el detalle sustituía al
   * listado. Quien recargaba —que es lo que se hace cuando algo no se ve
   * bien— se encontraba con que la aplicación se había movido sola.
   */
  test("recargar con el panel abierto conserva el listado detrás", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    await page
      .getByRole("link", { name: /cargar persona/i })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.reload();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /personas/i }),
    ).toBeVisible();

    /*
     * Y cerrar lleva al listado, no fuera del sitio.
     *
     * Aquí no hay un «atrás» de confianza: en una pestaña recién abierta la
     * entrada anterior no es la lista, así que `router.back()` sacaría de la
     * aplicación o no haría nada y el panel se quedaría clavado.
     */
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.waitForURL(/\/empresa\/personas$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  /*
   * Las listas de la empresa se paginan.
   *
   * Sesiones e informes solo crecen: un informe por persona evaluada, para
   * siempre. Sin tope, una empresa con dos tandas al año acaba con una página
   * de cientos de filas —y PostgREST corta en mil de todas formas, así que la
   * lista mentiría en silencio.
   */
  test("las sesiones se paginan cuando pasan de una página", async ({
    page,
  }) => {
    test.setTimeout(120000);

    const db = admin();
    const { data: prof } = await db
      .from("profiles")
      .select("id")
      .eq("role", "profesional")
      .single();
    const { data: jefe } = await db
      .from("profiles")
      .select("id")
      .eq("organization_id", ORGANIZACION)
      .single();

    const lejos = new Date();
    lejos.setDate(lejos.getDate() + 90);

    await db.from("appointments").insert(
      Array.from({ length: 22 }, (_, i) => {
        const d = new Date(lejos);
        d.setDate(d.getDate() + i);
        d.setUTCHours(13, 0, 0, 0);
        return {
          organization_id: ORGANIZACION,
          professional_id: prof!.id,
          created_by: jefe!.id,
          starts_at: d.toISOString(),
          ends_at: new Date(d.getTime() + 3600000).toISOString(),
          status: "solicitada" as const,
          modality: "presencial" as const,
        };
      }),
    );

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/sesiones");

    await expect(page.getByText(/sesiones · página 1 de/i)).toBeVisible();

    const primera = await page
      .getByRole("listitem")
      .filter({ hasText: /–/ })
      .allTextContents();

    await page.getByRole("link", { name: /^siguiente$/i }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByText(/página 2 de/i)).toBeVisible();

    /*
     * NINGUNA fila se repite entre páginas.
     *
     * Ordenar solo por fecha deja el orden de los empates a criterio de
     * Postgres, y como cada página es una consulta aparte, la misma fila salía
     * en la uno y en la dos mientras otra no salía en ninguna. Con la base
     * local eran 16 de 20 repetidas. Se arregla con un desempate estable por
     * identificador, y esto es lo que impide que vuelva.
     */
    const segunda = await page
      .getByRole("listitem")
      .filter({ hasText: /–/ })
      .allTextContents();

    expect(primera.filter((f) => segunda.includes(f))).toHaveLength(0);

    // Y desde la segunda se puede volver.
    await expect(page.getByRole("link", { name: /^anterior$/i })).toBeVisible();

    await db
      .from("appointments")
      .delete()
      .gte("starts_at", lejos.toISOString());
  });

  /*
   * Buscar a alguien en un listado de cien.
   *
   * Antes solo se podía recorrer página a página, y ni siquiera estaba claro
   * por dónde iba ordenado: la primera columna era el documento y el orden era
   * por nombre, así que la lista parecía barajada.
   */
  test("se busca a una persona, y la búsqueda sobrevive a la paginación", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    // El orden se anuncia en la cabecera, que además es la primera columna.
    await expect(page.getByRole("columnheader").first()).toHaveText(/nombre/i);

    await page.getByLabel("Buscar").fill("Jorge");
    await page.getByRole("button", { name: /^buscar$/i }).click();

    await expect(page).toHaveURL(/q=Jorge/);
    await expect(page.locator("tbody tr")).toHaveCount(1);

    // Y con muchos resultados, pasar de página no devuelve el listado entero.
    await page.goto("/empresa/personas?q=Operario");
    const primera = await page.locator("tbody tr").count();
    expect(primera).toBeGreaterThan(0);

    const siguiente = page.getByRole("link", { name: /^siguiente$/i });
    if (await siguiente.count()) {
      await siguiente.click();
      // `waitForURL` y no dos aserciones: la navegación es del servidor y la
      // segunda comprobación llegaba antes de que terminara.
      await page.waitForURL(/q=Operario.*pagina=2|pagina=2.*q=Operario/, {
        timeout: 20000,
      });
    }
  });
});
