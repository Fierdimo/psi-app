"use server";

import { revalidatePath } from "next/cache";

import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/lib/validacion/auth";

export type Franja = { inicio: string; fin: string; ocupada: boolean };

/**
 * Las franjas de un día, para pintar el tablero.
 *
 * Se piden al cambiar de fecha y no se mandan todas con la página: organizar
 * una sesión puede recorrer varios días —justo cuando hay que aplazar gente— y
 * precargar un mes de rejilla para usar uno solo es trabajo tirado.
 */
export async function franjasDelDia(
  fecha: string,
  zona: string,
): Promise<Franja[]> {
  await exigirProfesional();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("franjas_del_dia", {
    p_fecha: fecha,
    p_zona: zona,
  });

  if (error) return [];

  return (data ?? []) as Franja[];
}

/**
 * El plan del día, entero.
 *
 * Se manda completo y no como parche: quien no venga en la lista se queda sin
 * hora. Eso hace que quitarle el sitio a alguien sea simplemente no incluirlo,
 * en vez de una operación aparte que habría que recordar invocar.
 */
export async function guardarReparto(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const cita = String(formData.get("cita") ?? "");
  if (!cita) return { ok: false, mensaje: "Sesión no válida." };

  let reparto: { persona: string; inicio: string }[];
  try {
    reparto = JSON.parse(String(formData.get("reparto") ?? "[]"));
  } catch {
    return { ok: false, mensaje: "El reparto no se pudo leer." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("organizar_sesion", {
    p_appointment_id: cita,
    p_reparto: reparto,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    const pista = (error as { hint?: string | null }).hint;
    return { ok: false, mensaje: pista ? `${limpio} ${pista}` : limpio };
  }

  revalidatePath(`/profesional/citas/${cita}`);
  revalidatePath("/profesional/agenda");

  const colocados = reparto.length;

  return {
    ok: true,
    mensaje:
      colocados === 0
        ? "Se quitaron todas las horas: nadie queda citado todavía."
        : `${colocados} ${colocados === 1 ? "persona citada" : "personas citadas"}.`,
  };
}
