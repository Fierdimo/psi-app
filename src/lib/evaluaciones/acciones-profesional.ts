"use server";

import { revalidatePath } from "next/cache";

import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import { motorDe } from "@/lib/evaluaciones/motores";
import type { Item, Respuesta, Texto } from "@/lib/evaluaciones/motor";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Lee una tabla entera, por páginas.
 *
 * PostgREST devuelve 1000 filas como MÁXIMO DEL SERVIDOR, y `.range()` NO
 * sube ese tope: pedir 0..49999 sigue devolviendo 1000. Se descubrió porque el
 * DISC tiene 2701 textos —2401 solo de la tabla de segmentos— y llegaba un
 * trozo: unos apartados del informe salían y otros no, según dónde cayera su
 * fila. Un informe verosímil y equivocado, que es la peor clase de fallo que
 * puede tener esta pantalla porque no se ve.
 *
 * Calificar ocurre una vez por persona, así que tres viajes no son problema.
 */
async function leerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGINA = 1000;
  const todo: T[] = [];

  for (let desde = 0; ; desde += PAGINA) {
    const { data } = await consulta(desde, desde + PAGINA - 1);
    if (!data || data.length === 0) break;
    todo.push(...data);
    if (data.length < PAGINA) break;
  }

  return todo;
}

/** Limpia el prefijo que PostgREST antepone a los mensajes de la base. */
function limpiar(error: { message: string; hint?: string | null }) {
  const mensaje = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${mensaje} ${error.hint}` : mensaje;
}

/**
 * Asignar una evaluación a una sesión.
 *
 * UN acto para toda la sesión. Si la pidió una empresa, alcanza a todos sus
 * convocados: era el pedido explícito y además evita el error de dejarse a
 * alguien fuera de una tanda de veinte (`SPEC.md` §9.2).
 *
 * Lo que NO hace es emitir nada. Asignar dice «esta sesión aplica este
 * instrumento»; el examen lo abre el profesional durante la sesión, con otra
 * acción y con el consentimiento de cada persona ya firmado.
 */
export async function asignarEvaluacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const cita = String(formData.get("cita") ?? "");
  const instrumento = String(formData.get("instrumento") ?? "");

  if (!cita || !instrumento) {
    return { ok: false, mensaje: "Elige un instrumento." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("asignar_evaluacion", {
    p_appointment_id: cita,
    p_assessment_id: instrumento,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  revalidatePath(`/profesional/citas/${cita}`);
  revalidatePath("/profesional/evaluaciones");

  const n = Number(data ?? 0);

  /*
   * Cero no es un fallo: es que ya estaban asignadas.
   *
   * `asignar_evaluacion` ignora los duplicados, así que volver a pulsar no
   * crea una segunda evaluación a nadie. Decirlo evita que el profesional
   * insista pensando que no funcionó.
   */
  if (n === 0) {
    return {
      ok: true,
      mensaje:
        "Todos los convocados ya tenían esta evaluación asignada. No se duplicó ninguna.",
    };
  }

  return {
    ok: true,
    mensaje:
      n === 1
        ? "Evaluación asignada."
        : `Evaluación asignada a ${n} personas de esta sesión.`,
  };
}

/**
 * Abrir el examen, en la sesión.
 *
 * La base rechaza esto si la persona no ha aceptado: el consentimiento es un
 * candado, no un aviso.
 */
export async function habilitarExamen(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const asignacion = String(formData.get("asignacion") ?? "");
  const cita = String(formData.get("cita") ?? "");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("habilitar_examen", {
    p_assignment_id: asignacion,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  if (cita) revalidatePath(`/profesional/citas/${cita}`);
  revalidatePath("/profesional/evaluaciones");

  return { ok: true, mensaje: "Examen abierto. Ya puede empezar." };
}

/**
 * Calificar: aquí se enchufa el motor.
 *
 * La puntuación NO la hace la base. Se leen los ítems, las respuestas y los
 * textos, se llama al motor del instrumento y se guarda lo que devuelve. Así
 * la baremación vive en TypeScript, con pruebas, en vez de en SQL.
 *
 * Y calificar no publica. Deja la evaluación lista para que el profesional la
 * lea, corrija lo que haga falta y la firme.
 */
export async function calificarEvaluacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const asignacion = String(formData.get("asignacion") ?? "");
  const supabase = await crearClienteServidor();
  const salida = await calificarUna(supabase, asignacion);

  if (!salida.ok) return salida;

  revalidatePath(`/profesional/evaluaciones/${asignacion}`);
  revalidatePath("/profesional/evaluaciones");

  return {
    ok: true,
    mensaje:
      "Calificada. Revisa lo que propone el motor antes de publicarla: todavía no la ve nadie.",
  };
}

/**
 * Calificar VARIAS de una vez.
 *
 * Calificar es mecánico: el motor lee las respuestas y propone. Con veinte
 * evaluaciones enviadas, hacerlo de una en una son veinte entradas al detalle
 * y veinte vueltas, sin ninguna decisión por el camino — el trabajo de verdad
 * viene después, al leer lo que propuso.
 *
 * NO existe el equivalente para publicar, y es deliberado. Publicar es la
 * firma: dice que leíste ese informe y respondes por él. Un botón que firma
 * veinte de golpe convierte esa afirmación en un clic, y lo que se publica
 * llega a la empresa que encargó la evaluación.
 *
 * Cada una va por su lado: si el motor revienta con una —respuestas
 * incompletas, un instrumento sin motor— las demás se califican igual y se
 * dice cuántas fallaron. Detenerse en la primera dejaría el lote a medias sin
 * que se sepa dónde.
 */
export async function calificarVarias(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const asignaciones = formData
    .getAll("asignacion")
    .map(String)
    .filter(Boolean);

  if (asignaciones.length === 0) {
    return { ok: false, mensaje: "No seleccionaste ninguna evaluación." };
  }

  const supabase = await crearClienteServidor();

  let hechas = 0;
  const fallos: string[] = [];

  for (const asignacion of asignaciones) {
    const salida = await calificarUna(supabase, asignacion);
    if (salida.ok) hechas += 1;
    else fallos.push(salida.mensaje ?? "fallo desconocido");
    revalidatePath(`/profesional/evaluaciones/${asignacion}`);
  }

  revalidatePath("/profesional/evaluaciones");

  if (hechas === 0) {
    return {
      ok: false,
      mensaje: `No se pudo calificar ninguna. ${fallos[0] ?? ""}`.trim(),
    };
  }

  const cuantas = `${hechas} ${hechas === 1 ? "evaluación calificada" : "evaluaciones calificadas"}`;

  return {
    ok: true,
    mensaje:
      fallos.length === 0
        ? `${cuantas}. Ninguna la ve nadie todavía: revísalas antes de firmarlas.`
        : `${cuantas}, ${fallos.length} sin calificar. La primera falló así: ${fallos[0]}`,
  };
}

/**
 * El trabajo de calificar una, sin nada alrededor.
 *
 * Vive aparte para que hacerlo en lote sea exactamente lo mismo que hacerlo de
 * una en una. Duplicarlo habría dejado dos caminos que se separan al primer
 * arreglo que se aplique solo a uno.
 */
async function calificarUna(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  asignacion: string,
): Promise<EstadoFormulario> {
  if (!asignacion) return { ok: false, mensaje: "Evaluación no válida." };

  const { data: datos, error: errorDatos } = await supabase
    .from("assignments")
    .select("assessment_id, assessment:assessments(motor)")
    .eq("id", asignacion)
    .maybeSingle();

  if (errorDatos || !datos) {
    return { ok: false, mensaje: "No encontramos esa evaluación." };
  }

  const embebida = datos.assessment as
    { motor: string } | { motor: string }[] | null;
  const clave = (Array.isArray(embebida) ? embebida[0] : embebida)?.motor;

  if (!clave) {
    return { ok: false, mensaje: "Ese instrumento no declara ningún motor." };
  }

  const [{ data: items }, { data: respuestas }, { data: textos }] =
    await Promise.all([
      supabase
        .from("assessment_items")
        .select("id, posicion, tipo, enunciado, escala, opciones")
        .eq("assessment_id", datos.assessment_id)
        .order("posicion"),
      supabase
        .from("responses")
        .select("item_id, valor")
        .eq("assignment_id", asignacion),
      leerTodo<Texto>((desde, hasta) =>
        supabase
          .from("assessment_texts")
          .select("parameter_key, nivel, cuerpo")
          .eq("assessment_id", datos.assessment_id)
          .order("parameter_key")
          .order("nivel", { nullsFirst: true })
          .range(desde, hasta),
      ).then((data) => ({ data })),
    ]);

  let valores;
  try {
    valores = motorDe(clave).calificar({
      items: (items ?? []) as Item[],
      respuestas: (respuestas ?? []) as Respuesta[],
      textos: (textos ?? []) as Texto[],
    });
  } catch (fallo) {
    /*
     * Un motor que revienta se dice tal cual.
     *
     * La alternativa —guardar un informe a medias— es peor: quedaría
     * `calificada` y con apariencia de correcto, y el fallo aparecería mucho
     * más tarde, en el informe de una persona.
     */
    return {
      ok: false,
      mensaje:
        fallo instanceof Error ? fallo.message : "El motor no pudo calificar.",
    };
  }

  const { error } = await supabase.rpc("calificar_evaluacion", {
    p_assignment_id: asignacion,
    p_valores: valores,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  return { ok: true };
}

/** Lo que el profesional escribe encima de lo que propuso el motor. */
export async function redactarResultado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const asignacion = String(formData.get("asignacion") ?? "");
  const parametro = String(formData.get("parametro") ?? "");
  const nota = String(formData.get("nota") ?? "");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("redactar_resultado", {
    p_assignment_id: asignacion,
    p_parameter_key: parametro,
    p_nota: nota.trim() === "" ? null : nota,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  revalidatePath(`/profesional/evaluaciones/${asignacion}`);
  return { ok: true, mensaje: "Guardado." };
}

/**
 * Publicar: el acto que hace existir el informe.
 *
 * Hasta aquí nadie —ni la persona ni la empresa— ha visto una sola línea. Es
 * deliberadamente un botón aparte del de calificar.
 */
export async function publicarResultado(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const asignacion = String(formData.get("asignacion") ?? "");
  const nota = String(formData.get("nota_global") ?? "");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("publicar_resultado", {
    p_assignment_id: asignacion,
    p_nota_global: nota.trim() === "" ? null : nota,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  revalidatePath(`/profesional/evaluaciones/${asignacion}`);
  revalidatePath("/profesional/evaluaciones");

  return {
    ok: true,
    mensaje:
      "Publicado. Ya está disponible para la persona y para la empresa que lo encargó.",
  };
}
