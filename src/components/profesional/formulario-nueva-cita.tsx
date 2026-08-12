"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { agendarCita } from "@/lib/citas/acciones-profesional";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Alta de cita por el profesional.
 *
 * A diferencia de la solicitud del paciente, esta crea la cita YA CONFIRMADA:
 * quien agenda es quien autoriza, así que no hay nada que esperar. Tampoco
 * aplica el margen de anticipación — es su propia agenda y puede meter algo
 * para dentro de una hora si le encaja.
 */
export function FormularioNuevaCita({
  pacientes,
  horas,
  duracionMinutos,
  fechaHoy,
}: {
  pacientes: { valor: string; etiqueta: string }[];
  horas: string[];
  duracionMinutos: number;
  fechaHoy: string;
}) {
  const [estado, accion, enviando] = useActionState(agendarCita, INICIAL);

  if (pacientes.length === 0) {
    return (
      <Alert tone="info" title="Todavía no hay pacientes registrados">
        Cuando alguien cree su cuenta en la plataforma podrás agendarle citas
        desde aquí.
      </Alert>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-6" noValidate>
      {estado.mensaje && !estado.ok && (
        <Alert tone="danger" title="No se pudo agendar">
          {estado.mensaje}
        </Alert>
      )}

      <Select
        id="paciente"
        name="paciente"
        label="Paciente"
        opciones={pacientes}
        error={estado.errores?.paciente}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="fecha"
          name="fecha"
          type="date"
          label="Día"
          defaultValue={fechaHoy}
          error={estado.errores?.fecha}
        />
        <Select
          id="hora"
          name="hora"
          label="Hora de inicio"
          opciones={horas.map((h) => ({ valor: h, etiqueta: h }))}
          defaultValue="10:00"
          help={`Duración: ${duracionMinutos} minutos.`}
          error={estado.errores?.hora}
        />
      </div>

      <Select
        id="modalidad"
        name="modalidad"
        label="Modalidad"
        opciones={[
          { valor: "presencial", etiqueta: "Presencial" },
          { valor: "virtual", etiqueta: "En línea" },
        ]}
        defaultValue="presencial"
        error={estado.errores?.modalidad}
      />

      <Field
        id="lugar"
        name="lugar"
        label="Lugar"
        optional
        help="Consultorio o dirección. El paciente lo verá en su cita."
        error={estado.errores?.lugar}
      />

      <div>
        <Button type="submit" loading={enviando ? "Agendando…" : undefined}>
          Agendar cita
        </Button>
      </div>
    </form>
  );
}
