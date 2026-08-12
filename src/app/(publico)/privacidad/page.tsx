import type { Metadata } from "next";

import {
  PaginaLegal,
  type SeccionLegal,
} from "@/components/legal/pagina-legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  robots: { index: true, follow: true },
};

/**
 * BORRADOR — pendiente de revisión legal.
 *
 * Los datos de atención psicológica son categoría especial bajo las leyes de
 * habeas data de la región. Antes del lanzamiento hay que precisar: país de
 * ejercicio, identidad del responsable del tratamiento, plazo concreto de
 * retención y canal formal para ejercer derechos (PLAN.md §14).
 */
const SECCIONES: readonly SeccionLegal[] = [
  {
    titulo: "Quién es responsable de tus datos",
    cuerpo:
      "El profesional titular de la consulta es el responsable del tratamiento de tus datos personales. La plataforma es la herramienta que usa para gestionarlos y no los utiliza para ninguna finalidad propia.",
  },
  {
    titulo: "Qué datos tratamos",
    cuerpo: [
      "Datos de identificación y contacto: nombre, apellidos, correo electrónico, teléfono, fecha de nacimiento y documento de identidad.",
      "Datos de gestión de la atención: las citas que solicitas o se te asignan, su estado y las fechas en que cambiaron.",
      "Datos técnicos mínimos: la fecha, la dirección IP y el navegador desde el que aceptaste el consentimiento informado, que conservamos como prueba de esa aceptación.",
    ],
  },
  {
    titulo: "Qué NO tratamos aquí",
    cuerpo:
      "El contenido de tus sesiones no se almacena en esta plataforma. Las notas clínicas son responsabilidad de tu profesional y se conservan por sus propios medios, sujetas al secreto profesional.",
  },
  {
    titulo: "Con qué base legal",
    cuerpo:
      "Con tu autorización expresa, otorgada al aceptar el consentimiento informado, y para la ejecución de la relación de atención que mantienes con el profesional.",
  },
  {
    titulo: "Con quién se comparten",
    cuerpo:
      "Con nadie ajeno a tu atención. No vendemos datos, no los cedemos con fines comerciales y no hay publicidad ni analítica de terceros en el área privada de la plataforma. Los proveedores de infraestructura que alojan la base de datos actúan como encargados del tratamiento y están sujetos a obligaciones de confidencialidad.",
  },
  {
    titulo: "Cuánto tiempo se conservan",
    cuerpo:
      "PENDIENTE DE DEFINIR. El plazo se fijará atendiendo a las obligaciones profesionales de conservación de historia clínica aplicables, que pueden exigir mantener cierta información aun después de que cierres tu cuenta.",
  },
  {
    titulo: "Tus derechos",
    cuerpo:
      "Puedes acceder a tus datos, rectificarlos, obtener una copia y solicitar su supresión. Las tres primeras acciones están disponibles directamente en «Mis datos» dentro de tu espacio privado. Para la supresión, la solicitud se tramita desde la misma sección.",
  },
  {
    titulo: "Cómo protegemos la información",
    cuerpo:
      "El tráfico viaja cifrado y los datos se almacenan cifrados en reposo. El control de acceso no depende del código de la aplicación: está implementado en la propia base de datos, de modo que ningún paciente puede acceder a la información de otro aunque una parte del sistema fallara. Toda modificación de una cita queda registrada con su autor y su fecha.",
  },
  {
    titulo: "Confidencialidad de las notificaciones",
    cuerpo:
      "Los correos que te enviamos contienen únicamente fecha, hora y modalidad de tu cita. Nunca mencionan el motivo de consulta ni ningún contenido clínico, porque el asunto de un correo puede ser visible para terceros en la pantalla de un teléfono.",
  },
];

export default function PrivacidadPage() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      entradilla="Qué datos recogemos, para qué los usamos y qué puedes hacer con ellos."
      version="2026-08-11 · borrador"
      secciones={SECCIONES}
    />
  );
}
