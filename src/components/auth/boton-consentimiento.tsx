"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aceptarConsentimiento, cerrarSesion } from "@/lib/auth/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Aceptación explícita. Un clic deliberado sobre un botón que dice qué se está
 * aceptando — no una casilla premarcada ni un «al continuar aceptas».
 */
export function BotonAceptarConsentimiento() {
  const [estado, aceptar, enviando] = useActionState(
    aceptarConsentimiento,
    INICIAL,
  );

  return (
    <div className="flex flex-col gap-4">
      {estado.mensaje && !estado.ok && (
        <Alert tone="danger" title={estado.mensaje} />
      )}

      <form action={aceptar}>
        <Button
          type="submit"
          size="lg"
          block
          loading={enviando ? "Registrando…" : undefined}
        >
          He leído y acepto
        </Button>
      </form>

      <form action={cerrarSesion}>
        <Button type="submit" variant="ghost" block>
          No acepto, cerrar sesión
        </Button>
      </form>

      <p className="text-text-muted text-micro text-center">
        Guardamos la fecha y la versión de este documento para poder acreditar
        qué texto aceptaste.
      </p>
    </div>
  );
}
