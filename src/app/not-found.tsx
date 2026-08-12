import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import { buttonVariants } from "@/components/ui/button";

/**
 * 404 propia.
 *
 * Sustituye a la de Next.js, que inyecta `body{color:#000}` y rompe la regla
 * fundacional del sistema (SPEC.md §2.1) además de no parecerse en nada al
 * producto.
 *
 * Tono: sin culpar al usuario, sin humor, con una salida clara (SPEC.md §13).
 */
export default function NoEncontrado() {
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center"
    >
      <Brand size="lg" />

      <div className="flex flex-col gap-2">
        <p className="text-micro text-text-muted font-semibold tracking-[0.09em] uppercase">
          Error 404
        </p>
        <h1 className="text-h2">No encontramos esta página</h1>
        <p className="text-text-body">
          Es posible que el enlace haya cambiado o que la página ya no exista.
        </p>
      </div>

      {/* Un enlace, no un botón: navega. Toma el estilo de botón secundario
          sin dejar de ser un <a>, que es lo que espera un lector de pantalla. */}
      <Link href="/" className={buttonVariants({ variant: "secondary" })}>
        Volver al inicio
      </Link>
    </main>
  );
}
