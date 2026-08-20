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
  /*
   * 2026-08-20: se sube otra vez, y por el mismo motivo que la anterior.
   *
   * El informe pasa a enviarse solo al terminar la prueba, sin revisión previa
   * de un profesional. El texto prometía justo lo contrario, y un
   * consentimiento que describe un procedimiento que no ocurre no informa de
   * nada.
   *
   * 2026-08-19: se subió porque el texto dejó de ser cierto.
   *
   * Decía que aquí no se guardaba contenido clínico, y desde que existe el
   * motor de evaluaciones se guardan las respuestas de las pruebas y los
   * informes. Callaba además lo que más importa saber antes de responder: que
   * la empresa que encarga una evaluación recibe el informe.
   *
   * Subir la versión hace que todo el mundo vuelva a pasar por la pantalla de
   * aceptación, que es exactamente lo que corresponde: nadie aceptó esto.
   */
  version: "2026-08-20",
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
      "Tu nombre, correo electrónico, teléfono, fecha de nacimiento y documento de identidad, junto con las citas que solicitas o se te asignan. Si participas en una evaluación, también tus respuestas al instrumento, los resultados que calcula el sistema y el informe que se emite a partir de ellos. Lo que NO vive aquí son las notas de tus sesiones: esas las lleva tu profesional por sus propios medios.",
  },
  {
    titulo: "Son datos sensibles",
    cuerpo:
      "La información sobre tu salud y tu evaluación psicológica es un dato sensible: la ley exige tu autorización expresa para tratarla y no estás obligado a darla. Puedes negarte, y puedes retirar tu autorización más adelante.",
  },
  {
    titulo: "Para qué los usamos",
    cuerpo:
      "Únicamente para gestionar tu atención —agendar citas, avisarte de cambios— y, si participas en un proceso de evaluación, para aplicar el instrumento, calificarlo y emitir el informe. No se usan para publicidad, no se venden y no se comparten con terceros ajenos a tu atención.",
  },
  {
    titulo: "Quién puede verlos",
    cuerpo:
      "Tú y tu profesional. Ningún otro paciente puede ver tu información, y el sistema está construido para que eso no dependa de la buena voluntad de nadie: la propia base de datos rechaza cualquier intento de acceso ajeno.",
  },
  {
    titulo: "Si una empresa encarga tu evaluación",
    cuerpo:
      "Esa empresa recibe el informe completo: es la finalidad por la que la encargó. Se calcula y se le envía automáticamente en cuanto terminas la prueba, sin que un profesional lo revise antes; después puede revisarlo y corregirlo. Lo que la empresa no recibe es tu hoja de respuestas —qué marcaste en cada pregunta no sale de la consulta—. Se te vuelve a decir, y se te pide consentimiento otra vez, antes de empezar cada evaluación concreta.",
  },
  {
    titulo: "Confidencialidad en las notificaciones",
    cuerpo:
      "Los correos que te enviemos indican fecha, hora y modalidad de tu cita, y nada más. Nunca mencionan el motivo de consulta ni ningún contenido clínico, porque el asunto de un correo puede aparecer en la pantalla de bloqueo de un teléfono que otra persona esté mirando.",
  },
  {
    titulo: "Tus derechos",
    cuerpo:
      "Puedes consultar, corregir o descargar tus datos en cualquier momento desde «Mis datos», y solicitar la eliminación de tu cuenta. Ten en cuenta que la normativa de historia clínica obliga a conservar la información clínica quince años desde tu última atención: durante ese plazo permanece archivada y bajo secreto profesional aunque cierres tu cuenta.",
  },
  {
    titulo: "Retirar este consentimiento",
    cuerpo:
      "Puedes retirarlo cuando quieras escribiendo a tu profesional. Retirarlo implica dejar de usar la plataforma; no afecta a la atención que recibas por otros medios.",
  },
] as const;
