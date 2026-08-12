import { Inbox } from "lucide-react";

import { AccionesSolicitud } from "./acciones-solicitud";
import { Card } from "@/components/ui/card";
import {
  MODALIDAD,
  nombrePaciente,
  type CitaConPaciente,
} from "@/lib/citas/estados";
import {
  capitalizar,
  distanciaEnDias,
  enZona,
  fechaCompleta,
  rangoHorario,
} from "@/lib/fechas/formato";

/**
 * Bandeja de solicitudes pendientes.
 *
 * Va arriba del todo y con la cuenta en el título porque es lo único de esta
 * pantalla que requiere una acción del profesional. La agenda se consulta; la
 * bandeja se atiende.
 */
export function BandejaSolicitudes({
  solicitudes,
  zona,
}: {
  solicitudes: CitaConPaciente[];
  zona: string;
}) {
  if (solicitudes.length === 0) {
    return (
      <Card sunken className="flex items-center gap-3">
        <Inbox aria-hidden="true" className="text-text-muted size-5 shrink-0" />
        <p className="text-text-body text-sm">
          No hay solicitudes pendientes de respuesta.
        </p>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">Solicitudes pendientes ({solicitudes.length})</h2>

      <ul className="flex flex-col gap-3">
        {solicitudes.map((cita) => {
          const esCambio = cita.status === "reprogramacion_solicitada";
          const propuesta = cita.proposed_starts_at;

          return (
            <li key={cita.id}>
              <Card
                edge="border"
                accent
                className="flex flex-wrap items-start justify-between gap-4"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-text-strong text-base font-semibold">
                    {nombrePaciente(cita)}
                  </span>

                  <span className="text-text-body tabular">
                    {capitalizar(
                      fechaCompleta(propuesta ?? cita.starts_at, zona),
                    )}
                    {" · "}
                    {propuesta && cita.proposed_ends_at
                      ? rangoHorario(propuesta, cita.proposed_ends_at, zona)
                      : rangoHorario(cita.starts_at, cita.ends_at, zona)}
                  </span>

                  <span className="text-text-muted text-sm">
                    {MODALIDAD[cita.modality]}
                    {" · "}
                    {distanciaEnDias(propuesta ?? cita.starts_at, zona)}
                  </span>

                  {esCambio && (
                    <span className="text-warning-700 text-sm font-medium">
                      Cambio de horario. Cita actual:{" "}
                      {capitalizar(fechaCompleta(cita.starts_at, zona))} a las{" "}
                      {enZona(cita.starts_at, zona).toFormat("HH:mm")}
                    </span>
                  )}

                  {cita.patient_note && (
                    <p className="bg-sunken text-text-body mt-1 rounded-md p-2.5 text-sm">
                      «{cita.patient_note}»
                    </p>
                  )}
                </div>

                <AccionesSolicitud citaId={cita.id} />
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
