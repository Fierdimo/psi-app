"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { actualizarPlazoParaEmpezar } from "@/lib/evaluaciones/acciones-configuracion";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Cuántos días tiene una persona para abrir su enlace.
 *
 * Es de la consulta y no de cada prueba: mide cuánto tarda una empresa en
 * sentar a su gente, que no depende de qué instrumento se aplique.
 */
export function FormularioPlazo({ dias }: { dias: number }) {
  const [estado, accion, enviando] = useActionState(
    actualizarPlazoParaEmpezar,
    INICIAL,
  );

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-h4">Plazo para empezar</h2>
        <p className="text-text-muted max-w-[60ch] text-sm">
          Cuánto tiempo tiene una persona para abrir su enlace desde que la
          empresa se lo envía. Vale para todas las pruebas.
        </p>
      </div>

      <p className="text-text-body">
        Ahora mismo <strong className="text-text-strong">{dias} días</strong>.
      </p>

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Guardado" : "No se pudo guardar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="max-w-[320px]">
        <Field
          id="dias"
          name="dias"
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          defaultValue={dias}
          label="Días para abrir el enlace"
          help="Se cuentan desde el envío del correo. Cambiarlo no toca los enlaces ya enviados: cada uno guarda la fecha que se le prometió."
          error={estado.errores?.dias}
        />
      </div>

      <div>
        <Button type="submit" loading={enviando ? "Guardando…" : undefined}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
