"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  asignarEvaluacion,
  habilitarExamen,
} from "@/lib/evaluaciones/acciones-profesional";

const INICIAL = { ok: false, mensaje: "" };

export interface Instrumento {
  id: string;
  nombre: string;
}

export interface AsignacionEnSesion {
  id: string;
  status: string;
  habilitado_at: string | null;
  consentimiento: string | null;
  quien: string;
  instrumento: string;
}

/**
 * Asignar un instrumento a la sesión, y abrirlo cuando toque.
 *
 * Son dos actos separados y están a la vista como tales. Asignar se hace al
 * preparar la sesión; abrir se hace CON la persona delante, y solo después de
 * que haya aceptado. Juntarlos en un botón convertiría el consentimiento en
 * un trámite que se firma solo.
 */
export function AsignarEvaluacion({
  citaId,
  instrumentos,
  asignaciones,
}: {
  citaId: string;
  instrumentos: Instrumento[];
  asignaciones: AsignacionEnSesion[];
}) {
  const [estado, accion, enviando] = useActionState(asignarEvaluacion, INICIAL);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-h4">Evaluaciones de esta sesión</h2>
        <p className="text-muted mt-1 text-sm">
          Eliges el instrumento una vez y queda asignado a todos los convocados.
        </p>
      </div>

      {instrumentos.length === 0 ? (
        <Alert tone="info" title="No hay instrumentos activos">
          Todavía no hay ninguna prueba cargada en la plataforma.
        </Alert>
      ) : (
        <form action={accion} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="cita" value={citaId} />
          <Select
            id="instrumento"
            name="instrumento"
            label="Instrumento"
            defaultValue={instrumentos[0]?.id}
            opciones={instrumentos.map((i) => ({
              valor: i.id,
              etiqueta: i.nombre,
            }))}
          />
          <Button type="submit" disabled={enviando}>
            {enviando ? "Asignando…" : "Asignar a los convocados"}
          </Button>
        </form>
      )}

      {estado.mensaje ? (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Listo" : "No se pudo asignar"}
        >
          {estado.mensaje}
        </Alert>
      ) : null}

      {asignaciones.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {asignaciones.map((a) => (
            <FilaAsignacion key={a.id} citaId={citaId} asignacion={a} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function FilaAsignacion({
  citaId,
  asignacion,
}: {
  citaId: string;
  asignacion: AsignacionEnSesion;
}) {
  const [estado, accion, enviando] = useActionState(habilitarExamen, INICIAL);

  const aceptado = asignacion.consentimiento === "aceptado";
  const abierta = asignacion.habilitado_at !== null;

  return (
    <li className="border-line bg-panel rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-text-strong font-medium">{asignacion.quien}</p>
          <p className="text-muted text-sm">{asignacion.instrumento}</p>
        </div>

        <div className="flex items-center gap-2">
          <EstadoConsentimiento decision={asignacion.consentimiento} />
          <Badge tone={abierta ? "success" : "neutral"}>
            {etiquetaEstado(asignacion.status, abierta)}
          </Badge>
        </div>
      </div>

      {/* Abrir solo aparece cuando de verdad se puede. Un botón que siempre
          falla enseña a ignorar los errores. */}
      {asignacion.status === "asignada" && aceptado && !abierta ? (
        <form action={accion} className="mt-3">
          <input type="hidden" name="asignacion" value={asignacion.id} />
          <input type="hidden" name="cita" value={citaId} />
          <Button type="submit" variant="secondary" disabled={enviando}>
            {enviando ? "Abriendo…" : "Abrir el examen"}
          </Button>
        </form>
      ) : null}

      {estado.mensaje ? (
        <div className="mt-3">
          <Alert
            tone={estado.ok ? "success" : "danger"}
            title={estado.ok ? "Abierto" : "No se pudo abrir"}
          >
            {estado.mensaje}
          </Alert>
        </div>
      ) : null}
    </li>
  );
}

function EstadoConsentimiento({ decision }: { decision: string | null }) {
  if (decision === "aceptado") return <Badge tone="success">Consintió</Badge>;
  if (decision === "rechazado") return <Badge tone="danger">Se negó</Badge>;
  return <Badge tone="neutral">Sin responder</Badge>;
}

function etiquetaEstado(status: string, abierta: boolean) {
  if (status === "asignada") return abierta ? "Lista para empezar" : "Asignada";
  if (status === "en_curso") return "Respondiendo";
  if (status === "enviada") return "Por calificar";
  if (status === "calificada") return "Por publicar";
  if (status === "publicada") return "Publicada";
  return status;
}
