"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { cerrarYAvisar } from "@/lib/evaluaciones/cierre-automatico";
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
 * Terminar la prueba.
 *
 * Enviar y cerrar son dos pasos y el segundo puede fallar sin arrastrar al
 * primero: si el motor revienta o el correo no sale, la persona ya terminó y
 * no tiene forma de arreglarlo. La evaluación se queda en «enviada», que es el
 * estado en el que el profesional la ve pendiente de calificar.
 */
/**
 * El informe entero, tal como se le enseña a quien respondió.
 *
 * ES LA MISMA FORMA QUE VE LA EMPRESA, y eso es deliberado: el proyecto ya
 * decidió que las dos partes lean exactamente lo mismo —dos versiones del
 * informe acabarían diciendo cosas distintas al primer cambio— y desde que el
 * documento reproduce el que se entrega en papel, «lo mismo» incluye la forma.
 *
 * Antes viajaba una lista de «etiqueta + párrafo», que perdía los puntajes por
 * el camino: con ella no se podía dibujar ni una barra.
 */
export type InformeCompleto = {
  consentimiento: ConsentimientoInforme | null;
  valores: ValorInforme[];
  parametros: ParametroInforme[];
  textosFijos: Record<string, string>;
  notaGlobal: string | null;
  evaluado: EvaluadoInforme;
};

/**
 * Enviar, cerrar, ENSEÑAR EL INFORME y apagar el pase. En ese orden.
 *
 * El orden es la parte importante y responde a una revisión de seguridad: el
 * enlace de acceso es una credencial al portador que viaja por correo, se
 * imprime en un QR y se queda en el historial de un navegador. Mientras
 * siguiera abriendo el informe, cualquiera que lo tuviera —quien reenvió el
 * correo, quien recogió el folio de la mesa— podía leer un perfil psicológico
 * con nombre y apellidos.
 *
 * Así que el pase se apaga. Pero se apaga AQUÍ y no en la base al recibir las
 * respuestas, porque el informe se produce en `cerrarYAvisar` y esa función
 * puede fallar sin avisar —está escrita para no lanzar nunca, a propósito—. Si
 * el pase muriera al enviar, un fallo del motor dejaría a la persona con la
 * prueba respondida, sin informe y sin enlace por el que volver.
 *
 * Cerrándolo solo cuando el informe ya está en la mano, el fallo se degrada a
 * lo tolerable: el pase sigue vivo, la evaluación queda en «enviada» —que no
 * se puede volver a responder, eso lo cierra el estado y no el testigo— y la
 * persona puede volver más tarde a ver el informe cuando exista.
 *
 * El informe se lee POR IDENTIFICADOR, no por testigo. Es lo que permite
 * enseñárselo sin que el enlace vuelva a viajar, y por tanto lo que permite
 * apagarlo en el mismo gesto.
 */
export async function enviarConPase(pase: string): Promise<{
  ok: boolean;
  mensaje?: string;
  informe?: InformeCompleto;
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
  if (informe) {
    await admin.rpc("cerrar_pase", { p_assignment: asignacion });
  }

  /*
   * NO se revalida la ruta, y es lo que hace que todo esto funcione.
   *
   * Revalidar volvería a pintar la página del servidor, que resuelve por
   * testigo — y el testigo acaba de morir. La persona vería «Este enlace ya se
   * usó» en lugar de su informe, con el informe ya irrecuperable.
   *
   * El informe viaja en esta respuesta y lo pinta el cliente. La página del
   * servidor no tiene que enterarse de nada.
   */
  return { ok: true, informe: informe ?? undefined };
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
      "assessment_id, assigned_at, persona:organization_people(nombre, apellidos, documento), organizacion:organizations(nombre)",
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
  }>(cabecera.persona);
  const empresa = uno<{ nombre: string }>(cabecera.organizacion);

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
  };
}
