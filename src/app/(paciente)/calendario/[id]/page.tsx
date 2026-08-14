import { ArrowLeft, CalendarDays, Clock, MapPin, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccionesCita } from "@/components/calendario/acciones-cita";
import { Pantalla } from "@/components/navegacion/encabezado-pagina";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { exigirSesion } from "@/lib/auth/perfil";
import {
  ASPECTO,
  MODALIDAD,
  puedeCancelar,
  puedeReprogramar,
  type Cita,
} from "@/lib/citas/estados";
import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  ahoraEn,
  capitalizar,
  distanciaEnDias,
  enZona,
  fechaCompleta,
  rangoHorario,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detalle de la cita" };

function horasDisponibles() {
  const horas: string[] = [];
  for (let h = HORA_INICIO_JORNADA; h < HORA_FIN_JORNADA; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
    horas.push(`${String(h).padStart(2, "0")}:30`);
  }
  return horas;
}

function Dato({
  icono: Icono,
  children,
}: {
  icono: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="text-text-body flex items-start gap-2.5">
      <Icono
        aria-hidden="true"
        className="text-text-muted mt-0.5 size-4.5 shrink-0"
      />
      <span>{children}</span>
    </div>
  );
}

export default async function DetalleCitaPage({
  params,
  searchParams,
}: PageProps<"/calendario/[id]">) {
  const perfil = await exigirSesion();
  const { id } = await params;
  const query = await searchParams;
  const zona = perfil.timezone;

  const supabase = await crearClienteServidor();

  // Sin filtro por paciente a propósito: lo aplica RLS. Si la cita es de otra
  // persona la consulta no devuelve nada y se responde 404 — igual que si no
  // existiera. Un 403 confirmaría que ese identificador sí existe.
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .is("organization_id", null)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const cita = data as Cita;
  const aspecto = ASPECTO[cita.status];
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;

  const { data: parametros } = await supabase
    .from("clinic_settings")
    .select("min_notice_hours, cancellation_policy")
    .single();

  const margen = parametros?.min_notice_hours ?? 24;
  const fechaMinima = ahoraEn(zona).plus({ hours: margen }).toISODate()!;

  return (
    <Pantalla>
      <div className="flex max-w-[640px] flex-col gap-6">
        <Link
          href="/calendario"
          className="text-text-muted hover:text-accent inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al calendario
        </Link>

        {query.cambio === "1" && (
          <Alert tone="success" title="Solicitud de cambio enviada">
            Tu cita actual sigue en pie hasta que tu profesional responda.
          </Alert>
        )}

        <Card edge="shadow" accent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-h2">
              {capitalizar(fechaCompleta(cita.starts_at, zona))}
            </h1>
            <Badge tone={aspecto.tono}>{aspecto.etiqueta}</Badge>
          </div>

          <div className="flex flex-col gap-3">
            <Dato icono={Clock}>
              <span className="tabular text-lg">
                {rangoHorario(cita.starts_at, cita.ends_at, zona)}
              </span>
              <span className="text-text-muted ml-2 text-sm">
                {distanciaEnDias(cita.starts_at, zona)}
              </span>
            </Dato>

            <Dato icono={cita.modality === "virtual" ? Video : MapPin}>
              {MODALIDAD[cita.modality]}
              {cita.location && ` · ${cita.location}`}
              {cita.modality === "virtual" && !cita.meeting_url && (
                <span className="text-text-muted">
                  {" "}
                  · recibirás el enlace antes de la sesión
                </span>
              )}
            </Dato>

            {cita.meeting_url && (
              <Dato icono={Video}>
                <a
                  href={cita.meeting_url}
                  className="text-accent font-medium underline"
                >
                  Entrar a la videollamada
                </a>
              </Dato>
            )}
          </div>

          {cita.status === "reprogramacion_solicitada" &&
            cita.proposed_starts_at && (
              <Alert tone="warning" title="Cambio de horario pendiente">
                Has propuesto el{" "}
                {capitalizar(fechaCompleta(cita.proposed_starts_at, zona))} a
                las {enZona(cita.proposed_starts_at, zona).toFormat("HH:mm")}.
                Tu cita actual se mantiene hasta que tu profesional responda.
              </Alert>
            )}

          {cita.status === "solicitada" && (
            <Alert tone="warning" title="Todavía sin confirmar">
              Este horario está propuesto, no reservado. Te avisaremos por
              correo en cuanto tu profesional responda.
            </Alert>
          )}

          {cita.patient_note && (
            <div className="bg-sunken flex flex-col gap-1 rounded-md p-3.5">
              <span className="text-text-muted text-micro font-semibold tracking-[0.06em] uppercase">
                Tu mensaje
              </span>
              <p className="text-text-body text-sm">{cita.patient_note}</p>
            </div>
          )}

          <AccionesCita
            citaId={cita.id}
            puedeReprogramar={puedeReprogramar(cita, ahoraISO)}
            puedeCancelar={puedeCancelar(cita, ahoraISO)}
            fechaMinima={fechaMinima}
            horas={horasDisponibles()}
            margenHoras={margen}
            politicaCancelacion={parametros?.cancellation_policy ?? null}
          />
        </Card>

        <p className="text-text-muted text-micro flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          Solicitada el {fechaCompleta(cita.created_at, zona)}
        </p>
      </div>
    </Pantalla>
  );
}
