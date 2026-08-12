import "server-only";

import { enviarCorreo } from "./enviar";
import {
  citaCancelada,
  citaConfirmada,
  citaRechazada,
  nuevaSolicitud,
  recordatorio,
  type DatosCita,
} from "./plantillas";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Avisos de cita.
 *
 * Usa la clave de servicio porque necesita el correo electrónico, que vive en
 * `auth.users` y no es accesible con la sesión del usuario. Es un uso legítimo
 * y acotado: leer una dirección para enviarle un mensaje sobre su propia cita.
 *
 * Todas las funciones son «dispara y olvida»: si el correo falla, la operación
 * que lo provocó ya ocurrió y no se deshace.
 */

type Aviso =
  | { tipo: "confirmada" }
  | { tipo: "rechazada"; motivo: string | null }
  | { tipo: "cancelada" }
  | { tipo: "recordatorio" };

/** Reúne lo necesario para escribir el correo: la cita, el perfil y el correo. */
async function contexto(citaId: string) {
  const admin = crearClienteAdmin();

  const { data: cita } = await admin
    .from("appointments")
    .select("starts_at, ends_at, modality, location, patient_id")
    .eq("id", citaId)
    .maybeSingle();

  if (!cita) return null;

  const [{ data: perfil }, { data: usuario }] = await Promise.all([
    admin
      .from("profiles")
      .select("nombre, apellidos, timezone")
      .eq("id", cita.patient_id)
      .maybeSingle(),
    admin.auth.admin.getUserById(cita.patient_id),
  ]);

  const correo = usuario?.user?.email;
  if (!correo || !perfil) return null;

  const datos: DatosCita = {
    inicioISO: cita.starts_at,
    finISO: cita.ends_at,
    modalidad: cita.modality,
    lugar: cita.location,
    // La hora se escribe en la zona DEL PACIENTE. Enviarla en la del servidor
    // o en la del profesional es la forma más silenciosa de hacer que alguien
    // llegue tarde.
    zona: perfil.timezone,
  };

  return { datos, nombre: perfil.nombre as string | null, correo };
}

export async function avisarAlPaciente(citaId: string, aviso: Aviso) {
  const ctx = await contexto(citaId);
  if (!ctx) return;

  const plantilla =
    aviso.tipo === "confirmada"
      ? citaConfirmada(ctx.datos, ctx.nombre)
      : aviso.tipo === "rechazada"
        ? citaRechazada(ctx.datos, ctx.nombre, aviso.motivo)
        : aviso.tipo === "cancelada"
          ? citaCancelada(ctx.datos, ctx.nombre)
          : recordatorio(ctx.datos, ctx.nombre);

  await enviarCorreo({ correo: ctx.correo, nombre: ctx.nombre }, plantilla);
}

/** Avisa al profesional de que tiene una solicitud esperando. */
export async function avisarAlProfesional(citaId: string) {
  const ctx = await contexto(citaId);
  if (!ctx) return;

  const admin = crearClienteAdmin();

  const { data: profesional } = await admin
    .from("profiles")
    .select("id, timezone")
    .eq("role", "profesional")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!profesional) return;

  const { data: usuario } = await admin.auth.admin.getUserById(profesional.id);
  const correo = usuario?.user?.email;
  if (!correo) return;

  await enviarCorreo(
    { correo },
    nuevaSolicitud(
      // En su correo, la hora va en SU zona: es quien tiene que estar libre.
      { ...ctx.datos, zona: profesional.timezone },
      ctx.nombre ?? "Un paciente",
    ),
  );
}
