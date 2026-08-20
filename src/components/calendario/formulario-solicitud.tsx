"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { solicitarCita } from "@/lib/citas/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

export const MODALIDADES = [
  { valor: "presencial", etiqueta: "Presencial" },
  { valor: "virtual", etiqueta: "En línea" },
];

/**
 * Solicitud de cita (SPEC.md §6.2).
 *
 * El paciente PROPONE, no reserva. Por eso el botón dice «Solicitar» y no
 * «Reservar», y por eso el aviso está ANTES del botón y no en la pantalla de
 * después: si alguien cree que ya tiene la hora asegurada y no vuelve a mirar,
 * se presenta a una cita que no existe.
 */
export function FormularioSolicitud({
  fechaMinima,
  horas,
  margenHoras,
  duracionMinutos,
}: {
  fechaMinima: string;
  horas: string[];
  margenHoras: number;
  duracionMinutos: number;
}) {
  const [estado, accion, enviando] = useActionState(solicitarCita, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-6" noValidate>
      {estado.mensaje && !estado.ok && (
        <Alert tone="danger" title="No se pudo enviar la solicitud">
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="fecha"
          name="fecha"
          type="date"
          label="Día"
          min={fechaMinima}
          defaultValue={fechaMinima}
          error={estado.errores?.fecha}
          /*
           * Con el margen en cero no se dice «con al menos 0 horas», que suena
           * a error. Se dice lo que sí ayuda: que hoy también vale.
           */
          help={
            margenHoras > 0
              ? `Con al menos ${margenHoras} horas de anticipación.`
              : "Puedes pedirla incluso para hoy, a una hora que no haya pasado."
          }
        />

        <Select
          id="hora"
          name="hora"
          label="Hora de inicio"
          opciones={horas.map((h) => ({ valor: h, etiqueta: h }))}
          defaultValue="10:00"
          error={estado.errores?.hora}
          help={`La sesión dura ${duracionMinutos} minutos.`}
        />
      </div>

      <Select
        id="modalidad"
        name="modalidad"
        label="Modalidad"
        opciones={MODALIDADES}
        defaultValue="presencial"
        error={estado.errores?.modalidad}
      />

      <Field
        id="nota"
        name="nota"
        label="Mensaje para tu profesional"
        optional
        help="Por ejemplo, si tienes preferencia por otro horario. No hace falta que expliques el motivo de la consulta."
        error={estado.errores?.nota}
      />

      <Alert tone="warning" title="Solicitar no es reservar">
        Este horario queda propuesto, no confirmado. Tu profesional lo revisará
        y recibirás un correo cuando responda. Verás la cita marcada como «por
        confirmar» mientras tanto.
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={enviando ? "Enviando…" : undefined}>
          Solicitar cita
        </Button>
      </div>
    </form>
  );
}
