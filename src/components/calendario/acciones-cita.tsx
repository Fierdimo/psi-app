"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { cancelarCita, solicitarReprogramacion } from "@/lib/citas/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Acciones del paciente sobre una cita.
 *
 * Ninguna se ejecuta al primer clic: ambas abren un formulario que explica qué
 * va a pasar. Cancelar una sesión es una decisión con consecuencias —para la
 * persona y para la agenda del profesional— y merece un paso deliberado.
 */
export function AccionesCita({
  citaId,
  puedeReprogramar,
  puedeCancelar,
  fechaMinima,
  horas,
  margenHoras,
  politicaCancelacion,
}: {
  citaId: string;
  puedeReprogramar: boolean;
  puedeCancelar: boolean;
  fechaMinima: string;
  horas: string[];
  margenHoras: number;
  politicaCancelacion: string | null;
}) {
  const [abierto, setAbierto] = useState<"nada" | "cambio" | "cancelar">(
    "nada",
  );

  if (!puedeReprogramar && !puedeCancelar) return null;

  if (abierto === "nada") {
    return (
      <div className="border-line flex flex-wrap gap-3 border-t pt-5">
        {puedeReprogramar && (
          <Button variant="secondary" onClick={() => setAbierto("cambio")}>
            Pedir otro horario
          </Button>
        )}
        {puedeCancelar && (
          <Button
            variant="destructive-quiet"
            onClick={() => setAbierto("cancelar")}
          >
            Cancelar cita
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="border-line border-t pt-5">
      {abierto === "cambio" ? (
        <FormularioCambio
          citaId={citaId}
          fechaMinima={fechaMinima}
          horas={horas}
          margenHoras={margenHoras}
          onCerrar={() => setAbierto("nada")}
        />
      ) : (
        <FormularioCancelacion
          citaId={citaId}
          politica={politicaCancelacion}
          onCerrar={() => setAbierto("nada")}
        />
      )}
    </div>
  );
}

function FormularioCambio({
  citaId,
  fechaMinima,
  horas,
  margenHoras,
  onCerrar,
}: {
  citaId: string;
  fechaMinima: string;
  horas: string[];
  margenHoras: number;
  onCerrar: () => void;
}) {
  const [estado, accion, enviando] = useActionState(
    solicitarReprogramacion,
    INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="cita" value={citaId} />

      <h3 className="text-h4">Pedir otro horario</h3>

      {estado.mensaje && !estado.ok && (
        <Alert tone="danger" title="No se pudo enviar">
          {estado.mensaje}
        </Alert>
      )}

      <Alert tone="info" title="Tu cita actual sigue en pie">
        Se mantiene hasta que tu profesional acepte el cambio. Si no puede, te
        lo dirá y conservarás el horario original.
      </Alert>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="fecha-cambio"
          name="fecha"
          type="date"
          label="Nuevo día"
          min={fechaMinima}
          defaultValue={fechaMinima}
          /*
           * Con el margen en cero no se dice «con al menos 0 horas», que suena
           * a error. Se dice lo que sí ayuda: que hoy también vale.
           */
          help={
            margenHoras > 0
              ? `Con al menos ${margenHoras} horas de anticipación.`
              : "Puedes pedirla incluso para hoy, a una hora que no haya pasado."
          }
          error={estado.errores?.fecha}
        />
        <Select
          id="hora-cambio"
          name="hora"
          label="Nueva hora"
          opciones={horas.map((h) => ({ valor: h, etiqueta: h }))}
          defaultValue="10:00"
          error={estado.errores?.hora}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={enviando ? "Enviando…" : undefined}>
          Enviar solicitud de cambio
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Volver
        </Button>
      </div>
    </form>
  );
}

function FormularioCancelacion({
  citaId,
  politica,
  onCerrar,
}: {
  citaId: string;
  politica: string | null;
  onCerrar: () => void;
}) {
  const [estado, accion, enviando] = useActionState(cancelarCita, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="cita" value={citaId} />

      <h3 className="text-h4">Cancelar esta cita</h3>

      {estado.mensaje && !estado.ok && (
        <Alert tone="danger" title="No se pudo cancelar">
          {estado.mensaje}
        </Alert>
      )}

      {politica && (
        <Alert tone="warning" title="Política de cancelación">
          {politica}
        </Alert>
      )}

      <Field
        id="motivo"
        name="motivo"
        label="Motivo"
        optional
        help="Es útil para tu profesional, pero puedes dejarlo en blanco."
        error={estado.errores?.motivo}
      />

      <p className="text-text-body text-sm">
        La cancelación es definitiva. Si después necesitas otro horario, tendrás
        que solicitar una cita nueva.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="destructive"
          loading={enviando ? "Cancelando…" : undefined}
        >
          Sí, cancelar la cita
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          No, volver
        </Button>
      </div>
    </form>
  );
}
