"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  cerrarCita,
  confirmarCita,
  rechazarCita,
} from "@/lib/citas/acciones-profesional";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Confirmar o rechazar una solicitud.
 *
 * Confirmar es un clic: es la respuesta habitual y la que no tiene vuelta
 * atrás desagradable. Rechazar abre un campo de motivo, porque el paciente va
 * a recibir un correo y «no» a secas, sin explicación, es innecesariamente
 * frío en este contexto.
 */
export function AccionesSolicitud({ citaId }: { citaId: string }) {
  const [estadoConfirmar, confirmar, confirmando] = useActionState(
    confirmarCita,
    INICIAL,
  );
  const [estadoRechazar, rechazar, rechazando] = useActionState(
    rechazarCita,
    INICIAL,
  );
  const [rechazando_abierto, setRechazandoAbierto] = useState(false);

  const error =
    (!estadoConfirmar.ok && estadoConfirmar.mensaje) ||
    (!estadoRechazar.ok && estadoRechazar.mensaje);

  if (rechazando_abierto) {
    return (
      <form action={rechazar} className="flex flex-col gap-3">
        <input type="hidden" name="cita" value={citaId} />
        {error && <Alert tone="danger" title={error} />}

        <Field
          id={`motivo-${citaId}`}
          name="motivo"
          label="Motivo"
          optional
          help="Se incluirá en el correo al paciente."
          error={estadoRechazar.errores?.motivo}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            loading={rechazando ? "Rechazando…" : undefined}
          >
            Rechazar solicitud
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRechazandoAbierto(false)}
          >
            Volver
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger" title={error} />}

      <div className="flex flex-wrap gap-2">
        <form action={confirmar}>
          <input type="hidden" name="cita" value={citaId} />
          <Button
            type="submit"
            size="sm"
            loading={confirmando ? "Confirmando…" : undefined}
          >
            Confirmar
          </Button>
        </form>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setRechazandoAbierto(true)}
        >
          Rechazar
        </Button>
      </div>
    </div>
  );
}

/**
 * Cierre de una cita ya pasada.
 *
 * Sin esto las citas confirmadas se quedan para siempre en un limbo: ni
 * realizadas ni canceladas. El historial del paciente y cualquier recuento
 * futuro dependen de que alguien cierre el círculo.
 */
export function AccionesCierre({ citaId }: { citaId: string }) {
  // Un solo formulario para los dos resultados: los distingue el `value` del
  // botón que se pulse, que viaja en el FormData como `asistio`.
  const [estado, cerrar, cerrando] = useActionState(cerrarCita, INICIAL);

  return (
    <form action={cerrar} className="flex flex-col gap-2">
      <input type="hidden" name="cita" value={citaId} />
      {!estado.ok && estado.mensaje && (
        <Alert tone="danger" title={estado.mensaje} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="asistio"
          value="si"
          size="sm"
          variant="secondary"
          loading={cerrando ? "Guardando…" : undefined}
        >
          Asistió
        </Button>
        <Button
          type="submit"
          name="asistio"
          value="no"
          size="sm"
          variant="ghost"
        >
          No asistió
        </Button>
      </div>
    </form>
  );
}
