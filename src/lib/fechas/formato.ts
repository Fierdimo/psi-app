import { DateTime, Interval, Settings } from "luxon";

/**
 * Capa de fechas (PLAN.md §10).
 *
 * REGLA ÚNICA: toda fecha que llega de la base es un instante en UTC
 * (`timestamptz`) y toda fecha que se muestra se convierte a la zona del
 * PERFIL, nunca a la del navegador.
 *
 * En Latinoamérica esto no es teórico. Un paciente que viaja entre países, o
 * que migró y no actualizó su equipo, pierde una sesión por una diferencia de
 * una hora. El error clásico es formatear con `new Date()`, que usa la zona
 * del dispositivo sin avisar de nada.
 *
 * Por eso este módulo no exporta nada que acepte una zona implícita: todas las
 * funciones piden la zona como argumento obligatorio.
 */

Settings.defaultLocale = "es";

/** Convierte un instante ISO de la base a la zona indicada. */
export function enZona(iso: string, zona: string): DateTime {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(zona);
}

export function ahoraEn(zona: string): DateTime {
  return DateTime.now().setZone(zona);
}

/** «martes 18 de agosto» */
export function fechaLarga(iso: string, zona: string) {
  return enZona(iso, zona).toFormat("cccc d 'de' LLLL");
}

/** «martes 18 de agosto de 2026» */
export function fechaCompleta(iso: string, zona: string) {
  return enZona(iso, zona).toFormat("cccc d 'de' LLLL 'de' yyyy");
}

/** «18 ago» */
export function fechaCorta(iso: string, zona: string) {
  return enZona(iso, zona).toFormat("d LLL");
}

/** «10:00» — siempre 24 h: en contexto clínico el a. m./p. m. se presta a error. */
export function hora(iso: string, zona: string) {
  return enZona(iso, zona).toFormat("HH:mm");
}

/** «10:00 – 11:00» */
export function rangoHorario(inicioISO: string, finISO: string, zona: string) {
  return `${hora(inicioISO, zona)} – ${hora(finISO, zona)}`;
}

/**
 * Distancia en lenguaje natural: «en 6 días», «mañana», «hace 2 semanas».
 *
 * Se calcula sobre el inicio del día, no sobre el instante: si son las 23:00
 * y la cita es a las 9:00 de mañana, «en 10 horas» es técnicamente cierto y
 * mentalmente inútil. La gente piensa en días.
 */
export function distanciaEnDias(iso: string, zona: string) {
  const objetivo = enZona(iso, zona).startOf("day");
  const hoy = ahoraEn(zona).startOf("day");
  const dias = Math.round(objetivo.diff(hoy, "days").days);

  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias === -1) return "Ayer";
  if (dias > 1 && dias < 7) return `En ${dias} días`;
  if (dias >= 7 && dias < 14) return "La próxima semana";
  if (dias > 0) return `En ${dias} días`;
  if (dias > -7) return `Hace ${Math.abs(dias)} días`;
  return `Hace ${Math.abs(Math.round(dias / 7))} semanas`;
}

/** Etiqueta de la zona activa para la cabecera: «Hora de Bogotá · GMT−5». */
export function etiquetaZonaActiva(zona: string) {
  const ahora = ahoraEn(zona);
  const ciudad = zona.split("/").at(-1)?.replace(/_/g, " ") ?? zona;
  // El signo menos tipográfico (−) evita que el guion se confunda con un rango.
  const desfase = ahora.toFormat("ZZ").replace("-", "−").replace(":00", "");
  return `Hora de ${ciudad} · GMT${desfase}`;
}

/* ============================================================================
   Rangos de las vistas del calendario
   ========================================================================== */

export type Vista = "agenda" | "mes" | "semana" | "dia";

export const VISTAS: readonly Vista[] = ["agenda", "mes", "semana", "dia"];

export function esVista(valor: string | undefined): valor is Vista {
  return VISTAS.includes(valor as Vista);
}

/** Fecha de referencia de la vista, a partir del parámetro de la URL. */
export function fechaDeReferencia(param: string | undefined, zona: string) {
  if (param) {
    const parseada = DateTime.fromISO(param, { zone: zona });
    if (parseada.isValid) return parseada.startOf("day");
  }
  return ahoraEn(zona).startOf("day");
}

/**
 * Intervalo que cubre una vista.
 *
 * La agenda mira hacia delante 120 días: es la pregunta que realmente se hace
 * un paciente («¿cuándo es lo próximo?»), no «qué pasó en marzo».
 */
export function intervaloDeVista(vista: Vista, referencia: DateTime): Interval {
  switch (vista) {
    case "mes":
      return Interval.fromDateTimes(
        referencia.startOf("month").startOf("week"),
        referencia.endOf("month").endOf("week"),
      );
    case "semana":
      return Interval.fromDateTimes(
        referencia.startOf("week"),
        referencia.endOf("week"),
      );
    case "dia":
      return Interval.fromDateTimes(
        referencia.startOf("day"),
        referencia.endOf("day"),
      );
    case "agenda":
      return Interval.fromDateTimes(
        referencia.startOf("day"),
        referencia.plus({ days: 120 }).endOf("day"),
      );
  }
}

/** Título del periodo mostrado: «Agosto 2026», «11 – 17 de agosto». */
export function tituloDePeriodo(vista: Vista, referencia: DateTime) {
  switch (vista) {
    case "mes":
      return capitalizar(referencia.toFormat("LLLL yyyy"));
    case "semana": {
      const inicio = referencia.startOf("week");
      const fin = referencia.endOf("week");
      return inicio.month === fin.month
        ? `${inicio.day} – ${fin.day} de ${inicio.toFormat("LLLL yyyy")}`
        : `${inicio.toFormat("d 'de' LLL")} – ${fin.toFormat("d 'de' LLL yyyy")}`;
    }
    case "dia":
      return capitalizar(referencia.toFormat("cccc d 'de' LLLL"));
    case "agenda":
      return "Próximas citas";
  }
}

/** Referencia desplazada un periodo hacia delante o atrás. */
export function desplazar(vista: Vista, referencia: DateTime, pasos: number) {
  switch (vista) {
    case "mes":
      return referencia.plus({ months: pasos });
    case "semana":
      return referencia.plus({ weeks: pasos });
    case "dia":
      return referencia.plus({ days: pasos });
    case "agenda":
      return referencia.plus({ months: pasos });
  }
}

/** Los días de la retícula mensual, de lunes a domingo. */
export function diasDeLaRejilla(referencia: DateTime): DateTime[] {
  const intervalo = intervaloDeVista("mes", referencia);
  const dias: DateTime[] = [];
  let cursor = intervalo.start!;
  while (cursor < intervalo.end!) {
    dias.push(cursor);
    cursor = cursor.plus({ days: 1 });
  }
  return dias;
}

export function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Iniciales de los días para la cabecera de la retícula. */
export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Franja horaria visible en las vistas de semana y día. */
export const HORA_INICIO_JORNADA = 7;
export const HORA_FIN_JORNADA = 21;
