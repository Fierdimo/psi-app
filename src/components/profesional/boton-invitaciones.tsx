"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { emitirInvitaciones } from "@/lib/citas/acciones-invitaciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Mandar los enlaces por correo.
 *
 * Va aparte de confirmar a propósito (SPEC §9.2): confirmar acepta la sesión,
 * esto avisa a la gente. Entre las dos cosas suele estar el pago, y aceptar una
 * fecha no debe hacer que a nadie le llegue un correo.
 *
 * Volver a pulsar REENVÍA: manda el mismo enlace que está a la vista en cada
 * fila, que es justo lo que hace falta cuando alguien dice «no me llegó».
 *
 * Ya no se llama «invitar» ni se cuenta a quién le falta cuenta: nadie crea
 * cuenta para esto. El enlace lleva directo a la prueba.
 */
export function BotonInvitaciones({ citaId }: { citaId: string }) {
  const [estado, accion, enviando] = useActionState(
    emitirInvitaciones,
    INICIAL,
  );

  return (
    <div className="flex flex-col gap-3">
      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Correos" : "No se pudieron enviar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <form action={accion} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="cita" value={citaId} />
        <Button
          type="submit"
          variant="secondary"
          loading={enviando ? "Enviando…" : undefined}
        >
          <Send aria-hidden="true" className="size-4" />
          Enviar los enlaces por correo
        </Button>
      </form>
    </div>
  );
}
