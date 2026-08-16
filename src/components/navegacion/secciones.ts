import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  Inbox,
  Receipt,
  Settings,
  Users,
  BookOpen,
  ClipboardCheck,
  NotebookPen,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type Seccion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Sin contenido todavía: se muestra atenuada y con un punto indicador. */
  placeholder?: boolean;
  /** Aparece en la barra inferior de móvil, donde solo caben tres. */
  principal?: boolean;
  /** Activa solo con coincidencia exacta: para la raíz de un área. */
  exacta?: boolean;
};

/**
 * Mapa del área del paciente (SPEC.md §5).
 *
 * Las secciones sin contenido se muestran igualmente, atenuadas. Enseñar el
 * mapa completo desde el principio genera más confianza que ir revelándolo por
 * partes: la persona entiende hacia dónde va la plataforma y no se pregunta si
 * le falta algo que otros sí tienen.
 */
export const SECCIONES: readonly Seccion[] = [
  { href: "/panel", etiqueta: "Inicio", icono: Home, principal: true },
  {
    href: "/calendario",
    etiqueta: "Calendario",
    icono: CalendarDays,
    principal: true,
  },
  /*
   * Aquí vive TODO lo de una evaluación: la que hay que responder y la ya
   * revisada. Hubo una sección «Resultados» aparte y se quitó — era la misma
   * cosa en dos sitios, y partirla hacía perder el hilo de dónde estaba lo que
   * uno había respondido. La misma fila pasa de «en revisión» a «resultados
   * listos» y se abre para leerla.
   */
  {
    href: "/evaluacion",
    etiqueta: "Mis evaluaciones",
    icono: ClipboardCheck,
  },
  {
    href: "/sesiones",
    etiqueta: "Mis sesiones",
    icono: NotebookPen,
    placeholder: true,
  },
  {
    href: "/recursos",
    etiqueta: "Recursos y tareas",
    icono: BookOpen,
    placeholder: true,
  },
  {
    href: "/documentos",
    etiqueta: "Documentos",
    icono: FileText,
    placeholder: true,
  },
  {
    href: "/mis-datos",
    etiqueta: "Mis datos",
    icono: UserCog,
    principal: true,
  },
];

/* ============================================================================
   Las otras dos áreas

   Viven aquí, junto a las del paciente, porque las tres alimentan la MISMA
   barra lateral. Tenerlas repartidas en tres archivos fue lo que hizo que
   cada área acabara con una navegación distinta sin que nadie lo decidiera.
   ========================================================================== */

export const SECCIONES_PROFESIONAL: readonly Seccion[] = [
  { href: "/profesional/agenda", etiqueta: "Agenda", icono: CalendarDays },
  /*
   * Lo que espera una decisión, en su propia entrada.
   *
   * Estaba dentro de la agenda, debajo del calendario. Confirmar la solicitud
   * de una empresa obligaba a entrar a una pantalla de otra cosa y buscar: es
   * la acción más frecuente del día y estaba a dos saltos de distancia.
   */
  {
    href: "/profesional/solicitudes",
    etiqueta: "Solicitudes",
    icono: Inbox,
  },
  { href: "/profesional/pacientes", etiqueta: "Pacientes", icono: Users },
  { href: "/profesional/empresas", etiqueta: "Empresas", icono: Building2 },
  {
    href: "/profesional/evaluaciones",
    etiqueta: "Evaluaciones",
    icono: ClipboardList,
    placeholder: true,
  },
  {
    href: "/profesional/documentos",
    etiqueta: "Documentos",
    icono: FileText,
    placeholder: true,
  },
  { href: "/profesional/consulta", etiqueta: "La consulta", icono: Settings },
];

export const SECCIONES_EMPRESA: readonly Seccion[] = [
  { href: "/empresa", etiqueta: "Inicio", icono: Home, exacta: true },
  { href: "/empresa/personas", etiqueta: "Personas", icono: Users },
  { href: "/empresa/sesiones", etiqueta: "Sesiones", icono: CalendarDays },
  {
    href: "/empresa/informes",
    etiqueta: "Informes",
    icono: ClipboardList,
  },
  {
    href: "/empresa/facturacion",
    etiqueta: "Facturación",
    icono: Receipt,
    placeholder: true,
  },
  { href: "/empresa/datos", etiqueta: "Datos", icono: Building2 },
];
