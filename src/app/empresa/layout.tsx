import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import { NavEmpresa } from "@/components/navegacion/nav-empresa";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth/acciones";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Área de la empresa (SPEC.md §4.3.1).
 *
 * Entorno visualmente distinto del paciente y del profesional, como manda §5.2:
 * cabecera azul oscuro con el nombre de la organización a la vista. Quien
 * administra varias cosas a la vez necesita saber de un vistazo en cuál está.
 */
export default async function LayoutEmpresa({
  children,
}: LayoutProps<"/empresa">) {
  const perfil = await exigirEmpresa();

  const supabase = await crearClienteServidor();
  const { data: organizacion } = await supabase
    .from("organizations")
    .select("nombre")
    .eq("id", perfil.organization_id)
    .maybeSingle();

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <header className="bg-brand-800 sticky top-0 z-20">
        <div className="mx-auto flex h-[var(--alto-cabecera)] w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/empresa" className="rounded-md">
              <Brand size="sm" tone="dark" />
            </Link>
            <span className="text-brand-200 text-micro border-brand-700 hidden rounded-sm border px-2 py-0.5 font-semibold tracking-[0.08em] uppercase sm:inline">
              Empresa
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-brand-200 hidden text-sm sm:inline">
              {organizacion?.nombre ?? "Tu organización"}
            </span>
            <form action={cerrarSesion}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-brand-200 hover:bg-brand-900 hover:text-surface-0"
              >
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <NavEmpresa />

      <main id="contenido" className="flex-1">
        {children}
      </main>
    </div>
  );
}
