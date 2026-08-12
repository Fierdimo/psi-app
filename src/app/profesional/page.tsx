import type { Metadata } from "next";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioIngreso } from "@/components/auth/formularios";

/**
 * Entrada del profesional (SPEC.md §5.1, PLAN.md §7.1).
 *
 * No se enlaza desde ninguna parte del sitio público y lleva `noindex`. Eso no
 * es la frontera de seguridad —esa es RLS— pero evita publicar la superficie
 * administrativa.
 *
 * NO hay enlace a «crear cuenta»: las cuentas de profesional se crean por
 * migración de datos. La ausencia de esa pantalla es la decisión de seguridad.
 */
export const metadata: Metadata = {
  title: "Acceso profesional",
  robots: { index: false, follow: false },
};

export default async function IngresoProfesionalPage({
  searchParams,
}: PageProps<"/profesional">) {
  const params = await searchParams;
  const siguiente =
    typeof params.siguiente === "string" ? params.siguiente : undefined;

  return (
    <ArmazonAuth
      variante="profesional"
      titulo="Acceso profesional"
      descripcion="Área de gestión de la consulta."
    >
      <FormularioIngreso siguiente={siguiente} variante="profesional" />
    </ArmazonAuth>
  );
}
