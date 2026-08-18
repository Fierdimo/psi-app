"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  consentirEvaluacion,
  iniciarPrueba,
} from "@/lib/evaluaciones/acciones";

const INICIAL = { ok: false, mensaje: "" };

/**
 * El consentimiento de ESTA evaluación.
 *
 * No es el de atención —ese cubre un tratamiento y aquí no hay ninguno— y no
 * se firma una vez para siempre: se consiente cada evaluación, con su
 * propósito y su destinatario (`SPEC.md` §9.2).
 *
 * Rechazar es un botón de verdad, del mismo tamaño que aceptar. Un
 * consentimiento donde negarse cuesta más que aceptar no es consentimiento; y
 * como la decisión es reversible, quien se negó puede volver aquí y aceptar.
 */
export function Consentimiento({
  asignacion,
  decision,
}: {
  asignacion: string;
  decision: string | null;
}) {
  const [estado, accion, enviando] = useActionState(
    consentirEvaluacion,
    INICIAL,
  );
  const [estadoInicio, accionInicio, iniciando] = useActionState(
    iniciarPrueba,
    INICIAL,
  );

  const aceptado = decision === "aceptado";

  return (
    <div className="flex flex-col gap-6">
      <div className="border-line bg-panel rounded-xl border p-6">
        <h2 className="text-text-strong text-lg font-semibold">
          Antes de empezar, tu consentimiento
        </h2>

        <div className="text-muted mt-4 flex flex-col gap-3 text-sm">
          <p>
            Vas a responder una evaluación psicológica y psicotécnica. Su
            propósito es conocer habilidades, competencias y aptitudes
            relacionadas con el puesto del proceso en el que participas.
          </p>
          <p>
            Los resultados los revisa y firma un profesional antes de que
            existan para nadie: no son automáticos. Se comparten contigo y con
            la empresa que encargó la evaluación, y con nadie más.
          </p>
          <p>
            <strong className="text-text-strong">
              Tu participación es voluntaria.
            </strong>{" "}
            Puedes negarte ahora, o aceptar ahora y retirar tu consentimiento
            más adelante. Si lo retiras, tu informe no se publica. Y si vuelves
            a cambiar de idea, puedes aceptar otra vez: esta decisión no se
            agota.
          </p>
          <p>
            También puedes cerrar esta página sin responder y volver cuando
            quieras. No pasa nada y nadie recibe aviso.
          </p>
        </div>

        {estado.mensaje ? (
          <div className="mt-4">
            <Alert
              tone={estado.ok ? "success" : "danger"}
              title={estado.ok ? "Listo" : "No se pudo registrar"}
            >
              {estado.mensaje}
            </Alert>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={accion}>
            <input type="hidden" name="asignacion" value={asignacion} />
            <input type="hidden" name="decision" value="aceptado" />
            <Button type="submit" disabled={enviando || aceptado}>
              {aceptado ? "Ya aceptaste" : "Acepto participar"}
            </Button>
          </form>

          <form action={accion}>
            <input type="hidden" name="asignacion" value={asignacion} />
            <input type="hidden" name="decision" value="rechazado" />
            <Button type="submit" variant="secondary" disabled={enviando}>
              {aceptado ? "Retirar mi consentimiento" : "No acepto"}
            </Button>
          </form>
        </div>
      </div>

      {decision === "rechazado" ? (
        <Alert tone="info" title="No vas a ser evaluado">
          Queda registrado que te negaste, y no pasa nada más. Si cambias de
          idea, puedes aceptar desde esta misma página.
        </Alert>
      ) : null}

      {/*
        Aceptar y empezar, sin esperar a nadie.
        Antes había que aguardar a que el profesional abriera el examen persona
        por persona. Ese paso no decidía nada —la decisión ya la había tomado
        quien firma— y en una sesión de quince convocados eran quince esperas.
      */}
      {aceptado ? (
        <form action={accionInicio} className="flex flex-col gap-3">
          <input type="hidden" name="asignacion" value={asignacion} />
          {estadoInicio.mensaje ? (
            <Alert tone="danger" title="No se pudo abrir la prueba">
              {estadoInicio.mensaje}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" disabled={iniciando}>
              {iniciando ? "Abriendo…" : "Empezar la prueba"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
