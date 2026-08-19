import type { Metadata } from "next";

import {
  PaginaLegal,
  type SeccionLegal,
} from "@/components/legal/pagina-legal";
import {
  identificacionDelResponsable,
  RESPONSABLE,
  RETENCION_ANOS,
} from "@/lib/legal/responsable";

export const metadata: Metadata = {
  title: "Política de privacidad",
  robots: { index: true, follow: true },
};

/**
 * Política de tratamiento de datos personales.
 *
 * Redactada sobre la Ley 1581 de 2012 y el Decreto 1074 de 2015: identidad del
 * responsable, finalidades, tratamiento de datos sensibles, derechos del
 * titular y canal para ejercerlos con sus plazos. Los datos de salud son
 * categoría sensible (art. 5), así que su tratamiento exige autorización
 * expresa y advertir que responderlas es facultativo.
 *
 * SE AMPLIÓ AL MOTOR DE EVALUACIONES. La versión anterior decía que aquí no se
 * guardaba contenido clínico, y dejó de ser cierto el día que la plataforma
 * empezó a guardar las respuestas de las pruebas y a emitir informes. Callar
 * que la empresa que encarga una evaluación ve el informe completo era el
 * hueco más grave: es exactamente lo que una persona necesita saber ANTES de
 * responder.
 */
const SECCIONES: readonly SeccionLegal[] = [
  {
    titulo: "Quién responde por tus datos",
    cuerpo: [
      `${identificacionDelResponsable()}, es el responsable del tratamiento de tus datos personales.`,
      `Puedes escribirle a ${RESPONSABLE.correo} o llamar al ${RESPONSABLE.telefono}. Esa dirección es también el canal para ejercer tus derechos, y quien la atiende es el propio profesional.`,
    ],
  },
  {
    titulo: "Qué datos tratamos",
    cuerpo: [
      "De identificación y contacto: nombre, apellidos, documento de identidad, correo electrónico, teléfono y fecha de nacimiento.",
      "De gestión de la atención: las citas que solicitas o se te asignan, su estado y las fechas en que cambiaron.",
      "De evaluación psicológica, cuando participas en una: tus respuestas a los instrumentos aplicados, los resultados que calcula el sistema y el informe que firma el profesional.",
      "Técnicos mínimos: la fecha, la dirección IP y el navegador desde el que aceptaste el consentimiento informado, que conservamos como prueba de esa aceptación.",
    ],
  },
  {
    titulo: "Son datos sensibles, y eso cambia las reglas",
    cuerpo: [
      "La información relacionada con tu salud y con tu evaluación psicológica es un dato sensible bajo la Ley 1581 de 2012. Por eso su tratamiento solo ocurre con tu autorización expresa, dada al aceptar el consentimiento informado y, en el caso de una evaluación, al consentirla específicamente antes de empezarla.",
      "No estás obligado a autorizar el tratamiento de datos sensibles. Puedes negarte, y puedes retirar tu consentimiento después. Lo que no podemos es aplicarte una evaluación sin él.",
    ],
  },
  {
    titulo: "Para qué los usamos",
    cuerpo:
      "Para gestionar tu atención —agendar citas, avisarte de cambios— y, si participas en un proceso de evaluación, para aplicar el instrumento, calificarlo y emitir el informe que se te entrega a ti y a quien lo encargó. Para nada más: no hay publicidad, no se venden, y en tu espacio privado no hay analítica de terceros.",
  },
  {
    titulo: "Quién ve tu informe de evaluación",
    cuerpo: [
      "Cuando una empresa encarga tu evaluación, esa empresa recibe el informe completo. Es la finalidad por la que la encargó y se te dice antes de que respondas nada, en el consentimiento de esa evaluación concreta.",
      "Lo que la empresa NO recibe es tu hoja de respuestas: qué marcaste en cada pregunta no sale de la consulta. Contrató un informe profesional, no el material en bruto.",
      "Ningún resultado llega a nadie de forma automática. El profesional lo revisa y lo firma antes de que exista para alguien más, y si retiras tu consentimiento antes de esa firma, el informe no se publica.",
    ],
  },
  {
    titulo: "Con quién más se comparten",
    cuerpo:
      "Con nadie ajeno a tu atención. Los proveedores que alojan la base de datos y envían los correos actúan como encargados del tratamiento, solo procesan lo necesario para prestar ese servicio y están sujetos a obligaciones de confidencialidad. Fuera de eso, solo se entregarían datos ante un requerimiento de autoridad competente, en los casos y con las formalidades que la ley exige.",
  },
  {
    titulo: "Cuánto tiempo se conservan",
    cuerpo: [
      `La información clínica y de evaluación se conserva ${RETENCION_ANOS} años contados desde tu última atención, que es el plazo que impone la normativa de historia clínica. No es una decisión nuestra y manda sobre una solicitud de borrado: si pides eliminar tu cuenta, se cierra tu acceso y se suprime lo que no esté sujeto a ese deber, pero la historia clínica permanece archivada y bajo secreto profesional hasta cumplirlo.`,
      "Los datos que solo sirven para contactarte se suprimen cuando dejan de hacer falta.",
    ],
  },
  {
    titulo: "Tus derechos y cómo ejercerlos",
    cuerpo: [
      "Puedes conocer, actualizar y rectificar tus datos; pedir prueba de la autorización que diste; ser informado sobre el uso que se les ha dado; presentar quejas ante la Superintendencia de Industria y Comercio; y revocar la autorización o pedir la supresión cuando no exista un deber legal de conservar.",
      "Acceder, corregir y descargar tus datos lo puedes hacer tú mismo, ahora, desde «Mis datos» en tu espacio privado. Para lo demás, escribe a " +
        RESPONSABLE.correo +
        ". Las consultas se responden en un máximo de diez días hábiles y los reclamos en quince días hábiles, prorrogables por una sola vez, como fija la ley.",
    ],
  },
  {
    titulo: "Cómo protegemos la información",
    cuerpo: [
      "El tráfico viaja cifrado y los datos se almacenan cifrados en reposo. El control de acceso no depende del código de la aplicación: está implementado en la propia base de datos, de modo que ninguna persona puede alcanzar la información de otra aunque una parte del sistema fallara.",
      "Cada cambio de estado de una cita queda registrado con su autor y su fecha, y lo mismo ocurre con las aceptaciones de consentimiento.",
    ],
  },
  {
    titulo: "Confidencialidad de las notificaciones",
    cuerpo:
      "Los correos que te enviamos contienen únicamente fecha, hora y modalidad de tu cita, o el aviso de que tienes una evaluación disponible. Nunca mencionan el motivo de consulta, ningún resultado ni ningún contenido clínico, porque el asunto de un correo puede quedar visible en la pantalla de un teléfono que esté mirando otra persona.",
  },
  {
    titulo: "Cambios en esta política",
    cuerpo:
      "Si cambia de forma relevante, te lo pediremos de nuevo al entrar y quedará registro de qué versión aceptaste y cuándo. La versión vigente es la que encabeza este documento.",
  },
];

export default function PrivacidadPage() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      entradilla="Qué datos recogemos, para qué los usamos, quién los ve y qué puedes hacer con ellos."
      version="2026-08-19"
      secciones={SECCIONES}
    />
  );
}
