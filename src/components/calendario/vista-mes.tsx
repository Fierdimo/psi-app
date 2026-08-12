import type { DateTime } from "luxon";
import Link from "next/link";

import { ChipCita } from "./chip-cita";
import type { Cita } from "@/lib/citas/estados";
import {
  DIAS_SEMANA,
  ahoraEn,
  capitalizar,
  diasDeLaRejilla,
  enZona,
} from "@/lib/fechas/formato";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;

/**
 * Retícula mensual.
 *
 * Se marca como `role="grid"` con encabezados de columna: un calendario es
 * bidimensional y un lector de pantalla necesita saber que la celda del día 18
 * pertenece a la columna «martes». Sin esa estructura, la lectura es una
 * secuencia de números sin sentido.
 *
 * Máximo tres chips por celda y «+N más» que lleva al día: apilar seis citas
 * en una celda de 96 px produce texto de 8 px que nadie puede leer ni tocar.
 */
export function VistaMes({
  referencia,
  citas,
  zona,
}: {
  referencia: DateTime;
  citas: Cita[];
  zona: string;
}) {
  const dias = diasDeLaRejilla(referencia);
  const hoy = ahoraEn(zona).toISODate();

  const porDia = new Map<string, Cita[]>();
  for (const cita of citas) {
    const clave = enZona(cita.starts_at, zona).toISODate()!;
    porDia.set(clave, [...(porDia.get(clave) ?? []), cita]);
  }

  return (
    <div className="border-line overflow-hidden rounded-lg border">
      <div
        role="grid"
        aria-label={`Calendario de ${capitalizar(referencia.toFormat("LLLL yyyy"))}`}
        className="min-w-0"
      >
        <div role="row" className="bg-sunken grid grid-cols-7">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              role="columnheader"
              className="text-text-muted px-1 py-2 text-center text-[11px] font-semibold tracking-[0.06em] uppercase"
            >
              <span aria-hidden="true">{dia.slice(0, 1)}</span>
              <span className="sr-only">{dia}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                {dia.slice(1)}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const clave = dia.toISODate()!;
            const delDia = porDia.get(clave) ?? [];
            const fueraDelMes = dia.month !== referencia.month;
            const esHoy = clave === hoy;

            return (
              <div
                role="gridcell"
                key={clave}
                className={cn(
                  "border-line flex min-h-[92px] flex-col gap-1 border-r border-b p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                  fueraDelMes && "bg-bg",
                )}
              >
                <span
                  className={cn(
                    "tabular text-micro self-start px-1",
                    esHoy
                      ? "bg-accent text-panel grid size-[22px] place-items-center rounded-full px-0 font-semibold"
                      : fueraDelMes
                        ? "text-text-muted opacity-65"
                        : "text-text-body",
                  )}
                >
                  {esHoy && <span className="sr-only">Hoy, </span>}
                  {dia.day}
                </span>

                {delDia.slice(0, MAX_CHIPS).map((cita) => (
                  <ChipCita key={cita.id} cita={cita} zona={zona} />
                ))}

                {delDia.length > MAX_CHIPS && (
                  <Link
                    href={`/calendario?vista=dia&fecha=${clave}`}
                    className="text-text-muted hover:text-accent px-1 text-[11px]"
                  >
                    +{delDia.length - MAX_CHIPS} más
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
