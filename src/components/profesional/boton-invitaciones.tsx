"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { emitirInvitaciones } from "@/lib/citas/acciones-invitaciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Emisión de invitaciones de una sesión de evaluación.
 *
 * Va aparte de confirmar a propósito (SPEC §9.2): confirmar acepta la sesión,
 * esto abre la puerta a los convocados. Entre las dos cosas suele estar el
 * pago, y aceptar una fecha no debe hacer que a nadie le llegue un correo.
 *
 * Reemitir es seguro: la base no crea una segunda invitación a quien ya tiene
 * una viva, así que nadie recibe dos correos por lo mismo.
 */
export function BotonInvitaciones({
  citaId,
  pendientes,
}: {
  citaId: string;
  /** Convocados que todavía no tienen cuenta. */
  pendientes: number;
}) {
  const [estado, accion, enviando] = useActionState(
    emitirInvitaciones,
    INICIAL,
  );

  return (
    <div className="flex flex-col gap-3">
      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Invitaciones" : "No se pudieron emitir"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <form action={accion} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="cita" value={citaId} />
        <Button
          type="submit"
          variant="secondary"
          loading={enviando ? "Emitiendo…" : undefined}
          disabled={pendientes === 0}
        >
          <Send aria-hidden="true" className="size-4" />
          Invitar a los convocados
        </Button>

        <span className="text-text-muted text-sm">
          {pendientes === 0
            ? "Todos los convocados ya tienen cuenta."
            : `${pendientes} ${pendientes === 1 ? "persona necesita" : "personas necesitan"} crear su cuenta.`}
        </span>
      </form>
    </div>
  );
}
