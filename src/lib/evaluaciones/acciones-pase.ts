"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { cerrarYAvisar } from "@/lib/evaluaciones/cierre-automatico";
import { crearClienteAdmin } from "@/lib/supabase/admin";

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
 * LO QUE VE QUIEN ACABA DE TERMINAR, que ya no es su informe NI SU COPIA.
 *
 * DECISIÓN DEL CLIENTE, en dos pasos y conviene leerlos juntos porque el
 * segundo deshace la coartada del primero.
 *
 * Primero dejó de dibujarse el perfil: enseñárselo a alguien recién salido de
 * media hora de prueba, sin nadie que se lo explique, no es lo que hay que
 * hacer con él. Entonces la pantalla ofrecía descargar el PDF y el correo lo
 * llevaba adjunto, así que la persona seguía teniendo su copia.
 *
 * AHORA NO. Los resultados los recibe únicamente la empresa que encargó la
 * evaluación. No hay botón, y por eso TAMPOCO SE COMPONE EL PDF: dejarlo
 * viajar en la respuesta sin botón que lo abriera sería entregar el informe
 * igual, solo que a la pestaña de red del navegador en vez de a la persona.
 *
 * Lo que queda es una despedida: qué pasó, quién recibió los resultados, con
 * quién sigue el proceso y que puede irse. Su derecho de acceso no se toca —se
 * ejerce ante el responsable, y el correo de acuse lleva la dirección—.
 */
export type CierreDeLaPrueba = {
  nombre: string;
  /** Dónde recibió el acuse. Nulo si la empresa no dejó correo de esta persona. */
  correo: string | null;
  empresa: string | null;
};

/**
 * Enviar, cerrar y apagar el pase. En ese orden.
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
 * Este paso llegó a componer el PDF para que la persona pudiera descargarlo.
 * Ya no: ver `CierreDeLaPrueba`.
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
  const cierre = await leerCierre(asignacion);

  /*
   * Sin informe publicado, el pase NO se apaga.
   *
   * Es la red descrita arriba. Que no haya valores significa que el cierre
   * automático no llegó a publicar —motor caído, resultado a medias— y en ese
   * caso quitarle el enlace sería castigar a quien no pudo hacer nada.
   */
  if (!cierre) return { ok: true };

  await admin.rpc("cerrar_pase", { p_assignment: asignacion });

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
  return { ok: true, cierre };
}

/**
 * Lo poco que necesita la despedida, y la comprobación de que hay informe.
 *
 * Se lee con la clave de servicio porque quien acaba de responder no tiene
 * sesión: su credencial era el pase, y el pase se apaga en el mismo gesto. El
 * identificador ya está resuelto y comprobado antes de llegar aquí.
 *
 * DEVOLVER NULO SIGNIFICA «EL MOTOR NO PUBLICÓ», y es lo que decide si el pase
 * se apaga. Por eso sigue mirando `result_values` y `released_at` aunque no
 * use ni un valor: no es el informe lo que hace falta, es saber que existe.
 *
 * Esta función leía el informe ENTERO —valores, parámetros, textos fijos,
 * consentimiento— para componer el PDF de la persona. Ese PDF ya no se compone
 * (ver `CierreDeLaPrueba`), así que leerlo todo era media docena de consultas
 * por evaluación terminada para tirar el resultado.
 */
async function leerCierre(
  asignacion: string,
): Promise<CierreDeLaPrueba | null> {
  const admin = crearClienteAdmin();

  const { data: cabecera } = await admin
    .from("assignments")
    .select(
      "persona:organization_people(nombre, apellidos, email), organizacion:organizations(nombre)",
    )
    .eq("id", asignacion)
    .maybeSingle();

  if (!cabecera) return null;

  const [{ count: cuantosValores }, { data: resultado }] = await Promise.all([
    admin
      .from("result_values")
      .select("parameter_key", { count: "exact", head: true })
      .eq("assignment_id", asignacion),
    admin
      .from("results")
      .select("released_at")
      .eq("assignment_id", asignacion)
      .maybeSingle(),
  ]);

  // Sin valores o sin publicar no hay informe, y por tanto no hay cierre.
  if (!cuantosValores || !resultado?.released_at) return null;

  const uno = <T>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const persona = uno<{
    nombre: string;
    apellidos: string | null;
    email: string | null;
  }>(cabecera.persona);
  const empresa = uno<{ nombre: string }>(cabecera.organizacion);

  return {
    nombre:
      [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") ||
      "Sin nombre",
    correo: persona?.email ?? null,
    empresa: empresa?.nombre ?? null,
  };
}
