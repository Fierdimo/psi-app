import type { DateTime } from "luxon";

import { ChipCita } from "./chip-cita";
import type { Cita } from "@/lib/citas/estados";
import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  ahoraEn,
  capitalizar,
  enZona,
} from "@/lib/fechas/formato";
import { cn } from "@/lib/utils";

const ALTO_HORA = 56; // px por hora

/**
 * Vistas de semana y día.
 *
 * Comparten todo salvo el número de columnas, así que son el mismo componente:
 * la vista de día es la de semana con una sola columna. Duplicarlas garantizaría
 * que se desincronizaran al primer arreglo.
 *
 * La línea de la hora actual va en rojo. Es el único uso de rojo en toda la
 * plataforma que no significa error, y funciona porque es la convención
 * universal en calendarios: nadie la lee como alarma.
 */
export function VistaSemana({
  referencia,
  citas,
  zona,
  dias = 7,
}: {
  referencia: DateTime;
  citas: Cita[];
  zona: string;
  dias?: 1 | 7;
}) {
  const inicio = dias === 7 ? referencia.startOf("week") : referencia;
  const columnas = Array.from({ length: dias }, (_, i) =>
    inicio.plus({ days: i }),
  );

  const horas = Array.from(
    { length: HORA_FIN_JORNADA - HORA_INICIO_JORNADA },
    (_, i) => HORA_INICIO_JORNADA + i,
  );

  const ahora = ahoraEn(zona);
  const hoyISO = ahora.toISODate();
  const minutosDesdeInicio =
    (ahora.hour - HORA_INICIO_JORNADA) * 60 + ahora.minute;
  const mostrarLineaAhora =
    minutosDesdeInicio >= 0 &&
    ahora.hour < HORA_FIN_JORNADA &&
    columnas.some((c) => c.toISODate() === hoyISO);

  return (
    <div className="border-line overflow-x-auto rounded-lg border">
      <div className="min-w-[560px]">
        {/* Cabecera de días */}
        <div
          className="border-line bg-sunken grid border-b"
          style={{ gridTemplateColumns: `56px repeat(${dias}, 1fr)` }}
        >
          <div />
          {columnas.map((dia) => {
            const esHoy = dia.toISODate() === hoyISO;
            return (
              <div
                key={dia.toISODate()}
                className="flex flex-col items-center gap-0.5 px-1 py-2"
              >
                <span className="text-text-muted text-[11px] font-semibold tracking-[0.06em] uppercase">
                  {capitalizar(dia.toFormat("ccc"))}
                </span>
                <span
                  className={cn(
                    "tabular text-sm",
                    esHoy
                      ? "bg-accent text-panel grid size-6 place-items-center rounded-full font-semibold"
                      : "text-text-body",
                  )}
                >
                  {esHoy && <span className="sr-only">Hoy, </span>}
                  {dia.day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Retícula horaria */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${dias}, 1fr)` }}
        >
          {/* Columna de horas */}
          <div className="border-line border-r">
            {horas.map((h) => (
              <div
                key={h}
                style={{ height: ALTO_HORA }}
                className="text-text-muted tabular relative pr-2 text-right text-[11px]"
              >
                <span className="absolute -top-1.5 right-2">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {columnas.map((dia) => {
            const diaISO = dia.toISODate();
            const delDia = citas.filter(
              (c) => enZona(c.starts_at, zona).toISODate() === diaISO,
            );

            return (
              <div
                key={diaISO}
                className="border-line relative border-r last:border-r-0"
              >
                {horas.map((h) => (
                  <div
                    key={h}
                    style={{ height: ALTO_HORA }}
                    className="border-line border-b"
                  />
                ))}

                {delDia.map((cita) => {
                  const inicioCita = enZona(cita.starts_at, zona);
                  const finCita = enZona(cita.ends_at, zona);
                  const desde =
                    (inicioCita.hour - HORA_INICIO_JORNADA) * 60 +
                    inicioCita.minute;
                  const duracion = finCita.diff(inicioCita, "minutes").minutes;

                  // Una cita fuera de la franja visible no se dibuja aquí; la
                  // agenda sí la muestra, así que no se pierde.
                  if (desde < 0) return null;

                  return (
                    <div
                      key={cita.id}
                      className="absolute right-0.5 left-0.5"
                      style={{
                        top: (desde / 60) * ALTO_HORA,
                        minHeight: Math.max((duracion / 60) * ALTO_HORA, 24),
                      }}
                    >
                      <ChipCita
                        cita={cita}
                        zona={zona}
                        className="h-full whitespace-normal"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}

          {mostrarLineaAhora && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 left-14 z-10"
              style={{ top: (minutosDesdeInicio / 60) * ALTO_HORA }}
            >
              <div className="bg-danger-600 relative h-0.5">
                <span className="bg-danger-600 absolute -top-[3px] -left-1 size-2 rounded-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
