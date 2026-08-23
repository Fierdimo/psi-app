import type { Metadata } from "next";

import { PaginaLegal } from "@/components/legal/pagina-legal";
import {
  CONDICIONES_EMPRESA,
  SECCIONES_CONDICIONES_EMPRESA,
} from "@/lib/legal/condiciones-empresa";

export const metadata: Metadata = {
  title: "Condiciones para empresas",
  robots: { index: true, follow: true },
};

/**
 * Versión pública y consultable de las condiciones que acepta una empresa.
 *
 * Comparte contenido con la pantalla de aceptación: las dos leen de
 * `SECCIONES_CONDICIONES_EMPRESA`, así que es imposible que el texto que
 * alguien acepta difiera del que puede consultar después. Es la misma regla
 * que se rompió una vez con el consentimiento, cuando el texto que se firmaba
 * estaba escrito dentro de su componente.
 */
export default function CondicionesEmpresaPage() {
  return (
    <PaginaLegal
      titulo="Condiciones para empresas"
      entradilla="Lo que acepta una organización al contratar evaluaciones. Puedes consultarlo cuando quieras."
      version={CONDICIONES_EMPRESA.version}
      secciones={SECCIONES_CONDICIONES_EMPRESA}
    />
  );
}
