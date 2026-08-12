import type { Metadata } from "next";

import { PaginaLegal } from "@/components/legal/pagina-legal";
import { CONSENTIMIENTO, SECCIONES_CONSENTIMIENTO } from "@/lib/consentimiento";

export const metadata: Metadata = {
  title: "Consentimiento informado",
  robots: { index: true, follow: true },
};

/**
 * Versión pública y consultable del consentimiento.
 *
 * Comparte contenido con la pantalla de aceptación: ambas leen de
 * `SECCIONES_CONSENTIMIENTO`, así que es imposible que el texto que alguien
 * acepta difiera del que puede consultar después.
 */
export default function ConsentimientoInformadoPage() {
  return (
    <PaginaLegal
      titulo="Consentimiento informado"
      entradilla="El documento que se acepta al empezar a usar la plataforma. Puedes consultarlo cuando quieras."
      version={CONSENTIMIENTO.version}
      secciones={SECCIONES_CONSENTIMIENTO}
    />
  );
}
