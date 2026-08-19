/**
 * Quién responde por los datos, y las decisiones que los documentos citan.
 *
 * Vive en un solo sitio porque aparece en tres: la política de privacidad, los
 * términos y el consentimiento informado. Repetido en cada uno, el día que
 * cambie el correo de contacto quedarán dos documentos diciendo una cosa y uno
 * diciendo otra — y el que se equivoque será justo el que alguien use para
 * ejercer un derecho.
 *
 * REVISIÓN LEGAL: el contenido de los documentos se redactó sobre la Ley 1581
 * de 2012 y el Decreto 1074 de 2015 (habeas data), la Ley 1090 de 2006
 * (ejercicio de la psicología y secreto profesional) y la Resolución 839 de
 * 2017 (conservación de historia clínica). No sustituye la revisión de un
 * abogado antes de atender a la primera persona real.
 */
export const RESPONSABLE = {
  nombre: "Jesús Banquez Ramírez",
  /** La marca con la que se presenta la consulta. */
  marca: "JBR Psicometrías",
  profesion: "Psicólogo",
  ciudad: "Cartagena de Indias, Bolívar",
  pais: "Colombia",
  correo: "psicologojbr@gmail.com",
  telefono: "+57 300 216 3389",

  /**
   * Datos que solo el titular puede aportar y que los documentos muestran
   * únicamente si existen.
   *
   * Se dejan vacíos en vez de inventados: un número de tarjeta profesional
   * equivocado en un documento legal es peor que su ausencia. Al rellenarlos
   * aquí aparecen solos en las tres páginas.
   */
  tarjetaProfesional: "",
  direccion: "",
} as const;

/**
 * Cuánto se conserva la información clínica.
 *
 * No es una decisión de producto: la normativa de historia clínica obliga a
 * conservarla quince años desde la última atención —cinco en archivo de
 * gestión y diez en archivo central— y eso manda sobre cualquier petición de
 * borrado. Por eso el documento lo dice con el número delante, en vez de
 * «durante el plazo legal aplicable», que no le dice nada a nadie.
 */
export const RETENCION_ANOS = 15;

/**
 * Con cuánta antelación se puede cancelar sin más.
 *
 * Es una decisión de la consulta, no una obligación legal, y estaba sin fijar:
 * el documento decía «PENDIENTE DE DEFINIR», que en un término de uso equivale
 * a no tener término. Veinticuatro horas es lo habitual y deja margen para
 * ofrecer el hueco a otra persona.
 */
export const HORAS_PARA_CANCELAR = 24;

/** Cómo se nombra al responsable en un párrafo, con lo que haya disponible. */
export function identificacionDelResponsable(): string {
  const partes = [
    `${RESPONSABLE.nombre}, ${RESPONSABLE.profesion.toLowerCase()}`,
    RESPONSABLE.tarjetaProfesional
      ? `con tarjeta profesional ${RESPONSABLE.tarjetaProfesional}`
      : null,
    `que ejerce bajo la marca ${RESPONSABLE.marca}`,
    RESPONSABLE.direccion
      ? `con dirección en ${RESPONSABLE.direccion}, ${RESPONSABLE.ciudad}, ${RESPONSABLE.pais}`
      : `con domicilio en ${RESPONSABLE.ciudad}, ${RESPONSABLE.pais}`,
  ].filter(Boolean);

  return partes.join(", ");
}
