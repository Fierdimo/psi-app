import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormularioNuevaCita } from "@/components/profesional/formulario-nueva-cita";
import { Card } from "@/components/ui/card";
import { exigirProfesional } from "@/lib/auth/perfil";
import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  ahoraEn,
  etiquetaZonaActiva,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Nueva cita",
  robots: { index: false, follow: false },
};

function horasDisponibles() {
  const horas: string[] = [];
  for (let h = HORA_INICIO_JORNADA; h < HORA_FIN_JORNADA; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
    horas.push(`${String(h).padStart(2, "0")}:30`);
  }
  return horas;
}

export default async function NuevaCitaPage() {
  const perfil = await exigirProfesional();
  const supabase = await crearClienteServidor();

  const [{ data: pacientes }, { data: parametros }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nombre, apellidos")
      .eq("role", "paciente")
      .order("apellidos"),
    supabase
      .from("clinic_settings")
      .select("default_duration_minutes")
      .single(),
  ]);

  const opciones = (pacientes ?? []).map((p) => ({
    valor: p.id,
    etiqueta: [p.nombre, p.apellidos].filter(Boolean).join(" ") || "Sin nombre",
  }));

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/profesional/agenda"
        className="text-text-muted hover:text-accent inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a la agenda
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-h1">Nueva cita</h1>
        <p className="text-text-muted text-sm">
          Se creará confirmada. Las horas son las tuyas:{" "}
          {etiquetaZonaActiva(perfil.timezone)}.
        </p>
      </div>

      <Card className="flex flex-col gap-6">
        <FormularioNuevaCita
          pacientes={opciones}
          horas={horasDisponibles()}
          duracionMinutos={parametros?.default_duration_minutes ?? 60}
          fechaHoy={ahoraEn(perfil.timezone).toISODate()!}
        />
      </Card>
    </div>
  );
}
