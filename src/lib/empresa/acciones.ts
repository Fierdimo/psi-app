"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/** Limpia el prefijo que PostgREST antepone a los mensajes de la base. */
function limpiarMensaje(error: { message: string; hint?: string | null }) {
  const mensaje = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${mensaje} ${error.hint}` : mensaje;
}

/**
 * Acciones del área de empresa.
 *
 * Como el resto de la aplicación, son fachadas sobre funciones de Postgres. La
 * comprobación de quién puede hacer qué la hace la base: `exigirEmpresa()`
 * sirve para redirigir a quien no debería estar viendo la pantalla, no como
 * control de acceso. Si alguien saltara esta capa, `cargar_personas` seguiría
 * negándose.
 */

const esquemaPersona = z.object({
  documento: z
    .string()
    .trim()
    .min(4, "El documento es demasiado corto")
    .max(30, "El documento es demasiado largo"),
  nombre: z.string().trim().min(2, "Falta el nombre"),
  apellidos: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  email: z.email("Correo no válido"),
  cargo: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  vinculo: z.enum(["aspirante", "empleado"], {
    message: "Indica si aspira al puesto o ya trabaja allí",
  }),
});

const esquemaSesion = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora"),
  duracion: z.coerce
    .number()
    .int()
    .min(30, "Una sesión dura al menos 30 minutos")
    .max(480, "Ocho horas es el máximo"),
  nota: z
    .string()
    .trim()
    .max(500, "La nota no puede pasar de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

/** Limpia el prefijo técnico de un error de Postgres y le pega su pista. */
function mensajeDeError(error: { message: string; hint?: string | null }) {
  const limpio = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${limpio} ${error.hint}` : limpio;
}

function refrescar() {
  revalidatePath("/empresa");
  revalidatePath("/empresa/personas");
  revalidatePath("/empresa/sesiones");
  // El profesional ve la solicitud entrar en su bandeja.
  revalidatePath("/profesional/agenda");
  revalidatePath("/profesional/empresas");
}

export async function cargarPersona(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirEmpresa();

  const datos = esquemaPersona.safeParse({
    documento: formData.get("documento"),
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    email: formData.get("email"),
    cargo: formData.get("cargo"),
    vinculo: formData.get("vinculo"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();

  // Se manda como lista de uno. La función recibe siempre un arreglo porque el
  // caso real son cien personas de golpe; cargar una es solo el caso pequeño.
  const { error } = await supabase.rpc("cargar_personas", {
    p_personas: [datos.data],
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  refrescar();
  return {
    ok: true,
    mensaje: `${datos.data.nombre} quedó en tu listado. Podrás convocarla aunque todavía no tenga cuenta.`,
  };
}

export async function solicitarSesion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const perfil = await exigirEmpresa();

  const datos = esquemaSesion.safeParse({
    fecha: formData.get("fecha"),
    hora: formData.get("hora"),
    duracion: formData.get("duracion"),
    nota: formData.get("nota"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const personas = formData.getAll("personas").map(String);

  if (personas.length === 0) {
    return {
      ok: false,
      errores: { personas: "Elige al menos a una persona" },
    };
  }

  /*
   * La fecha se compone en la ZONA DE LA EMPRESA y se envía en UTC.
   *
   * Es la regla de PLAN §10: un formulario devuelve «2026-09-03» y «09:00»,
   * que no significan nada sin saber dónde. Interpretarlos con la zona del
   * servidor produce sesiones desplazadas varias horas, y en una convocatoria
   * de quince personas eso son quince personas en la puerta a la hora
   * equivocada.
   */
  const inicio = DateTime.fromISO(`${datos.data.fecha}T${datos.data.hora}`, {
    zone: perfil.timezone,
  });

  if (!inicio.isValid) {
    return { ok: false, errores: { fecha: "Fecha u hora no válidas" } };
  }

  const fin = inicio.plus({ minutes: datos.data.duracion });

  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("solicitar_cita_evaluacion", {
    p_starts_at: inicio.toUTC().toISO(),
    p_ends_at: fin.toUTC().toISO(),
    p_personas: personas,
    p_nota: datos.data.nota,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  refrescar();
  return {
    ok: true,
    mensaje:
      "Solicitud enviada. El profesional te contactará para resolver el trámite y la confirmará después.",
  };
}

/**
 * Corregir los datos de alguien del listado.
 *
 * Un listado que solo crece no se puede mantener: se carga un documento mal
 * escrito, alguien cambia de cargo, un aspirante entra a la plantilla.
 */
export async function editarPersona(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirEmpresa();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("editar_persona", {
    p_persona: String(formData.get("persona") ?? ""),
    p_nombre: String(formData.get("nombre") ?? "").trim(),
    p_apellidos: String(formData.get("apellidos") ?? "").trim() || null,
    p_email: String(formData.get("email") ?? "").trim(),
    p_documento: String(formData.get("documento") ?? "").trim(),
    p_cargo: String(formData.get("cargo") ?? "").trim() || null,
    p_vinculo: String(formData.get("vinculo") ?? "aspirante"),
  });

  if (error) return { ok: false, mensaje: limpiarMensaje(error) };

  revalidatePath("/empresa/personas");
  redirect("/empresa/personas?guardada=1");
}

/** Quitar del listado a quien se cargó por error o nunca se presentó. */
export async function quitarPersona(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirEmpresa();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("quitar_persona", {
    p_persona: String(formData.get("persona") ?? ""),
  });

  if (error) return { ok: false, mensaje: limpiarMensaje(error) };

  revalidatePath("/empresa/personas");
  // Su ficha ya no existe: quedarse en ella mostraría un 404.
  redirect("/empresa/personas?retirada=1");
}

/**
 * Corregir una solicitud, mientras siga siendo una solicitud.
 *
 * Una vez confirmada la fecha es un compromiso de dos y a los convocados ya se
 * les avisó, así que la base lo rechaza. Aquí no se ofrece siquiera.
 */
export async function editarSolicitud(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const perfil = await exigirEmpresa();

  const dia = String(formData.get("dia") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const duracion = Number(formData.get("duracion") ?? 60);

  const inicio = DateTime.fromISO(`${dia}T${hora}`, { zone: perfil.timezone });
  if (!inicio.isValid)
    return { ok: false, mensaje: "Fecha u hora no válidas." };

  const personas = formData.getAll("personas").map(String);
  if (personas.length === 0) {
    return { ok: false, errores: { personas: "Elige al menos una persona" } };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("editar_solicitud_evaluacion", {
    p_cita: String(formData.get("cita") ?? ""),
    p_inicio: inicio.toUTC().toISO(),
    p_fin: inicio.plus({ minutes: duracion }).toUTC().toISO(),
    p_modalidad: String(formData.get("modalidad") ?? "presencial"),
    p_lugar: String(formData.get("lugar") ?? "").trim() || null,
    p_nota: String(formData.get("nota") ?? "").trim() || null,
    p_personas: personas,
  });

  if (error) return { ok: false, mensaje: limpiarMensaje(error) };

  revalidatePath("/empresa/sesiones");
  redirect("/empresa/sesiones?editada=1");
}
