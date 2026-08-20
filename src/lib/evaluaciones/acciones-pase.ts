"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { cerrarYAvisar } from "@/lib/evaluaciones/cierre-automatico";

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
export async function enviarConPase(
  pase: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  const { data, error } = await anonimo().rpc("enviar_con_pase", {
    p_token: pase,
  });

  if (error) return { ok: false, mensaje: limpiar(error) };

  await cerrarYAvisar(String(data));

  revalidatePath(`/prueba/${pase}`);
  return { ok: true };
}
