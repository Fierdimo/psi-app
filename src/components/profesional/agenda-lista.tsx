import Link from "next/link";

import { AccionesCierre } from "./acciones-solicitud";
import { Badge } from "@/components/ui/badge";
import {
  ASPECTO,
  MODALIDAD,
  nombrePaciente,
  type CitaConPaciente,
} from "@/lib/citas/estados";
import { capitalizar, enZona, rangoHorario } from "@/lib/fechas/formato";

/**
 * Lista de la agenda, agrupada por día.
 *
 * Más densa que la agenda del paciente —es una herramienta de trabajo— y con
 * el nombre del paciente como dato principal: el profesional sabe la hora, lo
 * que necesita saber es con quién.
 *
 * Las citas confirmadas ya pasadas muestran el cierre en línea. Obligar a
 * entrar al detalle de cada una para marcar «asistió» convertiría una tarea de
 * dos minutos en una de veinte.
 */
export function AgendaLista({
  citas,
  zona,
  ahoraISO,
}: {
  citas: CitaConPaciente[];
  zona: string;
  ahoraISO: string;
}) {
  if (citas.length === 0) {
    return (
      <p className="text-text-muted border-line rounded-lg border border-dashed p-8 text-center text-sm">
        No hay citas en este periodo.
      </p>
    );
  }

  const porDia = new Map<string, CitaConPaciente[]>();
  for (const cita of citas) {
    const clave = enZona(cita.starts_at, zona).toISODate()!;
    porDia.set(clave, [...(porDia.get(clave) ?? []), cita]);
  }

  return (
    <ol className="flex flex-col gap-5">
      {[...porDia.entries()].map(([dia, delDia]) => (
        <li key={dia} className="flex flex-col gap-2">
          <h3 className="text-text-strong text-sm font-semibold">
            {capitalizar(
              enZona(delDia[0].starts_at, zona).toFormat("cccc d 'de' LLLL"),
            )}
          </h3>

          <ul className="border-line divide-line bg-panel divide-y rounded-lg border">
            {delDia.map((cita) => {
              const aspecto = ASPECTO[cita.status];
              const porCerrar =
                cita.status === "confirmada" && cita.ends_at < ahoraISO;

              return (
                <li
                  key={cita.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                >
                  <span className="text-text-strong tabular w-[112px] shrink-0 font-medium">
                    {rangoHorario(cita.starts_at, cita.ends_at, zona)}
                  </span>

                  <Link
                    href={`/profesional/pacientes/${cita.patient_id}`}
                    className="text-text-strong hover:text-accent min-w-0 flex-1 truncate font-medium"
                  >
                    {nombrePaciente(cita)}
                  </Link>

                  <span className="text-text-muted text-sm">
                    {MODALIDAD[cita.modality]}
                  </span>

                  <Badge tone={aspecto.tono}>{aspecto.etiqueta}</Badge>

                  {porCerrar && <AccionesCierre citaId={cita.id} />}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
