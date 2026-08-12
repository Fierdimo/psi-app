import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import {
  BarraInferior,
  BarraLateral,
} from "@/components/navegacion/nav-privada";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth/acciones";
import { exigirSesion } from "@/lib/auth/perfil";

/**
 * Área del paciente (SPEC.md §5).
 *
 * `exigirSesion()` comprueba sesión Y consentimiento vigente. Es la segunda
 * barrera: la primera es el proxy, que además garantiza que la URL coincida con
 * lo que se ve.
 *
 * Barra lateral en escritorio, barra inferior en móvil. Densidad baja y una
 * cosa a la vez: quien entra aquí no es un operador de un panel de control.
 */
export default async function LayoutPaciente({ children }: LayoutProps<"/">) {
  const perfil = await exigirSesion();
  const nombreCorto = perfil.nombre ?? "Tu espacio";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line bg-panel sticky top-0 z-10 border-b">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/panel" className="rounded-md">
            <Brand size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-text-muted hidden text-sm sm:inline">
              {nombreCorto}
            </span>
            <form action={cerrarSesion}>
              <Button type="submit" variant="ghost" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-1">
        <BarraLateral />
        <main id="contenido" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <BarraInferior />
    </div>
  );
}
