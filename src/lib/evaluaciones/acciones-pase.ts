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
 * Terminar la prueba.
 *
 * Enviar y cerrar son dos pasos y el segundo puede fallar sin arrastrar al
 * primero: si el motor revienta o el correo no sale, la persona ya terminó y
 * no tiene forma de arreglarlo. La evaluación se queda en «enviada», que es el
 * estado en el que el profesional la ve pendiente de calificar.
 */
/** Un apartado del informe, tal como se le enseña a quien respondió. */
export type ApartadoDeInforme = {
  parameter_key: string;
  etiqueta: string;
  texto: string | null;
  nota_global: string | null;
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
  informe?: ApartadoDeInforme[];
}> {
  const { data, error } = await anonimo().rpc("enviar_con_pase", {
    p_token: pase,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  const asignacion = String(data);

  await cerrarYAvisar(asignacion);

  const admin = crearClienteAdmin();

  const { data: apartados } = await admin.rpc("informe_publicado", {
    p_assignment: asignacion,
  });

  const informe = (apartados ?? []) as ApartadoDeInforme[];

  /*
   * Sin informe, el pase NO se apaga.
   *
   * Es la red descrita arriba. Que la lista venga vacía significa que el
   * cierre automático no llegó a publicar —motor caído, resultado a medias— y
   * en ese caso quitarle el enlace sería castigar a quien no pudo hacer nada.
   */
  if (informe.length > 0) {
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
  return { ok: true, informe };
}
