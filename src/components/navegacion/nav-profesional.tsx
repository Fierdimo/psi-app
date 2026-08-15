"use client";

import {
  Building2,
  CalendarDays,
  Inbox,
  ClipboardList,
  FileText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Navegación del área profesional (SPEC.md §4.3.1 y §5.2).
 *
 * Compacta frente a las siete del paciente con iconos grandes. No es una
 * versión reducida por falta de tiempo: es una herramienta de trabajo y quien
 * la usa entra muchas veces al día a lo mismo. La densidad media y el
 * recorrido corto son la diferencia deliberada.
 *
 * Las dos primeras son el día a día y van primero. Las marcadas como
 * pendientes se muestran igual, atenuadas con un punto: enseñar el mapa
 * completo evita que la herramienta parezca más pequeña de lo que va a ser.
 */
const SECCIONES = [
  { href: "/profesional/agenda", etiqueta: "Agenda", icono: CalendarDays },
  /*
   * Lo que espera una decisión, en su propia entrada.
   *
   * Estaba dentro de la agenda, debajo del calendario. Confirmar la solicitud
   * de una empresa obligaba a entrar a una pantalla de otra cosa y buscar: es
   * la acción más frecuente del día y estaba a dos saltos de distancia.
   */
  {
    href: "/profesional/solicitudes",
    etiqueta: "Solicitudes",
    icono: Inbox,
  },
  { href: "/profesional/pacientes", etiqueta: "Pacientes", icono: Users },
  { href: "/profesional/empresas", etiqueta: "Empresas", icono: Building2 },
  {
    href: "/profesional/evaluaciones",
    etiqueta: "Evaluaciones",
    icono: ClipboardList,
    pendiente: true,
  },
  {
    href: "/profesional/documentos",
    etiqueta: "Documentos",
    icono: FileText,
    pendiente: true,
  },
  { href: "/profesional/consulta", etiqueta: "La consulta", icono: Settings },
];

export function NavProfesional() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="border-line bg-panel border-b">
      <ul className="mx-auto flex w-full max-w-[1280px] gap-1 overflow-x-auto px-4 sm:px-6">
        {SECCIONES.map(({ href, etiqueta, icono: Icono, pendiente }) => {
          const activa = pathname === href || pathname.startsWith(`${href}/`);
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
        })}
      </ul>
    </nav>
  );
}
