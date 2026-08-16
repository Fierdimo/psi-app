"use client";

import { ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SECCIONES,
  SECCIONES_EMPRESA,
  SECCIONES_PROFESIONAL,
  type Seccion,
} from "./secciones";
import { cn } from "@/lib/utils";

function esActiva(pathname: string, href: string, exacta?: boolean) {
  // `/empresa` es la raíz de su área: sin `exacta` se quedaría siempre activa.
  if (exacta) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ============================================================================
   Barra lateral · escritorio (≥1024 px)
   ========================================================================== */

/**
 * Qué secciones toca pintar.
 *
 * Se recibe el NOMBRE del área y no la lista: las secciones llevan su icono, y
 * un icono es una función, que no puede cruzar del servidor al cliente. Pasar
 * la lista compilaba y reventaba en tiempo de ejecución con «Functions cannot
 * be passed directly to Client Components».
 */
const DE_AREA: Record<Area, readonly Seccion[]> = {
  paciente: SECCIONES,
  profesional: SECCIONES_PROFESIONAL,
  empresa: SECCIONES_EMPRESA,
};

export type Area = "paciente" | "profesional" | "empresa";

export function BarraLateral({ area = "paciente" }: { area?: Area }) {
  const secciones = DE_AREA[area];
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="border-line hidden w-[248px] shrink-0 border-r lg:block"
    >
      {/*
        Se fija JUSTO DEBAJO de la cabecera, no en `top-0`.
        Con `top-0` la barra sube hasta el borde de la ventana y la cabecera
        —que también es fija y va por encima— le tapa el primer enlace en
        cuanto se desplaza la página. Al coincidir el punto de fijación con su
        posición natural, la barra no se mueve en ningún momento.

        `max-h` + `overflow-y-auto`: si algún día hay más secciones de las que
        caben en pantalla, la barra tiene su propio desplazamiento en lugar de
        recortar las últimas.
      */}
      <div className="sticky top-[var(--alto-cabecera)] max-h-[calc(100dvh-var(--alto-cabecera))] overflow-y-auto overscroll-contain p-4">
        <ul className="flex flex-col gap-0.5">
          {secciones.map((seccion) => (
            <li key={seccion.href}>
              <EnlaceLateral
                seccion={seccion}
                activa={esActiva(pathname, seccion.href, seccion.exacta)}
              />
            </li>
          ))}
        </ul>
      </div>
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

export function BarraInferior({ area = "paciente" }: { area?: Area }) {
  const secciones = DE_AREA[area];
  const pathname = usePathname();

  /*
   * Sin `principal` marcada, las tres primeras hacen de principales.
   *
   * Es lo razonable en un área nueva: las que van primero son las que más se
   * usan, y esa decisión ya se tomó al ordenarlas.
   */
  const marcadas = secciones.filter((s) => s.principal);
  const principales = marcadas.length > 0 ? marcadas : secciones.slice(0, 3);
  const resto = secciones.filter((s) => !principales.includes(s));
  const algunaDelRestoActiva = resto.some((s) => esActiva(pathname, s.href));

  return (
    <nav
      aria-label="Secciones"
      className="border-line bg-panel sticky bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {principales.map((seccion) => {
          const activa = esActiva(pathname, seccion.href, seccion.exacta);
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
                const activa = esActiva(pathname, seccion.href, seccion.exacta);
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
