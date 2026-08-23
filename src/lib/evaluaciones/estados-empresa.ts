/**
 * Los estados de una evaluación, dichos para la empresa.
 *
 * No son los mismos nombres que ve el profesional, y no por adorno: entre
 * `enviada` y `calificada` hay una diferencia de proceso —una está por
 * puntuar, la otra por firmar— que a quien encargó la evaluación no le sirve
 * de nada y le invita a preguntar por un trámite que no es suyo. Desde fuera
 * las dos son lo mismo: se está preparando el informe.
 *
 * Se traduce aquí y no en cada pantalla porque el mismo estado aparece en el
 * listado, en la ficha y en el inicio, y tres traducciones distintas de lo
 * mismo es como empieza a divergir el vocabulario de un producto.
 */
export type TonoEstado = "success" | "warning" | "neutral";

export const ESTADO_PARA_LA_EMPRESA: Record<
  string,
  { texto: string; tono: TonoEstado; explicacion: string }
> = {
  asignada: {
    texto: "Sin empezar",
    tono: "neutral",
    explicacion: "Ya tiene su enlace. Todavía no lo ha abierto.",
  },
  en_curso: {
    texto: "Respondiendo",
    tono: "neutral",
    explicacion: "Aceptó las condiciones y está contestando.",
  },
  enviada: {
    texto: "Preparando informe",
    tono: "warning",
    explicacion: "Terminó de responder. El informe llegará por correo.",
  },
  calificada: {
    texto: "Preparando informe",
    tono: "warning",
    explicacion: "Terminó de responder. El informe llegará por correo.",
  },
  publicada: {
    texto: "Informe listo",
    tono: "success",
    explicacion: "Disponible en «Informes».",
  },
  vencida: {
    texto: "Vencida",
    tono: "neutral",
    explicacion: "El plazo del enlace pasó sin que respondiera.",
  },
  anulada: {
    texto: "Anulada",
    tono: "neutral",
    explicacion: "Se retiró antes de completarse.",
  },
};

export function estadoParaLaEmpresa(status: string) {
  return (
    ESTADO_PARA_LA_EMPRESA[status] ?? {
      texto: status,
      tono: "neutral" as const,
      explicacion: "",
    }
  );
}

/** Las que ya no esperan nada de nadie. */
export const ESTADOS_CERRADOS = ["publicada", "vencida", "anulada"];

/* ============================================================================
   El filtro por estado

   Los grupos NO son uno por estado, y esa es la decisión. La empresa ve seis
   etiquetas distintas en la columna, pero solo tres preguntas la traen a
   filtrar: quién falta por responder, qué informes hay, y qué se quedó por el
   camino. Un filtro con un botón por estado obliga a leer seis opciones para
   contestar tres preguntas.

   Los grupos son EXHAUSTIVOS a propósito: todo estado cae en alguno. Un filtro
   que deja filas fuera de todos sus grupos hace que alguien cuente las de
   «Todas», no le cuadre, y deje de fiarse del filtro entero.
   ========================================================================== */

export type VistaEvaluaciones =
  "todas" | "pendientes" | "preparando" | "listas" | "cerradas";

export const VISTAS_EMPRESA: {
  clave: VistaEvaluaciones;
  texto: string;
  /** Vacío en «todas»: no filtra. */
  estados: string[];
}[] = [
  { clave: "todas", texto: "Todas", estados: [] },
  {
    clave: "pendientes",
    texto: "Sin responder",
    estados: ["asignada", "en_curso"],
  },
  /*
   * Casi siempre vacío, y aun así está.
   *
   * El informe se califica y se publica solo al enviar la prueba, así que este
   * grupo dura segundos. Existe para los casos en que el motor falla y la
   * evaluación se queda esperando: son justo las que alguien va a venir a
   * buscar, y sin su grupo estarían solo en «Todas».
   */
  {
    clave: "preparando",
    texto: "Preparando informe",
    estados: ["enviada", "calificada"],
  },
  { clave: "listas", texto: "Informe listo", estados: ["publicada"] },
  {
    clave: "cerradas",
    texto: "Sin completar",
    estados: ["vencida", "anulada"],
  },
];

export function esVistaEmpresa(valor: unknown): valor is VistaEvaluaciones {
  return VISTAS_EMPRESA.some((v) => v.clave === valor);
}

export function estadosDeVista(vista: VistaEvaluaciones): string[] {
  return VISTAS_EMPRESA.find((v) => v.clave === vista)?.estados ?? [];
}
