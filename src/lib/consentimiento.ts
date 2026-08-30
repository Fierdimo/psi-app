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
   * 2026-08-30: el informe deja de enviarse por correo a la persona evaluada.
   *
   * DECISIÓN DEL CLIENTE. Los resultados los recibe únicamente la empresa que
   * encargó la evaluación; a quien responde le llega un acuse de recibo que
   * confirma que terminó y le dice con quién sigue el proceso. Ni el correo
   * lleva el PDF ni la pantalla del final ofrece descargarlo: los dos caminos
   * se cierran a la vez, porque cerrar uno solo no cambiaba nada.
   *
   * Se sube la versión, y este es el caso más claro de todos los que ha tenido
   * este archivo: el apartado «Tu copia» prometía un PDF en el correo. Quien
   * aceptó la redacción anterior lo hizo contando con esa copia, así que no
   * basta con cambiar el texto — tiene que volver a pasar por la pantalla.
   *
   * LO QUE NO CAMBIA, y por eso el apartado sigue existiendo con otro nombre:
   * el derecho de acceso. Que el informe no salga de oficio no lo suprime; se
   * pide al responsable y se entrega. Dejar de enviarlo es legítimo, negarlo
   * no lo sería, y el documento tiene que decir cuál de las dos cosas es — con
   * la dirección delante, no como una fórmula.
   *
   * 2026-08-24.3: el informe deja de mostrarse en pantalla al terminar.
   *
   * DECISIÓN DEL CLIENTE. El apartado «Tu copia» prometía que el informe
   * aparecía en pantalla en cuanto se enviaban las respuestas, y ahora esa
   * pantalla es una despedida: dice a dónde salió el PDF, quién va a escribir
   * y que se puede cerrar la página.
   *
   * Se sube la versión porque es exactamente el caso para el que existe el
   * versionado: prometer una pantalla que ya no aparece es informar mal, y
   * alguien podría dar por perdido su informe al no verlo salir.
   *
   * 2026-08-24.2: se añade el «Certifico que».
   *
   * El documento DESCRIBÍA —qué datos se guardan, quién recibe el informe— y
   * la persona no declaraba nada. Un consentimiento es un acto de voluntad, y
   * sin una parte en primera persona se lee como un aviso legal que se acepta
   * por inercia. El documento que la consulta entrega en papel lo tiene desde
   * siempre; faltaba aquí.
   *
   * Es LITERALMENTE el del documento en papel, a petición del cliente y con
   * un motivo que pesa: quien ya firmó uno de estos en un proceso anterior
   * tiene que reconocer el mismo texto. Lo único que no va escrito a mano es
   * el nombre y la marca del profesional, que salen de `RESPONSABLE` para que
   * no haya un documento diciendo una cosa y dos diciendo otra.
   *
   * El sufijo `.2` porque es el segundo cambio del mismo día y la versión
   * tiene que distinguir dos redacciones, no dos fechas.
   *
   * 2026-08-24: el informe pasa a enviarse por correo, en PDF, a la empresa y
   * a la persona evaluada.
   *
   * El texto decía que su copia se le mostraba UNA SOLA VEZ y que si la perdía
   * tendría que pedírsela a la empresa. Dejó de ser cierto —ahora le llega
   * adjunta a su correo— y un consentimiento que promete de menos informa tan
   * mal como uno que promete de más: alguien podría negarse a responder
   * creyendo que no va a conservar nada.
   *
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
  version: "2026-08-30",
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
        `Solo ${quien}, completo y en PDF por correo. Es la finalidad por la que lo encargó.`,
        "Se calcula y se le envía automáticamente en cuanto terminas de responder, sin que un profesional lo revise antes. Después puede revisarlo y corregirlo, y en ese caso la empresa ve la versión corregida en la plataforma.",
        `A ti se te escribe para confirmarte que la prueba quedó completa, y ese correo no lleva los resultados dentro. A partir de ahí el proceso continúa con ${quien}: es a quien tienes que preguntar por los siguientes pasos.`,
      ],
    },
    {
      titulo: "Tu copia: se pide, y se te entrega",
      cuerpo: [
        "El informe no se muestra en pantalla ni se te envía por correo. Al terminar recibes la confirmación de que la prueba quedó completa, y nada más.",
        `Eso no te deja fuera de tus propios datos: puedes pedir tu informe cuando quieras escribiendo a ${RESPONSABLE.correo}, y se te entrega. Es tu derecho de acceso y no se pierde con el tiempo ni depende de que lo hubieras guardado. También puedes pedírselo a ${quien}.`,
        "Tu enlace de acceso queda cerrado al enviar las respuestas y no vuelve a abrirse. No es un descuido: ese enlace viaja por correo, se imprime en un código QR y se queda en el historial del navegador, y mientras siguiera abriendo tu evaluación cualquiera que lo tuviera podría entrar con tu nombre.",
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
      /*
       * El cierre en primera persona.
       *
       * Cada punto se corresponde con un apartado de arriba, en el mismo
       * orden, y no dice nada que el documento no haya explicado antes: un
       * «reconozco que comprendo» sobre algo no explicado es una firma en
       * blanco. Por eso se escribió después del resto y no antes.
       */
      titulo: "Certifico que",
      cuerpo: [
        "1. Reconozco: que he sido informado(a) y comprendo completamente el propósito, los procedimientos y los posibles beneficios y riesgos asociados con la evaluación psicológica y psicotécnica que voy a someterme como parte del proceso de selección.",
        "2. Propósito: Entiendo que el propósito de esta evaluación es obtener información sobre mis habilidades, competencias, personalidad y aptitudes relevantes para el puesto al que estoy aplicando. Comprendo que esta evaluación ayudará a la empresa a tomar decisiones informadas sobre mi idoneidad para el puesto.",
        "3. Procedimientos: Reconozco que la evaluación psicológica y psicotécnica puede incluir una variedad de pruebas, cuestionarios y ejercicios diseñados para evaluar diferentes aspectos de mi personalidad, habilidades cognitivas y aptitudes. Acepto participar activamente en todas las actividades propuestas durante el proceso de evaluación.",
        "4. Confidencialidad: Entiendo que toda la información recopilada durante este proceso será tratada de manera confidencial y solo será accesible para el equipo de selección designado. Acepto que mis resultados puedan ser utilizados únicamente con fines de evaluación en el contexto de este proceso de selección.",
        "5. Beneficios y Riesgos: Reconozco que la evaluación psicológica y psicotécnica puede proporcionar información valiosa tanto para la empresa como para mí mismo(a), ayudando a garantizar una mejor coincidencia entre mis habilidades y el puesto. Sin embargo, entiendo que los resultados de la evaluación pueden no siempre reflejar completamente mi capacidad o idoneidad para el trabajo. Además, comprendo que podría experimentar cierto nivel de estrés o incomodidad durante el proceso de evaluación.",
        "6. Voluntariedad y Retirada: Afirmo que mi participación en esta evaluación es voluntaria y que tengo derecho a retirar mi consentimiento en cualquier momento sin consecuencias negativas para mi proceso de selección. Entiendo que puedo solicitar más información en cualquier momento y que puedo abstenerme de responder cualquier pregunta o participar en cualquier ejercicio con el que no me sienta cómodo(a).",
        "Al ACEPTAR la participación en este formulario, certifico que he leído y comprendido completamente la información proporcionada y que doy mi consentimiento para participar en el proceso de evaluación psicológica y psicotécnica descrito anteriormente.",
        /*
         * El nombre y la marca salen de `RESPONSABLE` y no van escritos aquí,
         * que es la única desviación respecto al documento en papel. El texto
         * resultante se lee igual, y evita que el día que cambie un dato haya
         * un documento diciendo una cosa y dos diciendo otra — que es
         * exactamente para lo que existe ese módulo.
         */
        `Por la presente doy conocimiento a ${RESPONSABLE.marca.toUpperCase()}, y al ${RESPONSABLE.nombre.toUpperCase()} - ${RESPONSABLE.profesion.toUpperCase()}, a realizar el proceso de DILIGENCIAMIENTO Y EVALUACIÓN. Manifiesto conocer las normas de funcionamiento del mismo y estar satisfecho(a) con las explicaciones que se me han brindado por lo cual ACEPTO participar colaborativamente.`,
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
