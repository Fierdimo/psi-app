"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  consentirEvaluacion,
  iniciarPrueba,
} from "@/lib/evaluaciones/acciones";
import {
  consentirConPase,
  iniciarConPase,
} from "@/lib/evaluaciones/acciones-pase";
import { seccionesDelConsentimiento } from "@/lib/consentimiento";

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
  pase,
  version = "1",
  empresa,
}: {
  asignacion: string;
  decision: string | null;
  /**
   * El testigo, cuando quien consiente no tiene cuenta.
   *
   * Con él, la decisión se registra contra su ficha en vez de contra un
   * usuario. El texto y los botones son los mismos: lo que cambia es quién
   * firma, no qué se firma.
   */
  pase?: string;
  version?: string;
  /**
   * Quién encarga la evaluación.
   *
   * Va al primer apartado del documento: «te evalúan por encargo de alguien»
   * sin nombrarlo informa a medias, y es lo primero que cualquiera quiere
   * saber antes de decidir.
   */
  empresa?: string | null;
}) {
  const [estado, accion, enviando] = useActionState(
    consentirEvaluacion,
    INICIAL,
  );
  const [estadoInicio, accionInicio, iniciando] = useActionState(
    iniciarPrueba,
    INICIAL,
  );

  const [falloPase, setFalloPase] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /** Con pase no hay `useActionState`: la acción recibe el testigo, no un formulario. */
  async function conPase(
    hacer: () => Promise<{ ok: boolean; mensaje?: string }>,
  ) {
    setOcupado(true);
    setFalloPase(null);
    const r = await hacer();
    if (!r.ok) setFalloPase(r.mensaje ?? "No se pudo registrar tu decisión.");
    setOcupado(false);
  }

  const aceptado = decision === "aceptado";
  const trabajando = enviando || ocupado;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-line bg-panel rounded-xl border p-6">
        <h2 className="text-text-strong text-lg font-semibold">
          Antes de empezar, tu consentimiento
        </h2>

        {/*
          EL TEXTO SALE DEL MÓDULO VERSIONADO, no de aquí.

          Estuvo escrito a mano en este componente mientras la versión que se
          guardaba como evidencia salía de `consentimiento.ts`, cuyo texto era
          otro: se registraba haber aceptado una redacción que quien firmaba no
          había visto nunca. El punto entero de versionar un consentimiento es
          poder demostrar qué se aceptó, así que había un solo sitio posible
          para el texto.
        */}
        <div className="text-text-body mt-4 flex flex-col gap-5 text-sm">
          {seccionesDelConsentimiento(empresa).map((seccion) => (
            <section key={seccion.titulo} className="flex flex-col gap-1.5">
              <h3 className="text-text-strong font-semibold">
                {seccion.titulo}
              </h3>
              {(Array.isArray(seccion.cuerpo)
                ? seccion.cuerpo
                : [seccion.cuerpo]
              ).map((parrafo, n) => (
                <p key={n}>{parrafo}</p>
              ))}
            </section>
          ))}

          <p className="text-text-muted text-micro tabular">
            Versión {version}
          </p>
        </div>

        {falloPase ? (
          <div className="mt-4">
            <Alert tone="danger" title="No se pudo registrar">
              {falloPase}
            </Alert>
          </div>
        ) : null}

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
          <form
            action={
              pase
                ? () =>
                    conPase(() => consentirConPase(pase, "aceptado", version))
                : accion
            }
          >
            <input type="hidden" name="asignacion" value={asignacion} />
            <input type="hidden" name="decision" value="aceptado" />
            <Button type="submit" disabled={trabajando || aceptado}>
              {aceptado ? "Ya aceptaste" : "Acepto participar"}
            </Button>
          </form>

          <form
            action={
              pase
                ? () =>
                    conPase(() => consentirConPase(pase, "rechazado", version))
                : accion
            }
          >
            <input type="hidden" name="asignacion" value={asignacion} />
            <input type="hidden" name="decision" value="rechazado" />
            <Button type="submit" variant="secondary" disabled={trabajando}>
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
        <form
          action={
            pase ? () => conPase(() => iniciarConPase(pase)) : accionInicio
          }
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="asignacion" value={asignacion} />
          {estadoInicio.mensaje ? (
            <Alert tone="danger" title="No se pudo abrir la prueba">
              {estadoInicio.mensaje}
            </Alert>
          ) : null}
          <div>
            <Button type="submit" disabled={iniciando || ocupado}>
              {iniciando || ocupado ? "Abriendo…" : "Empezar la prueba"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
