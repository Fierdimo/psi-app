import { ArmazonPrivado } from "@/components/navegacion/armazon-privado";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Área de la empresa (SPEC.md §4.3.1).
 *
 * Mismo armazón que las otras dos áreas, con sus secciones. La cabecera oscura
 * y el nombre de la organización a la vista se conservan: quien administra
 * varias cosas a la vez necesita saber de un vistazo en cuál está.
 */
export default async function LayoutEmpresa({
  children,
  panel,
}: LayoutProps<"/empresa">) {
  const perfil = await exigirEmpresa();

  const supabase = await crearClienteServidor();
  const { data: organizacion } = await supabase
    .from("organizations")
    .select("nombre")
    .eq("id", perfil.organization_id)
    .maybeSingle();

  return (
    <ArmazonPrivado
      nombre={organizacion?.nombre ?? "Tu empresa"}
      area="empresa"
      inicio="/empresa"
      tono="oscuro"
      insignia="Área de empresa"
    >
      {children}
      {/* Hueco del panel lateral: lo llenan los formularios de alta y edición. */}
      {panel}
    </ArmazonPrivado>
  );
}
