import { ArrowLeft, Clock, MapPin, User, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AccionesCierre,
  AccionesSolicitud,
} from "@/components/profesional/acciones-solicitud";
import { AsignarEvaluacion } from "@/components/profesional/asignar-evaluacion";
import { BotonInvitaciones } from "@/components/profesional/boton-invitaciones";
import { Convocados } from "@/components/profesional/convocados";
import { OrganizadorDelDia } from "@/components/profesional/organizador-del-dia";
import { PasesDeSesion } from "@/components/citas/pases-de-sesion";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { exigirProfesional } from "@/lib/auth/perfil";
import {
  ASPECTO,
  MODALIDAD,
  esDeEmpresa,
  esPendiente,
  nombrePaciente,
  titularDeCita,
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
      [
        "*",
        "paciente:profiles!appointments_patient_id_fkey(nombre, apellidos)",
        "organizacion:organizations(nombre)",
        "convocados:appointment_attendees(persona:organization_people(nombre, apellidos, documento, cargo, vinculo, profile_id))",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const cita = data as unknown as CitaConPaciente;
  const aspecto = ASPECTO[cita.status];
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;
  const porCerrar = cita.status === "confirmada" && cita.ends_at < ahoraISO;

  /*
   * Las evaluaciones de la sesión, con el consentimiento de cada persona.
   *
   * El consentimiento se pide por asignación y no en bloque porque es lo que
   * decide si el examen puede abrirse: mostrarlo aquí evita ofrecer un botón
   * que la base va a rechazar.
   */
  const [{ data: instrumentos }, { data: asignadas }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("assignments")
      .select(
        "id, status, habilitado_at, assessment:assessments(nombre), persona:organization_people(nombre, apellidos), paciente:profiles!assignments_patient_id_fkey(nombre, apellidos)",
      )
      .eq("appointment_id", id),
  ]);

  const asignaciones = await Promise.all(
    (asignadas ?? []).map(async (a) => {
      const { data: decision } = await supabase.rpc("consentimiento_de", {
        p_assignment: a.id,
      });

      /*
       * PostgREST devuelve las relaciones embebidas como arreglo aunque sean
       * de uno. Se normaliza en vez de forzar el tipo: forzarlo compila y
       * luego da `undefined` en tiempo de ejecución, que es peor que un error.
       */
      const uno = <T,>(v: unknown): T | null =>
        Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

      type Nombre = { nombre: string; apellidos: string | null };

      const quien = uno<Nombre>(a.persona) ?? uno<Nombre>(a.paciente);

      return {
        id: a.id,
        status: a.status,
        habilitado_at: a.habilitado_at,
        consentimiento: (decision as string | null) ?? null,
        quien: quien
          ? [quien.nombre, quien.apellidos].filter(Boolean).join(" ")
          : "Sin nombre",
        instrumento: uno<{ nombre: string }>(a.assessment)?.nombre ?? "",
      };
    }),
  );

  const deEmpresa = esDeEmpresa(cita);
  const convocados = (cita.convocados ?? [])
    .map((c) => c.persona)
    .filter((p) => p !== null);

  /*
   * El reparto se pide aparte, por RPC.
   *
   * La consulta de la cita ya trae a los convocados, pero sin su hora: añadir
   * las columnas ahí habría obligado a que cada pantalla que lee convocados
   * cargara también el reparto. Esta es la única que lo necesita.
   */
  const { data: repartoBruto } = deEmpresa
    ? await supabase.rpc("reparto_de_sesion", { p_appointment_id: cita.id })
    : { data: null };

  const reparto = (repartoBruto ?? []) as {
    person_id: string;
    nombre: string;
    apellidos: string | null;
    documento: string | null;
    starts_at: string | null;
  }[];

  // El día y la hora que propuso la empresa: por donde se empieza a mirar.
  const fechaDeLaSesion = enZona(cita.starts_at, zona).toISODate()!;
  const horaDeLaSesion = enZona(cita.starts_at, zona).toFormat("HH:mm");

  // Quien todavía no tiene cuenta es a quien hay que invitar.
  const sinCuenta = convocados.filter(
    (p) => (p as { profile_id?: string | null }).profile_id == null,
  ).length;

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
            {deEmpresa ? (
              <span className="text-text-strong font-medium">
                {titularDeCita(cita)}
              </span>
            ) : (
              <Link
                href={`/profesional/pacientes/${cita.patient_id}`}
                className="text-accent font-medium"
              >
                {nombrePaciente(cita)}
              </Link>
            )}
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
              {deEmpresa ? "Mensaje de la empresa" : "Mensaje del paciente"}
            </span>
            <p className="text-text-body text-sm">{cita.patient_note}</p>
          </div>
        )}

        {/*
          El tablero, ANTES de aceptar.

          Aceptar una solicitud de empresa era decir «sí» a un bloque de tres
          horas con diez nombres dentro, sin saber si cabían ni en qué orden. El
          reparto es justo lo que hay que mirar para decidir, así que va aquí y
          no detrás de la confirmación.

          Sigue disponible después: el motivo por el que se mueve gente —una
          urgencia, una ausencia— aparece casi siempre con la sesión ya
          confirmada.
        */}
        {deEmpresa &&
          ["solicitada", "reprogramacion_solicitada", "confirmada"].includes(
            cita.status,
          ) && (
            <div className="border-line flex flex-col gap-3 border-t pt-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-h4">Organizar el día</h2>
                <p className="text-text-muted text-sm">
                  Elige a qué hora empieza el primero; el resto va detrás.
                </p>
              </div>

              <OrganizadorDelDia
                citaId={cita.id}
                convocados={reparto}
                fechaInicial={fechaDeLaSesion}
                horaInicial={horaDeLaSesion}
                zona={zona}
              />
            </div>
          )}

        {deEmpresa && (
          <div className="border-line flex flex-col gap-3 border-t pt-5">
            <h2 className="text-h4">Convocados</h2>
            <Convocados personas={convocados} compacto plegable abierto />
          </div>
        )}

        {esPendiente(cita.status) && (
          <div className="border-line border-t pt-5">
            <AccionesSolicitud citaId={cita.id} />
          </div>
        )}

        {/* Solo con la sesión ya confirmada: invitar a algo sin confirmar sería
            convocar a lo que todavía no existe. */}
        {deEmpresa && cita.status === "confirmada" && (
          <div className="border-line flex flex-col gap-3 border-t pt-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-h4">Acceso de los convocados</h2>
              <p className="text-text-muted text-sm">
                Cada persona tiene su enlace para crear la cuenta y aceptar su
                consentimiento. Quien ya tenga cuenta no necesita nada.
              </p>
            </div>

            {/*
              Los pases se ven, no se piden.

              Existen desde que confirmaste la sesión. El botón de abajo hace lo
              único que sigue siendo un acto: mandarlos por correo.
            */}
            <PasesDeSesion citaId={cita.id} />

            <BotonInvitaciones citaId={cita.id} pendientes={sinCuenta} />
          </div>
        )}

        {cita.status === "confirmada" && (
          <div className="border-line border-t pt-5">
            <AsignarEvaluacion
              citaId={cita.id}
              instrumentos={instrumentos ?? []}
              asignaciones={asignaciones}
            />
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
