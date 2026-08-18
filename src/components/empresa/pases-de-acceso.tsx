"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EnlacesDeAcceso } from "@/components/citas/enlaces-de-acceso";
import { generarPases } from "@/lib/citas/acciones-pases";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Los pases de una sesión confirmada, en manos de la empresa.
 *
 * La empresa ya tiene un canal con su gente —la intranet, el grupo del turno,
 * el jefe de área— y llega mejor y más rápido que un correo desde fuera. Sin
 * esto, una sesión confirmada dependía de que cincuenta direcciones estuvieran
 * bien y de que ningún filtro corporativo se interpusiera.
 *
 * NO se generan al abrir la pantalla, sino al pulsar. Un pase con testigo es
 * la llave para entrar como esa persona, así que aparece porque alguien lo
 * pidió —y la base anota quién— y no por el mero hecho de mirar la sesión.
 */
export function PasesDeAcceso({ citaId }: { citaId: string }) {
  const [estado, accion, generando] = useActionState(generarPases, INICIAL);

  return (
    <div className="flex flex-col gap-3">
      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Pases generados" : "No se pudieron generar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      {estado.enlaces && estado.enlaces.length > 0 && (
        <EnlacesDeAcceso
          enlaces={estado.enlaces}
          titulo="Pases de acceso de esta sesión"
          nota="Entrégale a cada persona el suyo, y solo el suyo: quien tenga el enlace puede entrar como ella. Se ven una sola vez; si cierras esta pantalla, vuelve a generarlos."
        />
      )}

      <form action={accion} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="cita" value={citaId} />
        <Button
          type="submit"
          variant="secondary"
          loading={generando ? "Generando…" : undefined}
        >
          <KeyRound aria-hidden="true" className="size-4" />
          {estado.enlaces ? "Generar de nuevo" : "Generar pases de acceso"}
        </Button>

        <span className="text-text-muted text-sm">
          Para repartir por tu cuenta si el correo no llega.
        </span>
      </form>
    </div>
  );
}
