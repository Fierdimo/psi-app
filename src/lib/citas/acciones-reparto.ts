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
  /**
   * La sesión que se está organizando, para excluirla del cálculo.
   *
   * Sin esto, las horas de sus propios convocados salen ocupadas y mover a
   * alguien de las 9 a las 10 es imposible: las 10 parecen tomadas por él.
   */
  excepto?: string,
): Promise<Franja[]> {
  await exigirProfesional();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("franjas_del_dia", {
    p_fecha: fecha,
    p_zona: zona,
    p_excepto: excepto ?? null,
  });

  if (error) return [];

  return (data ?? []) as Franja[];
}

/**
 * Las rejillas de varios días, indexadas por día.
 *
 * `franjasDelDia` sirve mientras la tanda cabe en una jornada. En cuanto se
 * reparte, cada persona necesita elegir entre las horas de SU día, y eso son
 * dos o tres rejillas vivas a la vez. Pedirlas de una en una son N llamadas
 * para una sola pregunta, y la lista parpadea mientras van llegando.
 *
 * Se devuelven agrupadas porque así es como se usan: el desplegable de cada
 * fila busca la de su día, no recorre una lista plana filtrando.
 */
export async function franjasDeDias(
  dias: string[],
  zona: string,
  excepto?: string,
): Promise<Record<string, Franja[]>> {
  await exigirProfesional();

  if (dias.length === 0) return {};

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("franjas_de_dias", {
    p_dias: dias,
    p_zona: zona,
    p_excepto: excepto ?? null,
  });

  if (error) return {};

  const porDia: Record<string, Franja[]> = {};

  for (const f of (data ?? []) as (Franja & { dia: string })[]) {
    (porDia[f.dia] ??= []).push({
      inicio: f.inicio,
      fin: f.fin,
      ocupada: f.ocupada,
    });
  }

  /*
   * Los días sin rejilla existen y valen «vacío», no «todavía no ha llegado».
   *
   * Un sábado no devuelve filas, así que sin esto su clave faltaría y la
   * pantalla lo trataría como cargando: el desplegable se quedaría en «…» para
   * siempre en vez de decir que ese día no se atiende.
   */
  for (const d of dias) porDia[d] ??= [];

  return porDia;
}

/**
 * Los próximos huecos libres, saltando de día cuando el día se acaba.
 *
 * `franjasDelDia` responde «qué queda el martes». Con quince convocados y una
 * jornada de ocho bloques la pregunta es otra —«dame quince huecos, ya me dirás
 * tú en qué días caen»— y resolverla pidiendo un día tras otro son N viajes al
 * servidor y N rejillas enteras descartadas.
 *
 * Se piden EXACTAMENTE los que faltan, y a partir del final del plan actual:
 * así ninguno puede chocar con alguien ya colocado, sin tener que mandar el
 * plan entero para que el servidor lo esquive.
 */
export async function huecosSeguidos(
  desde: string,
  cuantos: number,
  zona: string,
  excepto?: string,
): Promise<{ inicio: string; fin: string }[]> {
  await exigirProfesional();

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("huecos_seguidos", {
    p_desde: desde,
    p_cuantos: cuantos,
    p_zona: zona,
    p_excepto: excepto ?? null,
  });

  if (error) return [];

  return (data ?? []) as { inicio: string; fin: string }[];
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
