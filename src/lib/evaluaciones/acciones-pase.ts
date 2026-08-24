"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { cerrarYAvisar } from "@/lib/evaluaciones/cierre-automatico";
import { informeComoPdf } from "@/lib/evaluaciones/informe-pdf";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { consentimientoFirmado } from "@/lib/evaluaciones/consentimiento-firmado";
import type {
  ConsentimientoInforme,
  EvaluadoInforme,
  ParametroInforme,
  ValorInforme,
} from "@/components/evaluaciones/informe";

/**
 * La evaluación de quien no tiene cuenta.
 *
 * El testigo del pase ES la credencial: no hay sesión que consultar, así que
 * cada llamada lo manda y la base lo resuelve a UNA asignación. Ninguna de
 * estas funciones acepta un identificador de asignación desde fuera; si lo
 * hiciera, el pase de una persona serviría para responder la prueba de otra.
 *
 * Se usa un cliente ANÓNIMO y no el de servicio. Podría hacerse con el de
 * servicio y saltarse RLS, pero entonces un fallo en el resolutor del testigo
 * no tendría ninguna red debajo. Con el anónimo, lo único que se puede tocar
 * es lo que estas funciones conceden explícitamente al rol `anon`.
 */
function anonimo() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function limpiar(error: { message: string; hint?: string | null }) {
  const texto = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${texto} ${error.hint}` : texto;
}

export async function consentirConPase(
  pase: string,
  decision: "aceptado" | "rechazado",
  version: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const { error } = await anonimo().rpc("consentir_con_pase", {
    p_token: pase,
    p_decision: decision,
    p_version: version,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  revalidatePath(`/prueba/${pase}`);
  return { ok: true };
}

export async function iniciarConPase(
  pase: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const { error } = await anonimo().rpc("iniciar_con_pase", { p_token: pase });

  if (error) return { ok: false, mensaje: limpiar(error) };

  revalidatePath(`/prueba/${pase}`);
  return { ok: true };
}

export async function responderConPase(
  pase: string,
  item: string,
  valor: unknown,
): Promise<{ ok: boolean; mensaje?: string }> {
  const { error } = await anonimo().rpc("responder_con_pase", {
    p_token: pase,
    p_item: item,
    p_valor: valor,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };
  return { ok: true };
}

/**
 * El informe entero, con todo lo necesario para componer el PDF.
 *
 * Ya NO se dibuja en pantalla al terminar —eso lo explica `CierreDeLaPrueba`—,
 * pero sigue siendo la forma que entra en `informeComoPdf`, que es la misma
 * que ve la empresa. Dos versiones del informe acabarían diciendo cosas
 * distintas al primer cambio.
 */
type InformeCompleto = {
  consentimiento: ConsentimientoInforme | null;
  valores: ValorInforme[];
  parametros: ParametroInforme[];
  textosFijos: Record<string, string>;
  notaGlobal: string | null;
  evaluado: EvaluadoInforme;
  /** A dónde salió su copia. Nulo si la empresa no dejó correo de esta persona. */
  correo: string | null;
  /** El nombre de la prueba, para titular el archivo que se descarga. */
  instrumento: string;
};

/**
 * LO QUE VE QUIEN ACABA DE TERMINAR, que ya no es su informe.
 *
 * DECISIÓN DEL CLIENTE, y va contra lo que hacía esta pantalla hasta ahora.
 * Antes el perfil se dibujaba aquí entero, con el argumento de que era la
 * única ocasión de leerlo. Desde que el PDF sale por correo a la persona
 * además de a la empresa, esa ocasión dejó de ser única — y enseñarle un
 * perfil psicológico a alguien recién salido de media hora de prueba, sin
 * nadie que se lo explique, no es lo que hay que hacer con él.
 *
 * Así que la pantalla se convierte en una despedida: qué pasó, a dónde fue,
 * quién le va a escribir y que puede irse. El archivo sigue a mano por si
 * quiere guardarlo, pero VIAJA EN LA RESPUESTA de la acción, no detrás de una
 * dirección: una dirección que devolviera el informe sería exactamente la
 * credencial al portador que se acaba de apagar.
 */
export type CierreDeLaPrueba = {
  nombre: string;
  correo: string | null;
  empresa: string | null;
  /** El informe en base64. Nulo si la composición falló; entonces no hay botón. */
  pdf: string | null;
  archivo: string;
};

/**
 * Enviar, cerrar, COMPONER EL PDF y apagar el pase. En ese orden.
 *
 * Enviar y cerrar son dos pasos y el segundo puede fallar sin arrastrar al
 * primero: si el motor revienta, la persona ya terminó y no puede hacer nada.
 * La evaluación se queda en «enviada», que es el estado en el que el
 * profesional la ve pendiente de calificar.
 *
 * El orden con el pase responde a una revisión de seguridad: el enlace de
 * acceso es una credencial al portador que viaja por correo, se imprime en un
 * QR y se queda en el historial de un navegador. Mientras siguiera abriendo la
 * evaluación, cualquiera que lo tuviera —quien reenvió el correo, quien
 * recogió el folio de la mesa— podía entrar con el nombre de otra persona.
 *
 * Así que el pase se apaga. Pero se apaga AQUÍ y no en la base al recibir las
 * respuestas, porque el informe se produce en `cerrarYAvisar` y esa función
 * puede fallar sin avisar —está escrita para no lanzar nunca, a propósito—. Si
 * el pase muriera al enviar, un fallo del motor dejaría a la persona con la
 * prueba respondida, sin informe y sin enlace por el que volver.
 *
 * Cerrándolo solo cuando el informe existe, el fallo se degrada a lo
 * tolerable: el pase sigue vivo, la evaluación queda en «enviada» —que no se
 * puede volver a responder, eso lo cierra el estado y no el testigo— y la
 * persona puede volver más tarde.
 *
 * El informe se lee POR IDENTIFICADOR, no por testigo. Es lo que permite
 * componer su copia sin que el enlace vuelva a viajar, y por tanto lo que
 * permite apagarlo en el mismo gesto.
 */
export async function enviarConPase(pase: string): Promise<{
  ok: boolean;
  mensaje?: string;
  cierre?: CierreDeLaPrueba;
}> {
  const { data, error } = await anonimo().rpc("enviar_con_pase", {
    p_token: pase,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  const asignacion = String(data);

  await cerrarYAvisar(asignacion);

  const admin = crearClienteAdmin();
  const informe = await leerInformeCompleto(asignacion);

  /*
   * Sin informe, el pase NO se apaga.
   *
   * Es la red descrita arriba. Que no haya valores significa que el cierre
   * automático no llegó a publicar —motor caído, resultado a medias— y en ese
   * caso quitarle el enlace sería castigar a quien no pudo hacer nada.
   */
  if (!informe) return { ok: true };

  await admin.rpc("cerrar_pase", { p_assignment: asignacion });

  /*
   * El PDF se compone OTRA VEZ, y se sabe.
   *
   * El cierre automático ya generó uno para adjuntarlo a los dos correos, pero
   * no lo devuelve: es una función que no lanza nunca y se corta antes si la
   * empresa no tiene correo de contacto. Devolver el archivo desde allí ataría
   * la copia de esta persona a que la empresa tuviera buzón, que no tiene nada
   * que ver.
   *
   * El precio es medio segundo de composición en una operación que ocurre una
   * vez por evaluación terminada. Lo otro sería una dependencia entre dos
   * caminos que fallan por motivos distintos.
   */
  let pdf: string | null = null;
  try {
    pdf = await informeComoPdf(informe);
  } catch (fallo) {
    /*
     * Un fallo aquí NO tumba la pantalla final.
     *
     * La persona ya respondió y su copia ya salió por correo; quedarse sin el
     * botón de descarga es un contratiempo, ver un error después de media hora
     * de prueba es otra cosa.
     */
    console.error(
      "[pase] la persona se quedó sin su descarga:",
      fallo instanceof Error ? fallo.message : "fallo desconocido",
    );
  }

  /*
   * NO se revalida la ruta, y es lo que hace que todo esto funcione.
   *
   * Revalidar volvería a pintar la página del servidor, que resuelve por
   * testigo — y el testigo acaba de morir. La persona vería «Este enlace ya se
   * usó» en lugar de su despedida.
   *
   * Todo lo que la pantalla final necesita viaja en esta respuesta. La página
   * del servidor no tiene que enterarse de nada.
   */
  return {
    ok: true,
    cierre: {
      nombre: informe.evaluado.nombre,
      correo: informe.correo,
      empresa: informe.evaluado.empresa,
      pdf,
      archivo: `Informe ${informe.instrumento} - ${informe.evaluado.nombre}.pdf`,
    },
  };
}

/**
 * El informe publicado de una evaluación, con todo lo que hace falta para
 * dibujarlo.
 *
 * Se lee con la clave de servicio porque quien acaba de responder no tiene
 * sesión: su credencial era el pase, y el pase se apaga en el mismo gesto. El
 * identificador ya está resuelto y comprobado antes de llegar aquí.
 */
async function leerInformeCompleto(
  asignacion: string,
): Promise<InformeCompleto | null> {
  const admin = crearClienteAdmin();

  const { data: cabecera } = await admin
    .from("assignments")
    .select(
      "assessment_id, assigned_at, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento, email), organizacion:organizations(nombre)",
    )
    .eq("id", asignacion)
    .maybeSingle();

  if (!cabecera) return null;

  const [
    { data: valores },
    { data: resultado },
    { data: parametros },
    { data: fijos },
  ] = await Promise.all([
    admin
      .from("result_values")
      .select("parameter_key, valor, sugerido, nota")
      .eq("assignment_id", asignacion),
    admin
      .from("results")
      .select("nota_global, released_at")
      .eq("assignment_id", asignacion)
      .maybeSingle(),
    admin
      .from("assessment_parameters")
      .select("clave, etiqueta, kind, seccion")
      .eq("assessment_id", cabecera.assessment_id)
      .order("posicion"),
    admin.rpc("textos_fijos_del_instrumento", {
      p_assessment: cabecera.assessment_id,
    }),
  ]);

  // Sin valores o sin publicar no hay informe que enseñar.
  if (!valores || valores.length === 0 || !resultado?.released_at) return null;

  const uno = <T>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const persona = uno<{
    nombre: string;
    apellidos: string | null;
    documento: string | null;
    email: string | null;
  }>(cabecera.persona);
  const empresa = uno<{ nombre: string }>(cabecera.organizacion);
  const prueba = uno<{ nombre: string }>(cabecera.assessment);

  const evaluado = {
    nombre:
      [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") ||
      "Sin nombre",
    documento: persona?.documento ?? null,
    empresa: empresa?.nombre ?? null,
    fechaISO: cabecera.assigned_at,
  };

  return {
    consentimiento: await consentimientoFirmado(admin, asignacion, evaluado),
    valores: valores as ValorInforme[],
    parametros: (parametros ?? []) as ParametroInforme[],
    textosFijos: Object.fromEntries(
      ((fijos ?? []) as { parameter_key: string; cuerpo: string }[]).map(
        (t) => [t.parameter_key, t.cuerpo],
      ),
    ),
    notaGlobal: resultado?.nota_global ?? null,
    evaluado,
    correo: persona?.email ?? null,
    instrumento: prueba?.nombre ?? "evaluación",
  };
}
