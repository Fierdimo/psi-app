import "server-only";

import { enviarCorreo } from "./enviar";
import {
  citaCancelada,
  citaConfirmada,
  citaRechazada,
  nuevaSolicitud,
  recordatorio,
  sesionCancelada,
  sesionConfirmada,
  sesionRechazada,
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

/**
 * Reúne lo necesario para escribir el correo.
 *
 * UNA CITA TIENE UN TITULAR, Y NO SIEMPRE ES UNA PERSONA. Si la pidió una
 * empresa, `patient_id` es nulo y el destinatario es su contacto.
 *
 * Esto empezó como un fallo: al hacer `patient_id` opcional para las sesiones
 * corporativas no se revisó este archivo, así que confirmar una sesión de
 * empresa reventaba —el nulo viajaba hasta `getUserById`, que exige un UUID—.
 * Y al arreglarlo apareció lo de fondo: nadie le avisaba nunca a la empresa.
 */
async function contexto(citaId: string) {
  const admin = crearClienteAdmin();

  const { data: cita } = await admin
    .from("appointments")
    .select(
      "starts_at, ends_at, modality, location, patient_id, organization_id",
    )
    .eq("id", citaId)
    .maybeSingle();

  if (!cita) return null;

  const base = (zona: string) => ({
    inicioISO: cita.starts_at,
    finISO: cita.ends_at,
    modalidad: cita.modality,
    lugar: cita.location,
    zona,
  });

  if (cita.organization_id) {
    const [{ data: organizacion }, { count }] = await Promise.all([
      admin
        .from("organizations")
        .select("nombre, contacto_nombre, contacto_email")
        .eq("id", cita.organization_id)
        .maybeSingle(),
      admin
        .from("appointment_attendees")
        .select("person_id", { count: "exact", head: true })
        .eq("appointment_id", citaId),
    ]);

    // Sin correo de contacto no hay a quién escribir. `registrar_empresa`
    // exige correo o teléfono, así que puede faltar legítimamente.
    if (!organizacion?.contacto_email) return null;

    return {
      // La hora se escribe en la zona de la consulta: es donde ocurre la
      // sesión presencial.
      datos: base("America/Bogota") as DatosCita,
      nombre: organizacion.contacto_nombre as string | null,
      correo: organizacion.contacto_email as string,
      esEmpresa: true as const,
      cuantos: count ?? 0,
    };
  }

  if (!cita.patient_id) return null;

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

  return {
    // La hora se escribe en la zona DEL PACIENTE. Enviarla en la del servidor
    // o en la del profesional es la forma más silenciosa de hacer que alguien
    // llegue tarde.
    datos: base(perfil.timezone) as DatosCita,
    nombre: perfil.nombre as string | null,
    correo,
    esEmpresa: false as const,
    cuantos: 1,
  };
}

/**
 * Avisa a QUIEN ENCARGÓ la cita: el paciente, o la empresa si fue suya.
 *
 * Se llamaba «avisarAlPaciente» y el nombre mentía desde que existen las
 * sesiones corporativas.
 */
export async function avisarAlTitular(citaId: string, aviso: Aviso) {
  const ctx = await contexto(citaId);
  if (!ctx) return;

  if (ctx.esEmpresa) {
    // Un recordatorio a la empresa no aporta: quien tiene que acordarse es
    // cada persona convocada, y esa es otra vía.
    if (aviso.tipo === "recordatorio") return;

    const paraEmpresa =
      aviso.tipo === "confirmada"
        ? sesionConfirmada(ctx.datos, ctx.nombre, ctx.cuantos)
        : aviso.tipo === "rechazada"
          ? sesionRechazada(ctx.datos, ctx.nombre, aviso.motivo)
          : sesionCancelada(ctx.datos, ctx.nombre);

    await enviarCorreo({ correo: ctx.correo, nombre: ctx.nombre }, paraEmpresa);
    return;
  }

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
