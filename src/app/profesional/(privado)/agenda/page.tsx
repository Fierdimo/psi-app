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
import {
  SELECT_DE_CITA,
  titularDeCita,
  type CitaConPaciente,
} from "@/lib/citas/estados";
import { porJornadas, type Jornada } from "@/lib/citas/jornadas";
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

export default async function AgendaPage({
  searchParams,
}: PageProps<"/profesional/agenda">) {
  const perfil = await exigirProfesional();
  const params = await searchParams;
  const zona = perfil.timezone;

  const vistaParam =
    typeof params.vista === "string" ? params.vista : undefined;
  /*
   * El mes, por defecto.
   *
   * Entraba en «semana», que responde «qué hago hoy» — y para eso ya está la
   * lista de solicitudes y la propia jornada. Quien abre la agenda casi
   * siempre viene a lo contrario: ver dónde hay hueco para colocar una sesión
   * que le acaban de pedir, y eso no cabe en siete días.
   */
  const vista = esVista(vistaParam) ? vistaParam : "mes";
  const referencia = fechaDeReferencia(
    typeof params.fecha === "string" ? params.fecha : undefined,
    zona,
  );
  const intervalo = intervaloDeVista(vista, referencia);
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;

  const supabase = await crearClienteServidor();

  const desdeISO = intervalo.start!.toUTC().toISO()!;
  const hastaISO = intervalo.end!.toUTC().toISO()!;

  const [{ data: delPeriodo }, { data: pendientes }, { data: porJornada }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(SELECT_DE_CITA)
        .gte("starts_at", desdeISO)
        .lte("starts_at", hastaISO)
        .order("starts_at"),
      supabase
        .from("appointments")
        .select(SELECT_DE_CITA)
        .in("status", ["solicitada", "reprogramacion_solicitada"])
        .order("starts_at"),
      /*
       * En qué días hay gente citada, según la hora de CADA persona.
       *
       * La consulta de arriba filtra por `starts_at` de la cita, que en una
       * sesión repartida es la hora del primero de la tanda. Mirando la semana
       * del miércoles, una sesión que arrancó el lunes no entra por ahí, y sus
       * convocados del miércoles desaparecían de la agenda.
       */
      supabase.rpc("jornadas_de_sesion", {
        p_desde: desdeISO,
        p_hasta: hastaISO,
        p_zona: zona,
      }),
    ]);

  const jornadas = (porJornada ?? []) as Jornada[];
  const enElPeriodo = (delPeriodo ?? []) as unknown as CitaConPaciente[];

  /*
   * Las sesiones que asoman en este periodo pero empezaron fuera de él.
   *
   * Solo hace falta un viaje más cuando de verdad hay alguna: en una agenda
   * sin tandas repartidas, este arreglo no cuesta nada.
   */
  const rezagadas = [...new Set(jornadas.map((j) => j.appointment_id))].filter(
    (id) => !enElPeriodo.some((c) => c.id === id),
  );

  const { data: deFuera } = rezagadas.length
    ? await supabase
        .from("appointments")
        .select(SELECT_DE_CITA)
        .in("id", rezagadas)
    : { data: null };

  const citas = porJornadas(
    [...enElPeriodo, ...((deFuera ?? []) as unknown as CitaConPaciente[])],
    jornadas,
  );

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

      {/*
        El calendario y lo que espera decisión, uno al lado del otro.

        La bandeja iba ARRIBA y empujaba el calendario fuera de la pantalla:
        con tres solicitudes había que desplazarse para ver el día de hoy, que
        es a lo que se entra. Como columna no compite por el mismo sitio, y las
        dos cosas que se miran juntas se ven juntas.

        En pantallas estrechas vuelve a ir encima, que es donde cabe: ahí no
        hay dos columnas que repartir.
      */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-4">
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
                    etiquetaDeCita={titularDeCita}
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
              etiquetaDeCita={titularDeCita}
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
                etiquetaDeCita={titularDeCita}
                base="/profesional/citas"
              />
              <AgendaLista citas={citas} zona={zona} ahoraISO={ahoraISO} />
            </div>
          )}
        </section>

        {solicitudes.length > 0 && (
          <aside className="w-full shrink-0 xl:w-[380px]">
            <BandejaSolicitudes solicitudes={solicitudes} zona={zona} />
          </aside>
        )}
      </div>
    </div>
  );
}
