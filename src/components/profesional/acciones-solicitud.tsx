"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
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
 * Las dos pasan por un diálogo. Confirmar ERA un clic —«es la respuesta
 * habitual», decía aquí— y eso es cierto y es justo el problema: en una bandeja
 * con seis solicitudes, los botones caen todos en la misma vertical y el que
 * está bajo el cursor cambia al desplazarse. Confirmar manda un correo y abre
 * los accesos; rechazar dice que no a algo que costó preparar. Ninguna de las
 * dos se deshace.
 *
 * El motivo del rechazo vive dentro de su diálogo, así que sigue habiendo dos
 * pasos y no tres: el campo que antes sustituía a los botones ahora se pide
 * junto a la pregunta.
 */
export function AccionesSolicitud({
  citaId,
  organizar,
}: {
  citaId: string;
  /**
   * Enlace al tablero del día, cuando la sesión tiene convocados.
   *
   * Va AQUÍ, con el mismo peso que confirmar y rechazar, y no como un enlace
   * suelto encima: es una de las tres respuestas posibles a una solicitud, no
   * una nota al pie. Puesto aparte se leía como información y no como algo que
   * se puede hacer.
   */
  organizar?: string;
}) {
  const [estadoConfirmar, confirmar, confirmando] = useActionState(
    confirmarCita,
    INICIAL,
  );
  const [estadoRechazar, rechazar, rechazando] = useActionState(
    rechazarCita,
    INICIAL,
  );
  /** Cuál de los dos diálogos está abierto, si alguno. */
  const [decidiendo, setDecidiendo] = useState<"confirmar" | "rechazar" | null>(
    null,
  );

  const error =
    (!estadoConfirmar.ok && estadoConfirmar.mensaje) ||
    (!estadoRechazar.ok && estadoRechazar.mensaje);

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger" title={error} />}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setDecidiendo("confirmar")}
          loading={confirmando ? "Confirmando…" : undefined}
        >
          Confirmar
        </Button>

        {organizar && (
          <Link
            href={organizar}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <CalendarClock aria-hidden="true" className="size-4" />
            Organizar el día
          </Link>
        )}

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setDecidiendo("rechazar")}
        >
          Rechazar
        </Button>
      </div>

      <Dialogo
        abierto={decidiendo === "confirmar"}
        titulo="¿Confirmar la cita?"
        aceptar="Sí, confirmar"
        aceptando={confirmando ? "Confirmando…" : undefined}
        formulario={`confirmar-solicitud-${citaId}`}
        onCerrar={() => setDecidiendo(null)}
      >
        <p>
          Quien la pidió recibirá un aviso por correo y la verá confirmada en su
          calendario.
        </p>

        {/*
          El aviso solo donde hay tablero.
          
          Desde aquí se confirma sin haber repartido las horas, y para una
          sesión de empresa eso es legítimo pero conviene saberlo: la gente
          queda convocada y sin hora hasta que se organice el día.
        */}
        {organizar && (
          <p className="text-text-muted">
            Si no has organizado el día, los convocados quedarán sin hora. Se
            les puede citar después desde la sesión.
          </p>
        )}

        <form id={`confirmar-solicitud-${citaId}`} action={confirmar}>
          <input type="hidden" name="cita" value={citaId} />
        </form>
      </Dialogo>

      <Dialogo
        abierto={decidiendo === "rechazar"}
        titulo="¿Rechazar la solicitud?"
        aceptar="Sí, rechazar"
        aceptando={rechazando ? "Rechazando…" : undefined}
        variante="destructive"
        formulario={`rechazar-solicitud-${citaId}`}
        onCerrar={() => setDecidiendo(null)}
      >
        <p>Quien la pidió recibirá un correo diciendo que no.</p>

        <form
          id={`rechazar-solicitud-${citaId}`}
          action={rechazar}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="cita" value={citaId} />
          {/* «No» a secas, sin explicación, es innecesariamente frío en este
              contexto. */}
          <Field
            id={`motivo-${citaId}`}
            name="motivo"
            label="Motivo"
            optional
            help="Se incluirá en el correo."
            error={estadoRechazar.errores?.motivo}
          />
        </form>
      </Dialogo>
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
