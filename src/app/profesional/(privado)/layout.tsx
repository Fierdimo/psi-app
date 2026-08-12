import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth/acciones";
import { exigirProfesional } from "@/lib/auth/perfil";

/**
 * Área del profesional (SPEC.md §5.2).
 *
 * El grupo `(privado)` existe para que este layout NO envuelva a
 * `/profesional`, que es la pantalla de entrada y debe ser pública.
 *
 * La cabecera azul rey oscuro no es un capricho estético: es un recordatorio
 * permanente de que lo que hay en pantalla son datos de otras personas. El
 * área del paciente tiene cabecera blanca; la diferencia debe notarse de un
 * vistazo.
 */
export default async function LayoutProfesional({
  children,
}: LayoutProps<"/profesional">) {
  const perfil = await exigirProfesional();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-brand-800">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-4">
            <Link href="/profesional/agenda" className="rounded-md">
              <Brand tone="dark" size="sm" />
            </Link>
            <span className="bg-brand-900 text-brand-200 text-micro rounded-sm px-2 py-1 font-semibold tracking-[0.06em] uppercase">
              Área profesional
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-brand-200 hidden text-sm sm:inline">
              {perfil.nombre} {perfil.apellidos}
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

      <main id="contenido" className="flex-1">
        {children}
      </main>
    </div>
  );
}
