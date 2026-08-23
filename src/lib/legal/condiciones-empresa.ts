import type { SeccionLegal } from "@/components/legal/pagina-legal";
import { RESPONSABLE, RETENCION_ANOS } from "@/lib/legal/responsable";

/**
 * Las condiciones que acepta una empresa cliente.
 *
 * EXISTE POR UNA FRASE DEL CONSENTIMIENTO DE LA PERSONA EVALUADA, y conviene
 * que quede escrito por qué.
 *
 * Ese documento le dice a quien responde que la empresa «se obliga a proteger
 * el informe, a no difundirlo fuera del proceso y a no usarlo para otra
 * finalidad». Pero el consentimiento es un documento entre la persona y la
 * consulta: no puede crear obligaciones para un tercero. Escribirlo allí y no
 * pedírselo a nadie habría sido informar a quien no puede hacer nada y no
 * obligar a quien sí.
 *
 * Así que la obligación se pide donde puede existir: aquí, aceptada por la
 * empresa, con su versión y su fecha, en la misma tabla que el resto de las
 * aceptaciones. Sin esto, aquella frase sería falsa.
 *
 * REVISIÓN LEGAL: redactado sobre la Ley 1581 de 2012 y el Decreto 1074 de
 * 2015 (habeas data). No sustituye la revisión de un abogado antes de firmar
 * con el primer cliente real.
 */
export const CONDICIONES_EMPRESA = {
  clave: "condiciones_empresa",
  version: "2026-08-23",
} as const;

export const SECCIONES_CONDICIONES_EMPRESA: readonly SeccionLegal[] = [
  {
    titulo: "Qué contratas",
    cuerpo: [
      `Evaluaciones psicotécnicas aplicadas por ${RESPONSABLE.nombre}, ${RESPONSABLE.profesion.toLowerCase()}, bajo la marca ${RESPONSABLE.marca}.`,
      "Se compran por usos. Un uso es una evaluación: al encargarla se descuenta del saldo y se envía el enlace a la persona. Si no responde, el uso se gastó igual.",
      "El pago se resuelve fuera de la plataforma. Tu saldo sube cuando el profesional confirma que el pago entró, no cuando lo solicitas.",
    ],
  },
  {
    titulo: "Solo puedes evaluar a quien lo sepa",
    cuerpo: [
      "Al encargar una evaluación declaras que la persona está informada de que va a ser evaluada y de para qué proceso.",
      "Nadie responde sin consentir: antes de empezar se le muestra un consentimiento informado y puede negarse. Si se niega, el uso ya se gastó.",
    ],
  },
  {
    titulo: "Qué recibes, y qué no",
    cuerpo: [
      "El informe completo de cada persona que mandes a evaluar. Se calcula y se te envía automáticamente en cuanto termina de responder.",
      "NO recibes su hoja de respuestas. Contrataste un informe, no lo que cada quien marcó en cada pregunta, y eso no sale de la consulta.",
    ],
  },
  {
    titulo: "Desde que recibes un informe, respondes de él",
    cuerpo: [
      "Un informe psicológico es un dato sensible de una persona identificada. Al aceptar estas condiciones te obligas a:",
      "· Usarlo ÚNICAMENTE para el proceso de selección o de gestión para el que encargaste la evaluación. Ninguna otra finalidad.",
      "· No difundirlo fuera de quienes intervienen en ese proceso, y en ningún caso publicarlo, compartirlo con terceros ni entregarlo a otra empresa.",
      "· Protegerlo con medidas razonables: acceso restringido a quien lo necesite y ninguna copia circulando sin control.",
      "· Entregar a la persona evaluada una copia de su informe si te la pide.",
      "Frente a la ley de protección de datos, desde ese momento eres responsable del tratamiento de esa información. La plataforma no puede vigilar lo que hagas con el documento una vez enviado, y no pretende poder.",
    ],
  },
  {
    titulo: "Los datos que cargas son tuyos, y respondes de ellos",
    cuerpo: [
      "Cuando escribes el nombre y el correo de alguien para evaluarlo, declaras que estás autorizado a tratar esos datos y a facilitárnoslos con esa finalidad.",
      "Nosotros los usamos solo para aplicar la evaluación y devolverte el informe.",
    ],
  },
  {
    titulo: "Cuánto se conserva",
    cuerpo: [
      `Los informes y sus resultados se conservan ${RETENCION_ANOS} años desde la última atención, porque la normativa de historia clínica lo exige. Durante ese plazo puedes consultarlos en tu espacio.`,
      "Los datos de tu empresa se conservan mientras exista la relación comercial.",
    ],
  },
  {
    titulo: "Qué pasa si se incumple",
    cuerpo: [
      "El uso indebido de un informe puede suspender tu cuenta y el saldo pendiente, sin perjuicio de la responsabilidad que corresponda ante la persona afectada y ante la autoridad de protección de datos.",
    ],
  },
  {
    titulo: "A quién escribir",
    cuerpo: [
      `Para cualquier asunto sobre estas condiciones, sobre tu saldo o sobre un informe: ${RESPONSABLE.correo} · ${RESPONSABLE.telefono}.`,
    ],
  },
];
