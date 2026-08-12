import Link from "next/link";

import { ASPECTO, MODALIDAD, type Cita } from "@/lib/citas/estados";
import { fechaCompleta, hora, rangoHorario } from "@/lib/fechas/formato";
import { cn } from "@/lib/utils";

/**
 * Chip de una cita dentro del calendario (SPEC.md §7.4).
 *
 * Dos cosas que no son negociables:
 *
 *  1. Tinte, no bloque sólido. Ver la nota en `estados.ts`.
 *  2. Etiqueta accesible COMPLETA. Lo que se ve es «10:00 · Presencial»
 *     porque en una celda de calendario no cabe más, pero quien usa lector de
 *     pantalla oye la frase entera: sin la fecha y el estado, una lista de
 *     horas sueltas es incomprensible.
 */
export function ChipCita({
  cita,
  zona,
  className,
}: {
  cita: Cita;
  zona: string;
  className?: string;
}) {
  const aspecto = ASPECTO[cita.status];

  const etiquetaAccesible = [
    `Cita ${aspecto.descripcion.toLowerCase()}`,
    fechaCompleta(cita.starts_at, zona),
    rangoHorario(cita.starts_at, cita.ends_at, zona),
    MODALIDAD[cita.modality],
  ].join(", ");

  return (
    <Link
      href={`/calendario/${cita.id}`}
      aria-label={etiquetaAccesible}
      className={cn(
        "ease-psi tabular block truncate rounded-sm px-1.5 py-1 text-left text-[11.5px] leading-tight font-medium transition-opacity duration-150 hover:opacity-80",
        aspecto.chip,
        className,
      )}
    >
      <span aria-hidden="true">
        {hora(cita.starts_at, zona)} ·{" "}
        {aspecto.activa && cita.status === "confirmada"
          ? MODALIDAD[cita.modality]
          : aspecto.etiqueta}
      </span>
    </Link>
  );
}
