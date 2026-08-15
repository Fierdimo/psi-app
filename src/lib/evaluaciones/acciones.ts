"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Lo que la persona evaluada puede hacer con su evaluación.
 *
 * Ninguna de estas acciones exige el consentimiento CLÍNICO: quien responde un
 * examen que encargó una empresa no está en tratamiento, y pedirle ahí un
 * documento de atención es el error de categoría que ya costó tres capas
 * (`SPEC.md` §9.2).
 */
async function exigirCuenta() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");
  return perfil;
}

/** Limpia el prefijo que PostgREST antepone a los mensajes de la base. */
const limpiar = (mensaje: string) => mensaje.replace(/^.*?:\s*/, "");

export async function consentirEvaluacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirCuenta();

  const asignacion = String(formData.get("asignacion") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("consentir_evaluacion", {
    p_assignment_id: asignacion,
    p_decision: decision,
  });

  if (error) return { ok: false, mensaje: limpiar(error.message) };

  revalidatePath(`/evaluacion/${asignacion}`);

  return {
    ok: true,
    mensaje:
      decision === "aceptado"
        ? "Consentimiento registrado."
        : "Registrada tu negativa. Puedes cambiar de idea cuando quieras.",
  };
}

export async function iniciarPrueba(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirCuenta();

  const asignacion = String(formData.get("asignacion") ?? "");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("iniciar_prueba", {
    p_assignment_id: asignacion,
  });

  if (error) {
    const pista = (error as { hint?: string | null }).hint;
    const mensaje = limpiar(error.message);
    return { ok: false, mensaje: pista ? `${mensaje} ${pista}` : mensaje };
  }

  revalidatePath(`/evaluacion/${asignacion}`);
  return { ok: true, mensaje: "" };
}

/**
 * Guarda UNA respuesta, en cuanto se marca.
 *
 * No devuelve estado de formulario porque no se dibuja: la llama el ejecutor
 * en segundo plano. Si falla, la pantalla lo dice sin perder lo demás — que es
 * justo la razón de guardar de una en una y no las 68 al final.
 */
export async function responder(
  asignacion: string,
  item: string,
  valor: unknown,
): Promise<{ ok: boolean; mensaje?: string }> {
  await exigirCuenta();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("responder", {
    p_assignment_id: asignacion,
    p_item_id: item,
    p_valor: valor,
  });

  return error ? { ok: false, mensaje: limpiar(error.message) } : { ok: true };
}

export async function enviarPrueba(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirCuenta();

  const asignacion = String(formData.get("asignacion") ?? "");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("enviar_prueba", {
    p_assignment_id: asignacion,
  });

  if (error) return { ok: false, mensaje: limpiar(error.message) };

  revalidatePath(`/evaluacion/${asignacion}`);
  redirect(`/evaluacion/${asignacion}?enviada=1`);
}
