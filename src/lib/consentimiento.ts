import type { SeccionLegal } from "@/components/legal/pagina-legal";
import {
  identificacionDelResponsable,
  RESPONSABLE,
  RETENCION_ANOS,
} from "@/lib/legal/responsable";

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
 *
 * REVISIÓN LEGAL: como el resto de los documentos, esto se redactó sobre la
 * Ley 1581 de 2012 (habeas data), la Ley 1090 de 2006 y la Resolución 839 de
 * 2017. No sustituye la revisión de un abogado antes de evaluar a la primera
 * persona real.
 */
export const CONSENTIMIENTO = {
  clave: "consentimiento_informado",
  /*
   * 2026-08-23: reescrito ENTERO, y esta vez no por un párrafo que dejó de ser
   * cierto sino porque el documento le hablaba a alguien que ya no existe.
   *
   * Describía a un paciente de la consulta: sus citas, su profesional, «Mis
   * datos», cerrar su cuenta. Después del giro a evaluaciones por encargo,
   * quien firma esto no tiene nada de eso —no tiene ni cuenta— y más de la
   * mitad del texto no le correspondía.
   *
   * Y arrastraba un problema peor, que solo se ve leyendo las dos pantallas
   * juntas: el texto que de verdad leía quien respondía estaba ESCRITO A MANO
   * DENTRO DEL COMPONENTE, mientras la versión que se guardaba como evidencia
   * salía de este archivo. Se registraba haber aceptado una redacción que esa
   * persona nunca vio. Ahora hay un solo texto y las dos pantallas lo leen de
   * aquí.
   *
   * 2026-08-20: el informe pasó a enviarse solo al terminar, sin revisión
   * previa, y el texto prometía lo contrario.
   *
   * 2026-08-19: decía que aquí no se guardaba contenido clínico, y desde el
   * motor de evaluaciones se guardan respuestas e informes.
   */
  version: "2026-08-23",
} as const;

/**
 * El documento, con el nombre de quien encarga dentro.
 *
 * Es una función y no una constante porque el primer apartado tiene que decir
 * QUIÉN pide la evaluación: «te evalúan por encargo de alguien» sin nombrarlo
 * informa a medias, y es lo primero que cualquiera quiere saber.
 *
 * Que el texto lleve un hueco no rompe la evidencia: la versión identifica la
 * redacción y la evaluación identifica a la empresa. Las dos quedan guardadas
 * en la misma fila de `consents`.
 *
 * Sin empresa —la consulta pública del documento— el hueco se lee en genérico.
 */
export function seccionesDelConsentimiento(
  empresa?: string | null,
): readonly SeccionLegal[] {
  const quien = empresa?.trim() || "la empresa que encarga la evaluación";

  return [
    {
      titulo: "Quién te evalúa, y por encargo de quién",
      cuerpo: [
        `${quien} contrató esta evaluación con ${identificacionDelResponsable()}.`,
        "No eres paciente de esta consulta ni se te está ofreciendo un tratamiento. Lo que ocurre aquí empieza y termina con esta evaluación.",
      ],
    },
    {
      titulo: "Qué se te va a pedir",
      cuerpo: [
        "Responder un cuestionario sobre tu forma de comportarte y de trabajar. No hay respuestas correctas ni incorrectas: lo que se mide es tu perfil, no tu acierto.",
        "Se responde de una sentada y sin interrupciones. Si la prueba tiene un tiempo límite, se te dice antes de empezar y empieza a contar cuando pulsas «empezar».",
      ],
    },
    {
      titulo: "Qué datos se guardan",
      cuerpo: [
        "Tu nombre y tu correo electrónico, y tu documento de identidad si la empresa lo aportó al convocarte. Junto a ellos, tus respuestas, los resultados que calcula el sistema y el informe que se emite a partir de ellos.",
        "No se te pide ningún dato más, y nada de lo que no aparezca en esta lista se recoge en esta pantalla.",
      ],
    },
    {
      titulo: "Se conservan, y para poder consultarlos después",
      cuerpo: [
        `Tu informe queda archivado y ${quien} puede volver a consultarlo meses o años después: esa es una de las razones por las que lo encargó.`,
        `La información de una evaluación psicológica se conserva ${RETENCION_ANOS} años desde la última atención, porque la normativa de historia clínica lo exige. Durante ese plazo permanece archivada y bajo secreto profesional.`,
      ],
    },
    {
      titulo: "Quién recibe el informe",
      cuerpo: [
        `${quien}, completo. Es la finalidad por la que lo encargó.`,
        "Se calcula y se le envía automáticamente en cuanto terminas de responder, sin que un profesional lo revise antes. Después puede revisarlo y corregirlo, y en ese caso la empresa ve la versión corregida.",
      ],
    },
    {
      titulo: "Tu copia se te muestra UNA VEZ, al terminar",
      cuerpo: [
        "En cuanto envías tus respuestas, tu informe aparece en pantalla. Guárdalo o imprímelo en ese momento.",
        "Tu enlace de acceso queda cerrado ahí mismo y no vuelve a abrirse. No es un descuido: ese enlace viaja por correo, se imprime en un código QR y se queda en el historial del navegador, y mientras siguiera abriendo tu informe cualquiera que lo tuviera podría leerlo.",
        `Si lo pierdes, tendrás que pedírselo a ${quien}, o ejercer tu derecho de acceso escribiendo a ${RESPONSABLE.correo}.`,
      ],
    },
    {
      titulo: "Qué se compromete a hacer la empresa con tu informe",
      cuerpo: [
        `Desde que lo recibe, ${quien} responde de ese documento: se obliga a protegerlo, a no difundirlo fuera del proceso para el que te evaluó y a no usarlo para ninguna otra finalidad. Lo acepta expresamente al contratar el servicio.`,
        "Es importante que sepas lo que eso significa y lo que no: es un compromiso que la empresa asume, no algo que esta plataforma pueda vigilar. Una vez enviado el informe, lo que se haga con él ocurre fuera de aquí.",
      ],
    },
    {
      titulo: "Qué NO sale de la consulta",
      cuerpo: [
        "Tu hoja de respuestas. Qué marcaste en cada pregunta no se le entrega a nadie: la empresa contrató un informe, no tus respuestas.",
      ],
    },
    {
      titulo: "No tienes una cuenta aquí",
      cuerpo: [
        "No se te ha creado ningún usuario y no hay ninguna contraseña que buscar. El enlace que recibiste es tu único acceso, y deja de servir cuando terminas.",
        "Tampoco se guarda un historial tuyo entre empresas: si otra te evalúa mañana, para el sistema es otra evaluación y no se cruza con esta.",
      ],
    },
    {
      titulo: "Puedes negarte, y a quién escribir",
      cuerpo: [
        "Tu participación es voluntaria. Puedes negarte ahora, o aceptar ahora y retirar tu consentimiento antes de enviar la prueba. Al enviarla el informe sale de inmediato: a partir de ese momento, retirarlo ya no lo detiene.",
        "También puedes cerrar esta página sin responder y volver cuando quieras, dentro del plazo de tu enlace. No pasa nada y nadie recibe aviso.",
        `Para consultar, corregir o pedir la supresión de tus datos, o para cualquier duda sobre este documento, escribe a ${RESPONSABLE.correo} o llama al ${RESPONSABLE.telefono}.`,
      ],
    },
  ];
}

/**
 * El documento en genérico, para su consulta pública.
 *
 * Es el MISMO texto que se firma; lo único que cambia es que el nombre de la
 * empresa no está resuelto porque ahí no hay ninguna evaluación de por medio.
 */
export const SECCIONES_CONSENTIMIENTO = seccionesDelConsentimiento(null);
