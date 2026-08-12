import type { Metadata } from "next";

import {
  PaginaLegal,
  type SeccionLegal,
} from "@/components/legal/pagina-legal";

export const metadata: Metadata = {
  title: "Términos de uso",
  robots: { index: true, follow: true },
};

/** BORRADOR — pendiente de revisión legal. Ver PLAN.md §14. */
const SECCIONES: readonly SeccionLegal[] = [
  {
    titulo: "Qué es esta plataforma",
    cuerpo:
      "Una herramienta de gestión para la consulta: sirve para consultar y solicitar citas y para mantener tus datos de contacto al día. No es un servicio de atención psicológica en sí mismo ni sustituye a la consulta.",
  },
  {
    titulo: "No es un canal de urgencias",
    cuerpo:
      "Esta plataforma no se atiende de forma continua. Si estás en una situación de crisis o riesgo, acude a los servicios de emergencia de tu localidad o a una línea de atención en crisis. No uses esta herramienta para pedir ayuda urgente.",
  },
  {
    titulo: "Tu cuenta",
    cuerpo:
      "La cuenta es personal. Eres responsable de mantener tu contraseña en secreto y de cerrar sesión si usas un dispositivo compartido. Si sospechas que alguien accedió a tu cuenta, cambia la contraseña y avisa a tu profesional.",
  },
  {
    titulo: "Solicitar no es reservar",
    cuerpo:
      "Cuando pides una cita estás proponiendo un horario, no reservándolo. La cita solo queda comprometida cuando el profesional la confirma, y hasta entonces aparece marcada como pendiente. Recibirás un correo cuando cambie de estado.",
  },
  {
    titulo: "Cancelaciones y cambios",
    cuerpo:
      "PENDIENTE DE DEFINIR. El margen mínimo de anticipación y las condiciones de cancelación los fija el profesional y se mostrarán en la plataforma antes de que confirmes cualquier cambio.",
  },
  {
    titulo: "Disponibilidad",
    cuerpo:
      "Procuramos que la plataforma esté siempre disponible, pero puede haber interrupciones por mantenimiento o por causas ajenas. Una interrupción no altera tus citas ya confirmadas: si no puedes acceder, comunícate directamente con la consulta.",
  },
  {
    titulo: "Cambios en estos términos",
    cuerpo:
      "Si estos términos o el consentimiento informado cambian de forma relevante, te lo pediremos de nuevo al entrar. Se conserva registro de qué versión aceptaste y cuándo.",
  },
];

export default function TerminosPage() {
  return (
    <PaginaLegal
      titulo="Términos de uso"
      entradilla="Las condiciones de uso de la plataforma y qué puedes esperar de ella."
      version="2026-08-11 · borrador"
      secciones={SECCIONES}
    />
  );
}
