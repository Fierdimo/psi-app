"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirSesion } from "@/lib/auth/perfil";
import { avisarAlPaciente, avisarAlProfesional } from "@/lib/correo/avisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";
import {
  esquemaCancelacion,
  esquemaReprogramacion,
  esquemaSolicitud,
} from "@/lib/validacion/citas";

/**
 * Acciones sobre citas.
 *
 * Ninguna escribe en la tabla: todas llaman a las funciones de transición de
 * Postgres (migración 0004), que verifican el rol, comprueban que el cambio
 * sea legal desde el estado actual y escriben historial y auditoría en la
 * misma transacción.
 *
 * Consecuencia práctica: estas funciones son fachadas delgadas. Toda la regla
 * de negocio vive en un sitio, y no puede saltarse llamando a la API desde
 * fuera de la aplicación.
 */

/**
 * Combina la fecha y la hora que escribió la persona CON SU ZONA HORARIA y
 * devuelve el instante en UTC.
 *
 * Es el punto exacto donde se cometen los errores de zona: «2026-08-18 10:00»
 * no significa nada sin decir 10:00 dónde. Interpretarlo con la zona del
 * servidor —lo que hace `new Date()`— desplaza la cita varias horas.
 */
function aInstanteUTC(fecha: string, hora: string, zona: string) {
  const local = DateTime.fromISO(`${fecha}T${hora}`, { zone: zona });
  return local.isValid ? local : null;
}

/** Traduce el error de Postgres a algo que una persona pueda leer y usar. */
function mensajeDeError(error: { message: string; hint?: string | null }) {
  const limpio = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${limpio} ${error.hint}` : limpio;
}

export async function solicitarCita(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaSolicitud.safeParse({
    fecha: formData.get("fecha"),
    hora: formData.get("hora"),
    modalidad: formData.get("modalidad"),
    nota: formData.get("nota"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const perfil = await exigirSesion();
  const supabase = await crearClienteServidor();

  const inicio = aInstanteUTC(
    datos.data.fecha,
    datos.data.hora,
    perfil.timezone,
  );
  if (!inicio) {
    return { ok: false, errores: { fecha: "Esa fecha y hora no son válidas" } };
  }

  const { data: parametros } = await supabase
    .from("clinic_settings")
    .select("default_duration_minutes")
    .single();

  const duracion = parametros?.default_duration_minutes ?? 60;
  const fin = inicio.plus({ minutes: duracion });

  const { data: nuevaCita, error } = await supabase.rpc("solicitar_cita", {
    p_starts_at: inicio.toUTC().toISO(),
    p_ends_at: fin.toUTC().toISO(),
    p_modality: datos.data.modalidad,
    p_note: datos.data.nota,
  });

  if (error) {
    return { ok: false, mensaje: mensajeDeError(error) };
  }

  // El profesional no está mirando la pantalla: si no se le avisa, la
  // solicitud se queda esperando hasta que entre por casualidad.
  if (typeof nuevaCita === "string") await avisarAlProfesional(nuevaCita);

  revalidatePath("/calendario");
  revalidatePath("/panel");
  redirect("/calendario?solicitada=1");
}

export async function solicitarReprogramacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaReprogramacion.safeParse({
    cita: formData.get("cita"),
    fecha: formData.get("fecha"),
    hora: formData.get("hora"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const perfil = await exigirSesion();
  const supabase = await crearClienteServidor();

  const inicio = aInstanteUTC(
    datos.data.fecha,
    datos.data.hora,
    perfil.timezone,
  );
  if (!inicio) {
    return { ok: false, errores: { fecha: "Esa fecha y hora no son válidas" } };
  }

  const { data: parametros } = await supabase
    .from("clinic_settings")
    .select("default_duration_minutes")
    .single();

  const fin = inicio.plus({
    minutes: parametros?.default_duration_minutes ?? 60,
  });

  const { error } = await supabase.rpc("solicitar_reprogramacion", {
    p_appointment_id: datos.data.cita,
    p_starts_at: inicio.toUTC().toISO(),
    p_ends_at: fin.toUTC().toISO(),
  });

  if (error) {
    return { ok: false, mensaje: mensajeDeError(error) };
  }

  revalidatePath("/calendario");
  revalidatePath("/panel");
  redirect(`/calendario/${datos.data.cita}?cambio=1`);
}

export async function cancelarCita(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCancelacion.safeParse({
    cita: formData.get("cita"),
    motivo: formData.get("motivo"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  await exigirSesion();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("cancelar_cita", {
    p_appointment_id: datos.data.cita,
    p_reason: datos.data.motivo,
  });

  if (error) {
    return { ok: false, mensaje: mensajeDeError(error) };
  }

  await avisarAlPaciente(datos.data.cita, { tipo: "cancelada" });

  revalidatePath("/calendario");
  revalidatePath("/panel");
  redirect("/calendario?cancelada=1");
}
