import {
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
  Inbox,
  Settings,
  Users,
  ClipboardCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type Seccion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Aparece en la barra inferior de móvil, donde solo caben tres. */
  principal?: boolean;
  /** Activa solo con coincidencia exacta: para la raíz de un área. */
  exacta?: boolean;
};

/**
 * Mapa del área del paciente (SPEC.md §5).
 *
 * SOLO LO QUE EXISTE. Durante un tiempo el menú enseñaba también lo que estaba
 * por construir, atenuado, con la idea de que ver el mapa completo daba
 * confianza. En la práctica hace lo contrario: se pulsa, no pasa nada, y a
 * partir de ahí cada entrada del menú es sospechosa. Cuando alguna de esas
 * secciones se construya, se añade aquí.
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
  },
  {
    href: "/profesional/consulta",
    etiqueta: "Configuración",
    icono: Settings,
  },
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
  { href: "/empresa/datos", etiqueta: "Datos", icono: Building2 },
];
