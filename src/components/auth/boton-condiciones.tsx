"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aceptarCondicionesEmpresa } from "@/lib/auth/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Aceptar las condiciones, con la obligación repetida encima del botón.
 *
 * No es un «he leído y acepto» a secas: lo que se acepta aquí incluye
 * responder de un dato sensible de otra persona, y eso merece decirse en el
 * sitio donde se pulsa y no solo cuarenta líneas más arriba.
 */
export function BotonAceptarCondiciones() {
  const [estado, accion, enviando] = useActionState(
    aceptarCondicionesEmpresa,
    INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      {estado.mensaje && (
        <Alert tone="danger" title="No se pudo registrar">
          {estado.mensaje}
        </Alert>
      )}

      <p className="text-text-body">
        Al continuar aceptas, en particular, que{" "}
        <strong className="text-text-strong">
          desde que recibes un informe respondes de él
        </strong>
        : lo usarás solo para el proceso que motivó la evaluación y no lo
        difundirás fuera de él.
      </p>

      <div>
        <Button type="submit" loading={enviando ? "Guardando…" : undefined}>
          He leído y acepto las condiciones
        </Button>
      </div>
    </form>
  );
}
