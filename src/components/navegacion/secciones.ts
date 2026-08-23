import {
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
  Inbox,
  Settings,
  Wallet,
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

/*
 * El área del profesional, después del giro a evaluaciones por usos.
 *
 * Se van «Agenda» y «Pacientes». No hay citas que organizar ni personas
 * atendidas a las que seguir: lo que llega son evaluaciones encargadas por
 * empresas, y lo que se decide son compras de usos.
 *
 * «Solicitudes» conserva el nombre y cambia de contenido: antes eran fechas
 * que aceptar, ahora son pagos que confirmar. Es la única decisión que queda
 * en el circuito, así que va primera.
 */
export const SECCIONES_PROFESIONAL: readonly Seccion[] = [
  {
    href: "/profesional/solicitudes",
    etiqueta: "Solicitudes",
    icono: Inbox,
  },
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

/*
 * El área de empresa, después del giro a evaluaciones por usos.
 *
 * «Personas» y «Sesiones» desaparecen, y su fusión es el cambio entero
 * resumido en un menú: ya no hay plantilla que mantener ni fechas que cuadrar.
 * Hay ENCARGOS, y cada uno lleva su persona dentro.
 *
 * Las pantallas viejas siguen existiendo unos días más —se retiran con su
 * código— pero dejan de tener entrada aquí: un menú es una declaración de qué
 * es este producto, y ya no es esto.
 */
export const SECCIONES_EMPRESA: readonly Seccion[] = [
  { href: "/empresa", etiqueta: "Inicio", icono: Home, exacta: true },
  /*
   * «Informes» tampoco sobrevive, y por una razón distinta a las otras dos:
   * no es que sobre, es que era la MISMA lista que «Evaluaciones» con otro
   * nombre. Tenía que enseñar también las no publicadas —o quien encargó
   * veinte y ve cinco no sabe si las otras quince se perdieron— y acababa
   * duplicándola. Ahora hay una fila por encargo y el informe está dentro
   * cuando existe.
   */
  {
    href: "/empresa/evaluaciones",
    etiqueta: "Evaluaciones",
    icono: ClipboardCheck,
  },
  { href: "/empresa/usos", etiqueta: "Usos", icono: Wallet },
  { href: "/empresa/datos", etiqueta: "Datos", icono: Building2 },
];
