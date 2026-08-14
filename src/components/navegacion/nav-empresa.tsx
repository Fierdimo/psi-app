"use client";

import {
  Building2,
  ClipboardList,
  Home,
  Receipt,
  Users,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Navegación del área de la empresa (SPEC.md §4.3.1).
 *
 * Misma densidad que la del profesional —es una herramienta de trabajo, no un
 * espacio de cuidado— pero con el mapa completo a la vista desde el principio,
 * incluidas las secciones que aún no existen.
 *
 * Enseñarlas atenuadas y explicadas genera más confianza que esconderlas:
 * quien contrata evaluaciones entiende hacia dónde va la plataforma. Lo que no
 * se hace es simular que funcionan.
 */
const SECCIONES = [
  { href: "/empresa", etiqueta: "Inicio", icono: Home, exacta: true },
  { href: "/empresa/personas", etiqueta: "Personas", icono: Users },
  { href: "/empresa/sesiones", etiqueta: "Sesiones", icono: CalendarDays },
  {
    href: "/empresa/informes",
    etiqueta: "Informes",
    icono: ClipboardList,
    pendiente: true,
  },
  {
    href: "/empresa/facturacion",
    etiqueta: "Facturación",
    icono: Receipt,
    pendiente: true,
  },
  { href: "/empresa/datos", etiqueta: "Datos", icono: Building2 },
];

export function NavEmpresa() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="border-line bg-panel border-b">
      <ul className="mx-auto flex w-full max-w-[1280px] gap-1 overflow-x-auto px-4 sm:px-6">
        {SECCIONES.map(
          ({ href, etiqueta, icono: Icono, exacta, pendiente }) => {
            const activa = exacta
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activa ? "page" : undefined}
                  className={cn(
                    "ease-psi -mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors duration-150",
                    activa
                      ? "border-accent text-accent font-medium"
                      : "text-text-muted hover:text-text-body border-transparent",
                  )}
                >
                  <Icono aria-hidden="true" className="size-4.5" />
                  {etiqueta}
                  {pendiente && (
                    <span
                      aria-hidden="true"
                      className="bg-line-decorative size-1.5 rounded-full"
                    />
                  )}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}
