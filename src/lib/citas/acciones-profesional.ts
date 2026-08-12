"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirProfesional } from "@/lib/auth/perfil";
import { avisarAlPaciente } from "@/lib/correo/avisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Acciones del profesional.
 *
 * Igual que las del paciente, son fachadas sobre las funciones de Postgres: la
 * comprobación de rol la hace la base, no esta capa. `exigirProfesional()`
 * aquí sirve para redirigir a quien no debe estar, no como control de acceso
 * — si alguien saltara esta función, `confirmar_cita` seguiría rechazándole.
 */

// Ver la nota sobre `guid` frente a `uuid` en lib/validacion/citas.ts
const esquemaCita = z.object({ cita: z.guid("Cita no válida") });

const esquemaRechazo = esquemaCita.extend({
  motivo: z
    .string()
    .trim()
    .max(500, "El motivo no puede pasar de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

const esquemaCierre = esquemaCita.extend({
  asistio: z.enum(["si", "no"]),
});

const esquemaNuevaCita = z.object({
  paciente: z.guid("Elige un paciente"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora"),
  modalidad: z.enum(["presencial", "virtual"], {
    message: "Elige la modalidad",
  }),
  lugar: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

function mensajeDeError(error: { message: string; hint?: string | null }) {
  const limpio = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${limpio} ${error.hint}` : limpio;
}

function refrescar() {
  revalidatePath("/profesional/agenda");
  revalidatePath("/profesional/pacientes");
  // El paciente ve el cambio de estado en su propio calendario.
  revalidatePath("/calendario");
  revalidatePath("/panel");
}

export async function confirmarCita(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCita.safeParse({ cita: formData.get("cita") });
  if (!datos.success) return { ok: false, errores: erroresDeZod(datos.error) };

  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("confirmar_cita", {
    p_appointment_id: datos.data.cita,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  await avisarAlPaciente(datos.data.cita, { tipo: "confirmada" });
  refrescar();
  /*
   * Se redirige en vez de devolver un mensaje.
   *
   * Al confirmar, la cita sale de la bandeja: el componente que mostraría la
   * confirmación deja de existir en el mismo render. El resultado era una fila
   * que desaparecía sin decir nada, y quien pulsa no sabe si funcionó. El aviso
   * tiene que vivir en la página, que sí sigue ahí.
   */
  redirect("/profesional/agenda?confirmada=1");
}

export async function rechazarCita(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaRechazo.safeParse({
    cita: formData.get("cita"),
    motivo: formData.get("motivo"),
  });
  if (!datos.success) return { ok: false, errores: erroresDeZod(datos.error) };

  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("rechazar_cita", {
    p_appointment_id: datos.data.cita,
    p_reason: datos.data.motivo,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  await avisarAlPaciente(datos.data.cita, {
    tipo: "rechazada",
    motivo: datos.data.motivo,
  });
  refrescar();
  redirect("/profesional/agenda?rechazada=1");
}

export async function cerrarCita(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCierre.safeParse({
    cita: formData.get("cita"),
    asistio: formData.get("asistio"),
  });
  if (!datos.success) return { ok: false, errores: erroresDeZod(datos.error) };

  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("cerrar_cita", {
    p_appointment_id: datos.data.cita,
    p_asistio: datos.data.asistio === "si",
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  refrescar();
  return { ok: true, mensaje: "Cita cerrada." };
}

export async function agendarCita(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaNuevaCita.safeParse({
    paciente: formData.get("paciente"),
    fecha: formData.get("fecha"),
    hora: formData.get("hora"),
    modalidad: formData.get("modalidad"),
    lugar: formData.get("lugar"),
  });
  if (!datos.success) return { ok: false, errores: erroresDeZod(datos.error) };

  const perfil = await exigirProfesional();
  const supabase = await crearClienteServidor();

  // La hora se interpreta en la zona del PROFESIONAL: es quien está agendando
  // y quien tiene que estar disponible a esa hora. El paciente la verá
  // convertida a la suya.
  const inicio = DateTime.fromISO(`${datos.data.fecha}T${datos.data.hora}`, {
    zone: perfil.timezone,
  });

  if (!inicio.isValid) {
    return { ok: false, errores: { fecha: "Esa fecha y hora no son válidas" } };
  }

  const { data: parametros } = await supabase
    .from("clinic_settings")
    .select("default_duration_minutes")
    .single();

  const fin = inicio.plus({
    minutes: parametros?.default_duration_minutes ?? 60,
  });

  const { error } = await supabase.rpc("agendar_cita", {
    p_patient_id: datos.data.paciente,
    p_starts_at: inicio.toUTC().toISO(),
    p_ends_at: fin.toUTC().toISO(),
    p_modality: datos.data.modalidad,
    p_location: datos.data.lugar,
  });

  if (error) {
    // La restricción de exclusión salta si el horario choca con otra cita.
    const choque = error.message.includes("sin_solapamiento");
    return {
      ok: false,
      mensaje: choque
        ? "Ya tienes una cita que se solapa con ese horario."
        : mensajeDeError(error),
    };
  }

  refrescar();
  redirect("/profesional/agenda?agendada=1");
}
