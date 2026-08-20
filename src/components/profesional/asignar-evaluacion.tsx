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

      {/*
        Sin listado de personas.

        Enseñaba una fila por convocado con su estado y su consentimiento, y
        era la TERCERA lista de los mismos nombres en esta pantalla. Todo eso
        vive ahora en la fila del reparto, junto a su hora y su acceso. Aquí
        queda el único acto que no es de una persona sino de la sesión entera:
        elegir el instrumento.
      */}
      {asignaciones.length > 0 && (
        <p className="text-text-muted text-sm">
          {asignaciones.length === 1
            ? "1 persona ya tiene su evaluación asignada."
            : `${asignaciones.length} personas ya tienen su evaluación asignada.`}{" "}
          Su estado está arriba, en la fila de cada una.
        </p>
      )}
    </section>
  );
}
