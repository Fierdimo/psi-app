"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { reenviarPase } from "@/lib/usos/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Volver a mandar el mismo correo.
 *
 * NO gasta otro uso y NO emite otro enlace, y las dos cosas se dicen en la
 * pantalla: sin eso, quien duda de si llegó prefiere encargar la evaluación de
 * nuevo —que sí cuesta— antes que arriesgarse a que el enlace anterior deje de
 * valer.
 */
export function ReenviarPase({ evaluacion }: { evaluacion: string }) {
  const [estado, accion, enviando] = useActionState(reenviarPase, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="evaluacion" value={evaluacion} />

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Reenviado" : "No se pudo reenviar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="secondary"
          loading={enviando ? "Enviando…" : undefined}
        >
          Reenviar el correo
        </Button>
        <span className="text-text-muted text-sm">
          Va al mismo enlace y a la misma dirección. No gasta otro uso.
        </span>
      </div>
    </form>
  );
}
