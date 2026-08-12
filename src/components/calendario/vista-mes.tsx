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
 * Se marca como `role="grid"` con filas, encabezados de columna y celdas: un
 * calendario es bidimensional y un lector de pantalla necesita poder decir
 * «fila 3, martes, 18». Sin esa estructura la lectura es una secuencia de
 * números sin sentido.
 *
 * Las filas usan `display: contents` para aportar la semántica sin romper la
 * maquetación de siete columnas.
 *
 * Máximo tres chips por celda y «+N más» que lleva al día: apilar seis citas
 * en una celda de 96 px produce texto de 8 px que nadie puede leer ni tocar.
 */
export function VistaMes<T extends Cita>({
  referencia,
  citas,
  zona,
  etiquetaDeCita,
  base = "/calendario",
  rutaVista = "/calendario",
}: {
  referencia: DateTime;
  citas: T[];
  zona: string;
  /** Qué mostrar en el chip además de la hora. El profesional pone el nombre
   *  del paciente; el paciente deja el valor por defecto (la modalidad). */
  etiquetaDeCita?: (cita: T) => string;
  /** Prefijo del enlace de cada cita. */
  base?: string;
  /** Ruta del calendario al que salta «+N más». */
  rutaVista?: string;
}) {
  const dias = diasDeLaRejilla(referencia);
  const hoy = ahoraEn(zona).toISODate();

  // Se agrupa en tandas de siete: cada tanda es una fila de la tabla.
  const semanas: DateTime[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));

  const porDia = new Map<string, T[]>();
  for (const cita of citas) {
    const clave = enZona(cita.starts_at, zona).toISODate()!;
    porDia.set(clave, [...(porDia.get(clave) ?? []), cita]);
  }

  return (
    <div className="border-line overflow-hidden rounded-lg border">
      <div
        role="grid"
        aria-label={`Calendario de ${capitalizar(referencia.toFormat("LLLL yyyy"))}`}
        className="grid grid-cols-7"
      >
        <div role="row" className="contents">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              role="columnheader"
              className="text-text-muted bg-sunken px-1 py-2 text-center text-[11px] font-semibold tracking-[0.06em] uppercase"
            >
              <span aria-hidden="true">{dia.slice(0, 1)}</span>
              <span className="sr-only">{dia}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                {dia.slice(1)}
              </span>
            </div>
          ))}
        </div>

        {semanas.map((semana) => (
          <div role="row" key={semana[0].toISODate()} className="contents">
            {semana.map((dia) => {
              const clave = dia.toISODate()!;
              const delDia = porDia.get(clave) ?? [];
              const fueraDelMes = dia.month !== referencia.month;
              const esHoy = clave === hoy;

              return (
                <div
                  role="gridcell"
                  key={clave}
                  className={cn(
                    "border-line flex min-h-[92px] flex-col gap-1 border-r border-b p-1 [&:nth-child(7n)]:border-r-0",
                    fueraDelMes && "bg-bg",
                  )}
                >
                  <span
                    className={cn(
                      "tabular text-micro self-start px-1",
                      esHoy
                        ? "bg-accent text-panel grid size-[22px] place-items-center rounded-full px-0 font-semibold"
                        : fueraDelMes
                          ? // Sin `opacity`. Atenuar con opacidad rebaja el
                            // contraste de forma invisible para quien lo
                            // escribe: aquí daba 2.6:1, ilegible. La jerarquía
                            // ya la marcan el color más claro y el fondo
                            // distinto de la celda.
                            "text-text-muted"
                          : "text-text-body",
                    )}
                  >
                    {esHoy && <span className="sr-only">Hoy, </span>}
                    {dia.day}
                  </span>

                  {delDia.slice(0, MAX_CHIPS).map((cita) => (
                    <ChipCita
                      key={cita.id}
                      cita={cita}
                      zona={zona}
                      base={base}
                      etiqueta={etiquetaDeCita?.(cita)}
                    />
                  ))}

                  {delDia.length > MAX_CHIPS && (
                    <Link
                      href={`${rutaVista}?vista=dia&fecha=${clave}`}
                      className="text-text-muted hover:text-accent px-1 text-[11px]"
                    >
                      +{delDia.length - MAX_CHIPS} más
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
