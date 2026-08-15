import { Building2, Inbox } from "lucide-react";

import { AccionesSolicitud } from "./acciones-solicitud";
import { Convocados } from "./convocados";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  esDeEmpresa,
  MODALIDAD,
  titularDeCita,
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
  /** En su propia pantalla el título ya lo pone el encabezado de la página. */
  sinEncabezado = false,
}: {
  solicitudes: CitaConPaciente[];
  zona: string;
  sinEncabezado?: boolean;
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
      {sinEncabezado ? null : (
        <h2 className="text-h3">
          Solicitudes pendientes ({solicitudes.length})
        </h2>
      )}

      <ul className="flex flex-col gap-3">
        {solicitudes.map((cita) => {
          const esCambio = cita.status === "reprogramacion_solicitada";
          const propuesta = cita.proposed_starts_at;
          const deEmpresa = esDeEmpresa(cita);

          // Una sesión de evaluación se pide para varias personas a la vez. Se
          // muestran dentro de la solicitud de su empresa, no como entradas
          // sueltas: es un solo compromiso y se acepta o se rechaza entero.
          const convocados = (cita.convocados ?? [])
            .map((c) => c.persona)
            .filter((p) => p !== null);

          return (
            <li key={cita.id}>
              <Card
                edge="border"
                accent
                className="flex flex-wrap items-start justify-between gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {deEmpresa && (
                      <Building2
                        aria-hidden="true"
                        className="text-accent size-4.5 shrink-0"
                      />
                    )}
                    <span className="text-text-strong text-base font-semibold">
                      {titularDeCita(cita)}
                    </span>
                    {deEmpresa && (
                      <Badge tone="accent">Sesión de evaluación</Badge>
                    )}
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

                  {deEmpresa && (
                    <div className="pt-1">
                      <Convocados personas={convocados} />
                    </div>
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
