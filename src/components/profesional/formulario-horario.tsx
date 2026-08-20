"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { actualizarHorario } from "@/lib/citas/acciones-horario";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Fracciones fijas, no un campo libre.
 *
 * El tamaño de bloque no es una preferencia estética: divide la jornada, y un
 * número arbitrario —37 minutos— deja restos que no encajan con nada y hacen
 * imposible razonar sobre el día. Estas son las que se usan en consulta.
 */
const DURACIONES = [
  { valor: "20", etiqueta: "20 minutos" },
  { valor: "30", etiqueta: "30 minutos" },
  { valor: "45", etiqueta: "45 minutos" },
  { valor: "60", etiqueta: "1 hora" },
  { valor: "90", etiqueta: "1 hora y media" },
  { valor: "120", etiqueta: "2 horas" },
];

const DIAS = [
  { valor: 1, texto: "Lun" },
  { valor: 2, texto: "Mar" },
  { valor: 3, texto: "Mié" },
  { valor: 4, texto: "Jue" },
  { valor: 5, texto: "Vie" },
  { valor: 6, texto: "Sáb" },
  { valor: 7, texto: "Dom" },
];

export function FormularioHorario({
  horario,
}: {
  horario: {
    jornada_inicio: string;
    jornada_fin: string;
    default_duration_minutes: number;
    pausa_inicio: string | null;
    pausa_fin: string | null;
    dias_laborables: number[];
  };
}) {
  const [estado, accion, guardando] = useActionState(
    actualizarHorario,
    INICIAL,
  );

  // La base devuelve «08:00:00»; el campo `time` quiere «08:00».
  const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");

  return (
    <form action={accion} className="flex flex-col gap-5">
      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Listo" : "No se pudo guardar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="inicio"
          name="inicio"
          type="time"
          label="Entrada"
          defaultValue={hhmm(horario.jornada_inicio)}
          error={estado.errores?.inicio}
        />
        <Field
          id="fin"
          name="fin"
          type="time"
          label="Salida"
          defaultValue={hhmm(horario.jornada_fin)}
          error={estado.errores?.fin}
        />
        <Select
          id="duracion"
          name="duracion"
          label="Duración de cada cita"
          opciones={DURACIONES}
          defaultValue={String(horario.default_duration_minutes)}
          error={estado.errores?.duracion}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-text-body text-sm font-medium">
          Días que atiendes
        </legend>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => (
            <label
              key={d.valor}
              className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent-on-soft inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-150"
            >
              <input
                type="checkbox"
                name="dias"
                value={d.valor}
                defaultChecked={horario.dias_laborables.includes(d.valor)}
                className="accent-accent size-4"
              />
              {d.texto}
            </label>
          ))}
        </div>
        {estado.errores?.dias && (
          <p role="alert" className="text-danger text-sm">
            {estado.errores.dias}
          </p>
        )}
      </fieldset>

      {/*
        La pausa es opcional y va junta.
        
        Se pide como par porque media pausa —principio sin fin— dejaría franjas
        que la agenda cree libres y en realidad no lo están. Dejar los dos
        campos vacíos es la forma de decir «no paro».
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="pausaInicio"
          name="pausaInicio"
          type="time"
          label="Empieza la pausa"
          optional
          defaultValue={hhmm(horario.pausa_inicio)}
          help="Déjalo vacío si no paras a media jornada."
          error={estado.errores?.pausaInicio}
        />
        <Field
          id="pausaFin"
          name="pausaFin"
          type="time"
          label="Termina la pausa"
          optional
          defaultValue={hhmm(horario.pausa_fin)}
          error={estado.errores?.pausaFin}
        />
      </div>

      <div>
        <Button type="submit" loading={guardando ? "Guardando…" : undefined}>
          Guardar el horario
        </Button>
      </div>
    </form>
  );
}
