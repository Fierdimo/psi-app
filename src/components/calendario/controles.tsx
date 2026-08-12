import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DateTime } from "luxon";
import Link from "next/link";

import { VISTAS, desplazar, type Vista } from "@/lib/fechas/formato";
import { cn } from "@/lib/utils";

const NOMBRE_VISTA: Record<Vista, string> = {
  agenda: "Agenda",
  mes: "Mes",
  semana: "Semana",
  dia: "Día",
};

function url(ruta: string, vista: Vista, fecha: DateTime) {
  return `${ruta}?vista=${vista}&fecha=${fecha.toISODate()}`;
}

/**
 * Conmutador de vista y navegación de periodo.
 *
 * Todo son enlaces, no botones con estado: la vista y la fecha viven en la
 * URL. Así el calendario funciona sin JavaScript, se puede compartir un enlace
 * a una semana concreta, y el botón «atrás» del navegador hace lo que se
 * espera. Un calendario con estado solo en el cliente pierde las tres cosas.
 */
export function Controles({
  vista,
  referencia,
  hoy,
  /** El profesional navega dentro de su propia agenda, no del calendario del
   *  paciente. */
  ruta = "/calendario",
}: {
  vista: Vista;
  referencia: DateTime;
  hoy: DateTime;
  ruta?: string;
}) {
  const esAgenda = vista === "agenda";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Link
          href={url(ruta, vista, desplazar(vista, referencia, -1))}
          aria-label="Periodo anterior"
          className="border-line-interactive text-text-body hover:border-accent hover:text-accent grid size-9 place-items-center rounded-md border"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>

        <Link
          href={url(ruta, vista, hoy)}
          className="border-line-interactive text-text-body hover:border-accent hover:text-accent flex h-9 items-center rounded-md border px-3 text-sm font-medium"
        >
          Hoy
        </Link>

        <Link
          href={url(ruta, vista, desplazar(vista, referencia, 1))}
          aria-label="Periodo siguiente"
          className="border-line-interactive text-text-body hover:border-accent hover:text-accent grid size-9 place-items-center rounded-md border"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <nav aria-label="Tipo de vista">
        <ul className="border-line bg-sunken flex gap-0.5 rounded-md border p-0.5">
          {VISTAS.map((v) => {
            const activa = v === vista;
            return (
              <li key={v}>
                <Link
                  href={url(ruta, v, referencia)}
                  aria-current={activa ? "true" : undefined}
                  className={cn(
                    "ease-psi flex h-8 items-center rounded-[5px] px-3 text-sm transition-colors duration-150",
                    activa
                      ? "bg-panel text-text-strong font-medium shadow-xs"
                      : "text-text-muted hover:text-text-body",
                    // Semana y día son incómodas en pantallas estrechas; siguen
                    // accesibles por URL, pero no se ofrecen por defecto.
                    (v === "semana" || v === "dia") && "hidden sm:flex",
                  )}
                >
                  {NOMBRE_VISTA[v]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {esAgenda && (
        <span className="sr-only">Mostrando los próximos meses</span>
      )}
    </div>
  );
}
