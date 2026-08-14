"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

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
  revalidatePath("/empresa/personal");
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
