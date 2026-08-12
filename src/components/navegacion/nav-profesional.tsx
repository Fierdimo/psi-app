"use client";

import { CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Navegación del área profesional (SPEC.md §5.2).
 *
 * Dos secciones y compacta, frente a las siete del paciente con iconos
 * grandes. No es una versión reducida por falta de tiempo: es una herramienta
 * de trabajo y quien la usa entra muchas veces al día a lo mismo. La densidad
 * media y el recorrido corto son la diferencia deliberada.
 */
const SECCIONES = [
  { href: "/profesional/agenda", etiqueta: "Agenda", icono: CalendarDays },
  { href: "/profesional/pacientes", etiqueta: "Pacientes", icono: Users },
];

export function NavProfesional() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="border-line bg-panel border-b">
      <ul className="mx-auto flex w-full max-w-[1280px] gap-1 px-4 sm:px-6">
        {SECCIONES.map(({ href, etiqueta, icono: Icono }) => {
          const activa = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "ease-psi -mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors duration-150",
                  activa
                    ? "border-accent text-accent font-medium"
                    : "text-text-muted hover:text-text-body border-transparent",
                )}
              >
                <Icono aria-hidden="true" className="size-4.5" />
                {etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
