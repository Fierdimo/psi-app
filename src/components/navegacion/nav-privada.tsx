"use client";

import { ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECCIONES, type Seccion } from "./secciones";
import { cn } from "@/lib/utils";

function esActiva(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ============================================================================
   Barra lateral · escritorio (≥1024 px)
   ========================================================================== */

export function BarraLateral() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="border-line hidden w-[248px] shrink-0 border-r lg:block"
    >
      <ul className="sticky top-0 flex flex-col gap-0.5 p-4">
        {SECCIONES.map((seccion) => (
          <li key={seccion.href}>
            <EnlaceLateral
              seccion={seccion}
              activa={esActiva(pathname, seccion.href)}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function EnlaceLateral({
  seccion,
  activa,
}: {
  seccion: Seccion;
  activa: boolean;
}) {
  const { icono: Icono, etiqueta, href, placeholder } = seccion;

  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={cn(
        "ease-psi flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150",
        activa
          ? "bg-accent-soft text-accent-on-soft font-medium"
          : "text-text-body hover:bg-sunken",
        placeholder && !activa && "text-text-muted",
      )}
    >
      <Icono aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex-1">{etiqueta}</span>
      {placeholder && (
        <span
          aria-label="Próximamente"
          title="Próximamente"
          className="bg-line-interactive size-1.5 shrink-0 rounded-full"
        />
      )}
    </Link>
  );
}

/* ============================================================================
   Barra inferior · móvil (<1024 px)

   Solo caben tres destinos con un objetivo de toque decente. Las tres
   funcionales van fijas y el resto vive tras «Más», implementado con
   <details>: funciona sin JavaScript, se cierra con Esc y el teclado lo maneja
   solo. Un menú hecho a mano con estado sería más código y peor accesibilidad.
   ========================================================================== */

export function BarraInferior() {
  const pathname = usePathname();

  const principales = SECCIONES.filter((s) => s.principal);
  const resto = SECCIONES.filter((s) => !s.principal);
  const algunaDelRestoActiva = resto.some((s) => esActiva(pathname, s.href));

  return (
    <nav
      aria-label="Secciones"
      className="border-line bg-panel sticky bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {principales.map((seccion) => {
          const activa = esActiva(pathname, seccion.href);
          const Icono = seccion.icono;
          return (
            <li key={seccion.href}>
              <Link
                href={seccion.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "text-micro flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2",
                  activa ? "text-accent font-medium" : "text-text-muted",
                )}
              >
                <Icono aria-hidden="true" className="size-5" />
                {seccion.etiqueta}
              </Link>
            </li>
          );
        })}

        <li className="relative">
          <details className="group">
            <summary
              className={cn(
                "text-micro flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 px-1 py-2",
                algunaDelRestoActiva
                  ? "text-accent font-medium"
                  : "text-text-muted",
              )}
            >
              <ChevronUp
                aria-hidden="true"
                className="size-5 transition-transform duration-150 group-open:rotate-180"
              />
              Más
            </summary>

            <ul className="border-line bg-panel absolute right-2 bottom-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-lg border shadow-md">
              {resto.map((seccion) => {
                const activa = esActiva(pathname, seccion.href);
                const Icono = seccion.icono;
                return (
                  <li key={seccion.href}>
                    <Link
                      href={seccion.href}
                      aria-current={activa ? "page" : undefined}
                      className={cn(
                        "border-line flex min-h-12 items-center gap-3 border-b px-4 text-sm last:border-b-0",
                        activa
                          ? "bg-accent-soft text-accent-on-soft font-medium"
                          : "text-text-body",
                      )}
                    >
                      <Icono aria-hidden="true" className="size-4.5 shrink-0" />
                      <span className="flex-1">{seccion.etiqueta}</span>
                      {seccion.placeholder && (
                        <span
                          aria-label="Próximamente"
                          className="bg-line-interactive size-1.5 shrink-0 rounded-full"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}
