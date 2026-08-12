import { ArrowLeft, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgendaLista } from "@/components/profesional/agenda-lista";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { exigirProfesional } from "@/lib/auth/perfil";
import type { CitaConPaciente } from "@/lib/citas/estados";
import {
  ahoraEn,
  etiquetaZonaActiva,
  fechaCompleta,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ficha de paciente",
  robots: { index: false, follow: false },
};

function Dato({
  icono: Icono,
  children,
}: {
  icono: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <span className="text-text-body flex items-center gap-2 text-sm">
      <Icono aria-hidden="true" className="text-text-muted size-4 shrink-0" />
      {children}
    </span>
  );
}

export default async function FichaPacientePage({
  params,
}: PageProps<"/profesional/pacientes/[id]">) {
  const perfil = await exigirProfesional();
  const { id } = await params;
  const zona = perfil.timezone;

  const supabase = await crearClienteServidor();

  const { data: paciente } = await supabase
    .from("profiles")
    .select("id, nombre, apellidos, telefono, documento, timezone, role")
    .eq("id", id)
    .maybeSingle();

  if (!paciente || paciente.role !== "paciente") notFound();

  const [{ data: citas }, { data: baja }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("account_deletion_requests")
      .select("requested_at, motivo")
      .eq("user_id", id)
      .eq("status", "solicitada")
      .maybeSingle(),
  ]);

  const nombre =
    [paciente.nombre, paciente.apellidos].filter(Boolean).join(" ") ||
    "Sin nombre";

  const historial = ((citas ?? []) as CitaConPaciente[]).map((c) => ({
    ...c,
    paciente: { nombre: paciente.nombre, apellidos: paciente.apellidos },
  }));

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/profesional/pacientes"
        className="text-text-muted hover:text-accent inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a pacientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">{nombre}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {paciente.telefono && (
              <Dato icono={Phone}>{paciente.telefono}</Dato>
            )}
            {paciente.documento && (
              <Dato icono={Mail}>Doc. {paciente.documento}</Dato>
            )}
          </div>
          {/* Su zona puede no ser la tuya: al acordar una hora por teléfono es
              lo primero que hay que mirar. */}
          <p className="text-text-muted text-micro">
            Su zona horaria: {etiquetaZonaActiva(paciente.timezone)}
          </p>
        </div>

        <Link
          href="/profesional/agenda/nueva"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Agendar cita
        </Link>
      </header>

      {baja && (
        <Alert tone="warning" title="Solicitó eliminar su cuenta">
          Pedida el {fechaCompleta(baja.requested_at, zona)}.
          {baja.motivo && ` Motivo: «${baja.motivo}».`} Revisa qué información
          puede eliminarse y cuál debes conservar por obligación profesional.
        </Alert>
      )}

      <Card sunken className="text-text-body text-sm">
        Esta ficha muestra datos de contacto y agenda. Las notas clínicas no se
        guardan en la plataforma: siguen bajo tu control y tu responsabilidad.
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">Historial de citas ({historial.length})</h2>
        <AgendaLista
          citas={historial}
          zona={zona}
          ahoraISO={ahoraEn(zona).toUTC().toISO()!}
        />
      </section>
    </div>
  );
}
