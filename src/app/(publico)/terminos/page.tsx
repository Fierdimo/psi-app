import type { Metadata } from "next";

import {
  PaginaLegal,
  type SeccionLegal,
} from "@/components/legal/pagina-legal";
import {
  HORAS_PARA_CANCELAR,
  identificacionDelResponsable,
  RESPONSABLE,
} from "@/lib/legal/responsable";

export const metadata: Metadata = {
  title: "Términos de uso",
  robots: { index: true, follow: true },
};

/**
 * Condiciones de uso de la plataforma.
 *
 * Deja de decir «PENDIENTE DE DEFINIR» en cancelaciones: un término de uso con
 * un hueco donde va la regla no es un término de uso, y era justo el que la
 * gente iba a mirar cuando necesitara cancelar.
 */
const SECCIONES: readonly SeccionLegal[] = [
  {
    titulo: "Qué es esta plataforma y quién la opera",
    cuerpo: [
      "Una herramienta de gestión de la consulta: sirve para consultar y solicitar citas, mantener tus datos al día y, cuando participas en un proceso de evaluación, responder el instrumento que se te aplique y recibir tu informe.",
      `La opera ${identificacionDelResponsable()}. No es un servicio de atención psicológica en sí misma ni sustituye a la consulta.`,
    ],
  },
  {
    titulo: "No es un canal de urgencias",
    cuerpo:
      "Esta plataforma no se atiende de forma continua. Si estás en una situación de crisis o de riesgo para tu vida, acude a los servicios de emergencia —línea 123 en Colombia— o a una línea de atención en crisis. No uses esta herramienta para pedir ayuda urgente: puede pasar mucho tiempo hasta que alguien lea lo que escribas.",
  },
  {
    titulo: "Tu cuenta",
    cuerpo: [
      "La cuenta es personal e intransferible. Eres responsable de mantener tu contraseña en secreto y de cerrar sesión si usas un dispositivo compartido.",
      "Si recibes un enlace de acceso porque una empresa te convocó a una evaluación, ese enlace es tuyo y solo tuyo: quien lo tenga puede entrar en tu nombre. No lo reenvíes.",
      `Si sospechas que alguien accedió a tu cuenta, cambia la contraseña y avísanos a ${RESPONSABLE.correo}.`,
    ],
  },
  {
    titulo: "Solicitar no es reservar",
    cuerpo:
      "Cuando pides una cita estás proponiendo un horario, no reservándolo. La cita solo queda comprometida cuando el profesional la confirma, y hasta entonces aparece marcada como pendiente. Te avisamos cuando cambie de estado.",
  },
  {
    titulo: "Cancelaciones y cambios",
    /*
     * Se pide antelación, no se impone.
     *
     * La plataforma deja cancelar en cualquier momento, y prometer aquí un
     * plazo que el software no aplica sería escribir una regla falsa: quien la
     * leyera creería que no puede cancelar, cancelaría igual, y aprendería que
     * este documento no describe lo que pasa. Si algún día se quiere cerrar el
     * margen de verdad, se cierra en `cancelar_cita` y esta frase cambia.
     */
    cuerpo: [
      `Puedes cancelar o pedir un cambio de fecha desde la propia cita, en tu espacio privado. Te pedimos hacerlo con al menos ${HORAS_PARA_CANCELAR} horas de antelación.`,
      "Dentro de ese margen el horario ya no puede ofrecerse a otra persona, así que avisa además directamente a la consulta. Una cancelación tardía o una inasistencia sin aviso puede tener consecuencias sobre el cobro de la sesión, según lo que hayas acordado con el profesional.",
      "Las sesiones que encarga una empresa las cancela o reprograma quien las solicitó, no cada persona convocada.",
    ],
  },
  {
    titulo: "Las evaluaciones",
    cuerpo: [
      "Participar es voluntario y se consiente evaluación por evaluación, con su propósito y su destinatario a la vista antes de empezar. Puedes negarte, y puedes aceptar más tarde si cambias de idea.",
      "Al terminar la prueba, el informe se calcula y se envía automáticamente a la empresa que la encargó, sin revisión previa. El profesional puede revisarlo y corregirlo después, y la empresa consulta siempre la versión vigente. Lo que la empresa no recibe, ni antes ni después, es tu hoja de respuestas. Todo esto se te dice antes de que respondas.",
    ],
  },
  {
    titulo: "Uso correcto",
    cuerpo:
      "No intentes acceder a información de otras personas, ni sortear los controles de la plataforma, ni usarla para algo distinto de gestionar tu atención. Responder una evaluación en nombre de otra persona invalida el resultado y puede tener consecuencias en el proceso para el que se aplicó.",
  },
  {
    titulo: "Disponibilidad",
    cuerpo:
      "Procuramos que la plataforma esté siempre disponible, pero puede haber interrupciones por mantenimiento o por causas ajenas. Una interrupción no altera tus citas ya confirmadas: si no puedes acceder, comunícate directamente con la consulta.",
  },
  {
    titulo: "Cambios en estos términos",
    cuerpo:
      "Si estos términos o el consentimiento informado cambian de forma relevante, te lo pediremos de nuevo al entrar. Se conserva registro de qué versión aceptaste y cuándo. La versión vigente es la que encabeza este documento.",
  },
  {
    titulo: "Ley aplicable",
    cuerpo: `Estos términos se rigen por la ley colombiana. El ejercicio profesional está sujeto a la Ley 1090 de 2006 y a su código deontológico, incluido el secreto profesional, y el tratamiento de datos a la Ley 1581 de 2012.`,
  },
];

export default function TerminosPage() {
  return (
    <PaginaLegal
      titulo="Términos de uso"
      entradilla="Las condiciones de uso de la plataforma y qué puedes esperar de ella."
      version="2026-08-20"
      secciones={SECCIONES}
    />
  );
}
