export type EstadoCita =
  | "solicitada"
  | "confirmada"
  | "reprogramacion_solicitada"
  | "realizada"
  | "cancelada"
  | "rechazada"
  | "no_asistio";

export type Modalidad = "presencial" | "virtual";

export type Cita = {
  id: string;
  patient_id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  modality: Modalidad;
  location: string | null;
  meeting_url: string | null;
  status: EstadoCita;
  patient_note: string | null;
  proposed_starts_at: string | null;
  proposed_ends_at: string | null;
  created_at: string;
};

/**
 * Tratamiento visual de cada estado (SPEC.md §7.4).
 *
 * El punto clave: las citas NO se pintan como bloques de color sólido. Una
 * vista de mes llena de azul rey rompe la proporción 60/30/10 y hace que el
 * azul deje de significar «esto es accionable». Se pintan como TINTE — fondo
 * suave, texto oscuro, borde izquierdo de acento.
 *
 * Y `etiqueta` no es decorativa: el estado siempre se escribe además de
 * colorearse, porque el color nunca puede ser el único portador de información.
 */
type Aspecto = {
  etiqueta: string;
  /** Frase completa para lectores de pantalla y para la ficha. */
  descripcion: string;
  tono: "accent" | "success" | "warning" | "neutral" | "danger";
  /** Clases del chip en el calendario. */
  chip: string;
  /** ¿Cuenta como una cita viva, que aún puede ocurrir? */
  activa: boolean;
};

export const ASPECTO: Record<EstadoCita, Aspecto> = {
  solicitada: {
    etiqueta: "Por confirmar",
    descripcion: "Solicitada, pendiente de que el profesional la confirme",
    tono: "warning",
    // Borde punteado: comunica «esto todavía no es firme» sin depender del color.
    chip: "border border-dashed border-warning-700 text-warning-700 bg-panel",
    activa: true,
  },
  reprogramacion_solicitada: {
    etiqueta: "Cambio pedido",
    descripcion: "Has pedido cambiar el horario; falta que lo confirmen",
    tono: "warning",
    chip: "border border-dashed border-warning-700 text-warning-700 bg-panel",
    activa: true,
  },
  confirmada: {
    etiqueta: "Confirmada",
    descripcion: "Confirmada por el profesional",
    tono: "success",
    chip: "bg-accent-soft text-accent-on-soft border-l-[3px] border-l-accent",
    activa: true,
  },
  realizada: {
    etiqueta: "Realizada",
    descripcion: "Sesión realizada",
    tono: "neutral",
    chip: "bg-sunken text-text-muted",
    activa: false,
  },
  no_asistio: {
    etiqueta: "No asististe",
    descripcion: "Registrada como no asistida",
    tono: "neutral",
    chip: "bg-sunken text-text-muted",
    activa: false,
  },
  cancelada: {
    etiqueta: "Cancelada",
    descripcion: "Cancelada",
    tono: "neutral",
    chip: "bg-panel text-text-muted line-through",
    activa: false,
  },
  rechazada: {
    etiqueta: "No aceptada",
    descripcion: "El profesional no pudo aceptar este horario",
    tono: "neutral",
    chip: "bg-panel text-text-muted line-through",
    activa: false,
  },
};

export const MODALIDAD: Record<Modalidad, string> = {
  presencial: "Presencial",
  virtual: "En línea",
};

/** ¿Está pendiente de respuesta del profesional? */
export function esPendiente(estado: EstadoCita) {
  return estado === "solicitada" || estado === "reprogramacion_solicitada";
}

/** ¿Puede el paciente pedir un cambio de horario? */
export function puedeReprogramar(cita: Cita, ahoraISO: string) {
  return cita.status === "confirmada" && cita.starts_at > ahoraISO;
}

/** ¿Puede el paciente cancelarla? */
export function puedeCancelar(cita: Cita, ahoraISO: string) {
  return ASPECTO[cita.status].activa && cita.starts_at > ahoraISO;
}
