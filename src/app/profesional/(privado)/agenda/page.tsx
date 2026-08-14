import { CalendarPlus, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Controles } from "@/components/calendario/controles";
import { VistaMes } from "@/components/calendario/vista-mes";
import { VistaSemana } from "@/components/calendario/vista-semana";
import { AgendaLista } from "@/components/profesional/agenda-lista";
import { BandejaSolicitudes } from "@/components/profesional/bandeja-solicitudes";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { exigirProfesional } from "@/lib/auth/perfil";
import { nombrePaciente, type CitaConPaciente } from "@/lib/citas/estados";
import {
  ahoraEn,
  esVista,
  etiquetaZonaActiva,
  fechaDeReferencia,
  intervaloDeVista,
  tituloDePeriodo,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

/*
 * Trae la cita con todo lo que la bandeja necesita, en una sola consulta.
 *
 * Para una cita individual importa el paciente; para una sesión de evaluación
 * importan la empresa que la encargó y a quiénes convocó. Traer ambas cosas
 * siempre evita una segunda consulta por fila, que con quince sesiones en
 * pantalla serían quince viajes.
 */
const SELECT_CON_PACIENTE = [
  "*",
  "paciente:profiles!appointments_patient_id_fkey(nombre, apellidos)",
  "organizacion:organizations(nombre)",
  "convocados:appointment_attendees(persona:organization_people(nombre, apellidos, documento, cargo, vinculo))",
].join(", ");

export default async function AgendaPage({
  searchParams,
}: PageProps<"/profesional/agenda">) {
  const perfil = await exigirProfesional();
  const params = await searchParams;
  const zona = perfil.timezone;

  const vistaParam =
    typeof params.vista === "string" ? params.vista : undefined;
  const vista = esVista(vistaParam) ? vistaParam : "semana";
  const referencia = fechaDeReferencia(
    typeof params.fecha === "string" ? params.fecha : undefined,
    zona,
  );
  const intervalo = intervaloDeVista(vista, referencia);
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;

  const supabase = await crearClienteServidor();

  const [{ data: delPeriodo }, { data: pendientes }] = await Promise.all([
    supabase
      .from("appointments")
      .select(SELECT_CON_PACIENTE)
      .gte("starts_at", intervalo.start!.toUTC().toISO()!)
      .lte("starts_at", intervalo.end!.toUTC().toISO()!)
      .order("starts_at"),
    supabase
      .from("appointments")
      .select(SELECT_CON_PACIENTE)
      .in("status", ["solicitada", "reprogramacion_solicitada"])
      .order("starts_at"),
  ]);

  const citas = (delPeriodo ?? []) as unknown as CitaConPaciente[];
  const solicitudes = (pendientes ?? []) as unknown as CitaConPaciente[];

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1">Agenda</h1>
          <p className="text-text-muted flex items-center gap-1.5 text-sm">
            <Clock aria-hidden="true" className="size-3.5" />
            {etiquetaZonaActiva(zona)}
          </p>
        </div>

        <Link
          href="/profesional/agenda/nueva"
          className={buttonVariants({ size: "md" })}
        >
          <CalendarPlus aria-hidden="true" className="size-4" />
          Nueva cita
        </Link>
      </header>

      {params.agendada === "1" && (
        <Alert tone="success" title="Cita agendada">
          El paciente la verá como confirmada en su calendario.
        </Alert>
      )}
      {params.confirmada === "1" && (
        <Alert tone="success" title="Cita confirmada">
          El paciente la verá confirmada y recibirá un aviso por correo.
        </Alert>
      )}
      {params.rechazada === "1" && (
        <Alert tone="info" title="Solicitud rechazada">
          Se avisará al paciente para que proponga otro horario.
        </Alert>
      )}

      <BandejaSolicitudes solicitudes={solicitudes} zona={zona} />

      <section className="flex flex-col gap-4">
        <h2 className="text-h3" aria-live="polite">
          {tituloDePeriodo(vista, referencia)}
        </h2>

        <Controles
          vista={vista}
          referencia={referencia}
          hoy={ahoraEn(zona)}
          ruta="/profesional/agenda"
        />

        {(vista === "agenda" || vista === "mes") && (
          <>
            {/* En mes, la retícula solo desde `sm`: en móvil el profesional
                necesita leer nombres, y en una celda de 45 px no caben. */}
            {vista === "mes" && (
              <div className="hidden sm:block">
                <VistaMes
                  referencia={referencia}
                  citas={citas}
                  zona={zona}
                  etiquetaDeCita={nombrePaciente}
                  base="/profesional/citas"
                  rutaVista="/profesional/agenda"
                />
              </div>
            )}
            <div className={vista === "mes" ? "sm:hidden" : undefined}>
              <AgendaLista citas={citas} zona={zona} ahoraISO={ahoraISO} />
            </div>
          </>
        )}

        {vista === "semana" && (
          <VistaSemana
            referencia={referencia}
            citas={citas}
            zona={zona}
            etiquetaDeCita={nombrePaciente}
            base="/profesional/citas"
          />
        )}

        {vista === "dia" && (
          <div className="flex flex-col gap-6">
            <VistaSemana
              referencia={referencia}
              citas={citas}
              zona={zona}
              dias={1}
              etiquetaDeCita={nombrePaciente}
              base="/profesional/citas"
            />
            <AgendaLista citas={citas} zona={zona} ahoraISO={ahoraISO} />
          </div>
        )}
      </section>
    </div>
  );
}
