"use server";

import { revalidatePath } from "next/cache";

import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/lib/validacion/auth";

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
