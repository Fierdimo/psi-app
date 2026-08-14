"use client";

import { useActionState, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { solicitarSesion } from "@/lib/empresa/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

const DURACIONES = [
  { valor: "60", etiqueta: "1 hora" },
  { valor: "120", etiqueta: "2 horas" },
  { valor: "180", etiqueta: "3 horas" },
  { valor: "240", etiqueta: "4 horas" },
];

export type PersonaConvocable = {
  id: string;
  nombre: string;
  documento: string;
};

/**
 * Solicitud de una sesión de evaluación.
 *
 * La lista de personas es de casillas y no de un desplegable múltiple: se
 * convoca a varias a la vez y hay que poder ver a quién se marcó sin abrir
 * nada. El contador está a la vista porque el número de convocados es lo que
 * determina cuánto dura la sesión.
 */
export function FormularioSesion({
  personas,
  fechaMinima,
}: {
  personas: PersonaConvocable[];
  fechaMinima: string;
}) {
  const [estado, accion, enviando] = useActionState(solicitarSesion, INICIAL);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  /*
   * Tras un envío correcto React reinicia el formulario y las casillas vuelven
   * a verse vacías. La selección vive además en estado propio —hace falta para
   * el contador— y si no se limpia también, la pantalla dice «2 de 3» sobre
   * tres casillas sin marcar. Se descubrió mirando la pantalla después de
   * enviar, no leyendo el código.
   */
  useEffect(() => {
    if (estado.ok) setMarcadas(new Set());
  }, [estado.ok]);

  if (personas.length === 0) {
    return (
      <Alert tone="info" title="Primero carga a las personas">
        Una sesión convoca a personas de tu listado. Añade al menos a una y
        vuelve aquí.
      </Alert>
    );
  }

  function alternar(id: string) {
    setMarcadas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-h4">Solicitar una sesión</h2>
        <p className="text-text-muted text-sm">
          Propones día y hora. El profesional te contacta para resolver el
          trámite y la confirma después: hasta entonces no queda en firme.
        </p>
      </div>

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Solicitud enviada" : "No se pudo solicitar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="fecha"
          name="fecha"
          type="date"
          label="Día"
          min={fechaMinima}
          error={estado.errores?.fecha}
        />
        <Field
          id="hora"
          name="hora"
          type="time"
          label="Hora de inicio"
          defaultValue="09:00"
          error={estado.errores?.hora}
        />
        <Select
          id="duracion"
          name="duracion"
          label="Duración"
          opciones={DURACIONES}
          defaultValue="120"
          error={estado.errores?.duracion}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-text-strong flex flex-wrap items-baseline gap-2 font-medium">
          A quién convocas
          <span className="text-text-muted text-sm font-normal">
            {marcadas.size === 0
              ? "ninguna seleccionada"
              : `${marcadas.size} de ${personas.length}`}
          </span>
        </legend>

        {estado.errores?.personas && (
          <p className="text-danger-600 text-sm">{estado.errores.personas}</p>
        )}

        <ul className="border-line divide-line max-h-72 divide-y overflow-y-auto rounded-md border">
          {personas.map((p) => (
            <li key={p.id}>
              <label className="hover:bg-bg flex cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  name="personas"
                  value={p.id}
                  checked={marcadas.has(p.id)}
                  onChange={() => alternar(p.id)}
                  className="accent-accent size-4"
                />
                <span className="text-text-body">{p.nombre}</span>
                <span className="text-text-muted tabular ml-auto text-sm">
                  {p.documento}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <Field
        id="nota"
        name="nota"
        label="Para qué es la evaluación"
        placeholder="Por ejemplo: selección para dos cargos operativos."
        error={estado.errores?.nota}
      />

      <div>
        <Button type="submit" loading={enviando ? "Enviando…" : undefined}>
          Enviar solicitud
        </Button>
      </div>
    </form>
  );
}
