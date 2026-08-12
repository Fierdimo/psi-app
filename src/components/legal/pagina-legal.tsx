import Link from "next/link";

import { Brand } from "@/components/marca/brand";

export type SeccionLegal = { titulo: string; cuerpo: string | string[] };

/**
 * Armazón de las páginas legales.
 *
 * Columna única, medida corta y tipografía de lectura. Un documento legal que
 * nadie puede leer no protege a nadie: aquí la legibilidad es parte del
 * cumplimiento, no una cortesía.
 */
export function PaginaLegal({
  titulo,
  entradilla,
  version,
  secciones,
}: {
  titulo: string;
  entradilla: string;
  version: string;
  secciones: readonly SeccionLegal[];
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto w-full max-w-[720px] px-6 py-5">
          <Link href="/" className="w-fit rounded-md">
            <Brand size="sm" />
          </Link>
        </div>
      </header>

      <main
        id="contenido"
        className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-6 py-12"
      >
        <div className="flex flex-col gap-3">
          <h1 className="text-h1">{titulo}</h1>
          <p className="text-text-body text-lg">{entradilla}</p>
          <p className="text-text-muted text-micro tabular">
            Versión {version}
          </p>
        </div>

        <div className="flex flex-col gap-7">
          {secciones.map((seccion) => (
            <section key={seccion.titulo} className="flex flex-col gap-2">
              <h2 className="text-h4">{seccion.titulo}</h2>
              {(Array.isArray(seccion.cuerpo)
                ? seccion.cuerpo
                : [seccion.cuerpo]
              ).map((parrafo, i) => (
                <p key={i} className="text-text-body max-w-[68ch]">
                  {parrafo}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-line border-t">
        <div className="text-text-muted mx-auto flex w-full max-w-[720px] flex-wrap gap-x-5 gap-y-2 px-6 py-6 text-sm">
          <Link href="/privacidad" className="hover:text-accent">
            Privacidad
          </Link>
          <Link href="/terminos" className="hover:text-accent">
            Términos
          </Link>
          <Link href="/consentimiento-informado" className="hover:text-accent">
            Consentimiento informado
          </Link>
        </div>
      </footer>
    </div>
  );
}
