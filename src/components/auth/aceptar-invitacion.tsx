"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aceptarInvitacion } from "@/lib/citas/acciones-invitaciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

export function AceptarInvitacion({ token }: { token: string }) {
  const [estado, accion, enviando] = useActionState(aceptarInvitacion, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {estado.mensaje && !estado.ok && (
        <Alert tone="danger" title="No se pudo aceptar">
          {estado.mensaje}
        </Alert>
      )}

      <Button type="submit" loading={enviando ? "Activando…" : undefined}>
        Activar mi acceso
      </Button>
    </form>
  );
}
