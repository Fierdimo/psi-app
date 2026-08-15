import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import {
  BarraInferior,
  BarraLateral,
} from "@/components/navegacion/nav-privada";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/lib/auth/acciones";

/**
 * El armazón de las pantallas privadas: cabecera, navegación y pie.
 *
 * Estaba escrito dentro del layout del paciente, y por eso `/evaluacion` —que
 * vive fuera de esa carpeta para no exigir el consentimiento de atención— se
 * quedó sin cabecera ni navegación. La persona entraba a su prueba y la
 * aplicación desaparecía a su alrededor.
 *
 * La lección: separar una ruta por sus PERMISOS no debería costarle su
 * aspecto. Ahora el armazón es un componente y cada layout decide qué exige
 * antes de pintarlo.
 */
export function ArmazonPrivado({
  nombre,
  children,
  /** En una prueba en curso la navegación estorba y se puede ocultar. */
  conNavegacion = true,
}: {
  nombre: string;
  children: React.ReactNode;
  conNavegacion?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line bg-panel sticky top-0 z-20 h-[var(--alto-cabecera)] border-b">
        <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/panel" className="rounded-md">
            <Brand size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-text-muted hidden text-sm sm:inline">
              {nombre}
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
        {conNavegacion ? <BarraLateral /> : null}
        <main id="contenido" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {conNavegacion ? <BarraInferior /> : null}
    </div>
  );
}
