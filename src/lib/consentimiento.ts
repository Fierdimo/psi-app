/**
 * Consentimiento informado vigente.
 *
 * La VERSIÓN es lo importante (PLAN.md §5.3). Si el texto cambia, se sube la
 * versión aquí y todo el mundo vuelve a pasar por la pantalla de aceptación.
 * Los consentimientos anteriores quedan registrados con su versión propia, de
 * modo que siempre se puede demostrar qué redacción exacta aceptó cada persona
 * y cuándo. Un booleano «aceptó = true» no sirve como evidencia.
 *
 * REGLA: no edites el texto sin subir la versión.
 */
export const CONSENTIMIENTO = {
  clave: "consentimiento_informado",
  version: "2026-08-11",
} as const;

/**
 * Contenido del documento. Vive en código y no en la base para que quede bajo
 * control de versiones: el historial de git es parte de la evidencia.
 */
export const SECCIONES_CONSENTIMIENTO = [
  {
    titulo: "Qué es esta plataforma",
    cuerpo:
      "Un espacio privado donde puedes consultar tus citas, gestionar tus datos de contacto y acceder al material que tu profesional decida compartir contigo. No sustituye a la consulta ni es un canal de urgencias.",
  },
  {
    titulo: "Qué datos recogemos",
    cuerpo:
      "Tu nombre, correo electrónico, teléfono, fecha de nacimiento y documento de identidad, junto con las citas que solicitas o se te asignan. No registramos aquí el contenido de tus sesiones: las notas clínicas son responsabilidad de tu profesional y no viven en esta plataforma.",
  },
  {
    titulo: "Para qué los usamos",
    cuerpo:
      "Únicamente para gestionar tu atención: agendar citas, avisarte de cambios y permitir que tu profesional organice su consulta. No se usan para publicidad, no se venden y no se comparten con terceros ajenos a tu atención.",
  },
  {
    titulo: "Quién puede verlos",
    cuerpo:
      "Tú y tu profesional. Nadie más. Ningún otro paciente puede ver tu información, y el sistema está construido para que eso no dependa de la buena voluntad de nadie: la propia base de datos rechaza cualquier intento de acceso ajeno.",
  },
  {
    titulo: "Confidencialidad en las notificaciones",
    cuerpo:
      "Los correos que te enviemos indican fecha, hora y modalidad de tu cita, y nada más. Nunca mencionan el motivo de consulta ni ningún contenido clínico, porque el asunto de un correo puede aparecer en la pantalla de bloqueo de un teléfono que otra persona esté mirando.",
  },
  {
    titulo: "Tus derechos",
    cuerpo:
      "Puedes consultar, corregir o descargar tus datos en cualquier momento desde «Mis datos», y solicitar la eliminación de tu cuenta. Ten en cuenta que tu profesional puede tener la obligación legal de conservar cierta información clínica durante un plazo determinado, aun después de que cierres tu cuenta.",
  },
  {
    titulo: "Retirar este consentimiento",
    cuerpo:
      "Puedes retirarlo cuando quieras escribiendo a tu profesional. Retirarlo implica dejar de usar la plataforma; no afecta a la atención que recibas por otros medios.",
  },
] as const;
