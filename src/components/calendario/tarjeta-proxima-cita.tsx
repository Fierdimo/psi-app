import { CalendarPlus, MapPin, Video } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ASPECTO, MODALIDAD, type Cita } from "@/lib/citas/estados";
import {
  capitalizar,
  distanciaEnDias,
  fechaLarga,
  rangoHorario,
} from "@/lib/fechas/formato";

/**
 * Tarjeta de próxima cita (SPEC.md §7.3).
 *
 * El elemento más importante de la aplicación: es lo que el paciente viene a
 * ver. Por eso responde la pregunta completa —cuándo, a qué hora, dónde y en
 * cuántos días— sin obligar a entrar a ningún sitio.
 *
 * Si no hay próxima cita, la tarjeta NO desaparece: se convierte en la
 * invitación a solicitar una. Un panel que se queda vacío deja a la persona
 * sin saber qué hacer.
 */
export function TarjetaProximaCita({
  cita,
  zona,
}: {
  cita: Cita | null;
  zona: string;
}) {
  if (!cita) {
    return (
      <Card edge="border" className="flex flex-col items-start gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-text-muted text-micro font-semibold tracking-[0.09em] uppercase">
            Próxima cita
          </span>
          <h2 className="text-h3">No tienes citas programadas</h2>
          <p className="text-text-body max-w-[52ch]">
            Puedes proponer un día y una hora, y tu profesional confirmará si le
            encaja.
          </p>
        </div>

        <Link href="/solicitar-cita" className={buttonVariants()}>
          <CalendarPlus aria-hidden="true" className="size-4" />
          Solicitar una cita
        </Link>
      </Card>
    );
  }

  const aspecto = ASPECTO[cita.status];
  const esVirtual = cita.modality === "virtual";

  return (
    <Card edge="shadow" accent className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-text-muted text-micro font-semibold tracking-[0.09em] uppercase">
          Próxima cita
        </span>
        <Badge tone={aspecto.tono}>{aspecto.etiqueta}</Badge>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-h3">
          {capitalizar(fechaLarga(cita.starts_at, zona))}
        </h2>
        <p className="text-text-body tabular text-lg">
          {rangoHorario(cita.starts_at, cita.ends_at, zona)} ·{" "}
          {MODALIDAD[cita.modality]}
        </p>
        {cita.location && (
          <p className="text-text-muted flex items-center gap-1.5 text-sm">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {cita.location}
          </p>
        )}
        {esVirtual && !cita.meeting_url && (
          <p className="text-text-muted flex items-center gap-1.5 text-sm">
            <Video aria-hidden="true" className="size-3.5 shrink-0" />
            Recibirás el enlace antes de la sesión
          </p>
        )}
      </div>

      <div>
        <span className="bg-accent-soft text-accent-on-soft inline-block rounded-sm px-2.5 py-1 text-sm font-medium">
          {distanciaEnDias(cita.starts_at, zona)}
        </span>
      </div>

      {cita.status === "solicitada" && (
        <p className="text-warning-700 text-sm">
          Todavía sin confirmar. Te avisaremos por correo en cuanto tu
          profesional responda.
        </p>
      )}

      <div className="border-line flex flex-wrap items-center justify-end gap-2.5 border-t pt-4">
        {/*
          Pedir cita se podía SOLO desde el calendario.
          Quien entra a su espacio aterriza aquí, y con una cita ya agendada
          esta tarjeta no ofrecía ninguna forma de pedir otra: había que
          adivinar que el camino era entrar a «Calendario». La acción más
          importante del área no puede estar escondida una pantalla más
          adentro.
        */}
        <Link
          href="/solicitar-cita"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <CalendarPlus aria-hidden="true" className="size-4" />
          Solicitar otra cita
        </Link>

        <Link
          href="/calendario"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Ver calendario
        </Link>
        <Link
          href={`/calendario/${cita.id}`}
          className={buttonVariants({ size: "sm" })}
        >
          Ver detalle
        </Link>
      </div>
    </Card>
  );
}
