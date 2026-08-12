import { ArrowLeft, Clock, MapPin, User, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AccionesCierre,
  AccionesSolicitud,
} from "@/components/profesional/acciones-solicitud";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { exigirProfesional } from "@/lib/auth/perfil";
import {
  ASPECTO,
  MODALIDAD,
  esPendiente,
  nombrePaciente,
  type CitaConPaciente,
} from "@/lib/citas/estados";
import {
  ahoraEn,
  capitalizar,
  distanciaEnDias,
  enZona,
  fechaCompleta,
  rangoHorario,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Detalle de la cita",
  robots: { index: false, follow: false },
};

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

export default async function CitaProfesionalPage({
  params,
}: PageProps<"/profesional/citas/[id]">) {
  const perfil = await exigirProfesional();
  const { id } = await params;
  const zona = perfil.timezone;

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("appointments")
    .select(
      "*, paciente:profiles!appointments_patient_id_fkey(nombre, apellidos)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const cita = data as unknown as CitaConPaciente;
  const aspecto = ASPECTO[cita.status];
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;
  const porCerrar = cita.status === "confirmada" && cita.ends_at < ahoraISO;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/profesional/agenda"
        className="text-text-muted hover:text-accent inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a la agenda
      </Link>

      <Card edge="shadow" accent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-h2">
            {capitalizar(fechaCompleta(cita.starts_at, zona))}
          </h1>
          <Badge tone={aspecto.tono}>{aspecto.etiqueta}</Badge>
        </div>

        <div className="flex flex-col gap-3">
          <Dato icono={User}>
            <Link
              href={`/profesional/pacientes/${cita.patient_id}`}
              className="text-accent font-medium"
            >
              {nombrePaciente(cita)}
            </Link>
          </Dato>

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
          </Dato>
        </div>

        {cita.status === "reprogramacion_solicitada" &&
          cita.proposed_starts_at && (
            <Alert tone="warning" title="Pidió cambiar el horario">
              Propone el{" "}
              {capitalizar(fechaCompleta(cita.proposed_starts_at, zona))} a las{" "}
              {enZona(cita.proposed_starts_at, zona).toFormat("HH:mm")}. Al
              confirmar, la cita se moverá a esa hora.
            </Alert>
          )}

        {cita.patient_note && (
          <div className="bg-sunken flex flex-col gap-1 rounded-md p-3.5">
            <span className="text-text-muted text-micro font-semibold tracking-[0.06em] uppercase">
              Mensaje del paciente
            </span>
            <p className="text-text-body text-sm">{cita.patient_note}</p>
          </div>
        )}

        {esPendiente(cita.status) && (
          <div className="border-line border-t pt-5">
            <AccionesSolicitud citaId={cita.id} />
          </div>
        )}

        {porCerrar && (
          <div className="border-line flex flex-col gap-2 border-t pt-5">
            <p className="text-text-body text-sm">
              Esta cita ya pasó. Registra si la persona asistió para cerrarla.
            </p>
            <AccionesCierre citaId={cita.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
