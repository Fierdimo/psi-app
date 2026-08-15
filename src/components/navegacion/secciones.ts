import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
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
   * Va antes que «Resultados» a propósito: primero lo que hay que hacer,
   * después lo que hay que leer. Y no lleva `placeholder` porque, a diferencia
   * de las de abajo, esta sección ya funciona.
   */
  {
    href: "/evaluacion",
    etiqueta: "Mis evaluaciones",
    icono: ClipboardCheck,
  },
  {
    href: "/resultados",
    etiqueta: "Resultados",
    icono: ClipboardList,
    placeholder: true,
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
