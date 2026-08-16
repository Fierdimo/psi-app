"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  calificarEvaluacion,
  publicarResultado,
  redactarResultado,
} from "@/lib/evaluaciones/acciones-profesional";

const INICIAL = { ok: false, mensaje: "" };

interface Parametro {
  clave: string;
  etiqueta: string;
  kind: string;
  seccion: string | null;
  computed: boolean;
  admite_nota: boolean;
}

interface Valor {
  parameter_key: string;
  valor: unknown;
  sugerido: string | null;
  nota: string | null;
}

/**
 * Revisar y firmar.
 *
 * El orden de la pantalla es el orden del trabajo: qué puntuó el motor, qué
 * redacción propone, qué escribe el profesional encima, y solo al final
 * publicar. La nota del profesional MANDA sobre la sugerida, y por eso se ve
 * cuál es cuál: un informe donde no se distingue lo calculado de lo escrito es
 * un informe que nadie puede defender.
 */
export function RevisionInforme({
  asignacion,
  status,
  parametros,
  valores,
  notaGlobal,
  publicado,
  consentimiento,
}: {
  asignacion: string;
  status: string;
  parametros: Parametro[];
  valores: Valor[];
  notaGlobal: string | null;
  publicado: string | null;
  consentimiento: string | null;
}) {
  const [estadoCal, calificar, calificando] = useActionState(
    calificarEvaluacion,
    INICIAL,
  );
  const [estadoPub, publicar, publicando] = useActionState(
    publicarResultado,
    INICIAL,
  );

  const porCalificar = status === "enviada";
  const calificada = status === "calificada";
  const yaPublicada = status === "publicada";

  const porClave = new Map(valores.map((v) => [v.parameter_key, v]));

  const secciones = [...new Set(parametros.map((p) => p.seccion ?? "otros"))];

  /*
   * Abrir el examen se hace desde AQUÍ además de desde la sesión.
   *
   * Estaba solo en el detalle de la cita, que es donde se asigna, pero no es
   * donde se mira cuando llega el momento: con la persona delante uno abre su
   * evaluación, no la agenda. Un botón que existe en un sitio al que no vas es
   * un botón que no existe.
   */
  if (status === "asignada") {
    return <Abrir consentimiento={consentimiento} />;
  }

  if (status === "en_curso") {
    return (
      <Alert tone="info" title="La persona está respondiendo">
        Cuando envíe sus respuestas podrás calificarlas desde aquí.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {porCalificar ? (
        <form action={calificar} className="flex flex-col gap-3">
          <input type="hidden" name="asignacion" value={asignacion} />
          <Alert tone="info" title="Respuestas recibidas, sin calificar">
            Al calificar se aplica la baremación del instrumento y se proponen
            las redacciones. Nadie ve nada todavía: publicar es otro paso.
          </Alert>
          <div>
            <Button type="submit" disabled={calificando}>
              {calificando ? "Calificando…" : "Calificar"}
            </Button>
          </div>
        </form>
      ) : null}

      {estadoCal.mensaje ? (
        <Alert
          tone={estadoCal.ok ? "success" : "danger"}
          title={estadoCal.ok ? "Calificada" : "No se pudo calificar"}
        >
          {estadoCal.mensaje}
        </Alert>
      ) : null}

      {yaPublicada ? (
        <Alert tone="success" title="Informe publicado">
          Está disponible para la persona y para la empresa que lo encargó
          {publicado
            ? ` desde el ${new Date(publicado).toLocaleDateString("es-CO")}`
            : ""}
          .
        </Alert>
      ) : null}

      {valores.length > 0
        ? secciones.map((seccion) => (
            <section key={seccion} className="flex flex-col gap-3">
              <h2 className="text-h4">{titulo(seccion)}</h2>
              {parametros
                .filter((p) => (p.seccion ?? "otros") === seccion)
                .map((p) => (
                  <Apartado
                    key={p.clave}
                    asignacion={asignacion}
                    parametro={p}
                    valor={porClave.get(p.clave)}
                    bloqueado={yaPublicada}
                  />
                ))}
            </section>
          ))
        : null}

      {calificada ? (
        <form
          action={publicar}
          className="border-line flex flex-col gap-3 border-t pt-5"
        >
          <input type="hidden" name="asignacion" value={asignacion} />
          <label className="flex flex-col gap-1.5">
            <span className="text-text-strong text-sm font-medium">
              Nota global del informe
            </span>
            <textarea
              name="nota_global"
              rows={3}
              defaultValue={notaGlobal ?? ""}
              className="border-line bg-surface text-text-body rounded-lg border p-3 text-sm"
              placeholder="Lo que quieras decir sobre el conjunto. Opcional."
            />
          </label>

          <Alert tone="warning" title="Publicar no se deshace">
            Al publicar, el informe queda visible para la persona evaluada y
            para la empresa que lo encargó. Revísalo antes.
          </Alert>

          <div>
            <Button type="submit" disabled={publicando}>
              {publicando ? "Publicando…" : "Publicar el informe"}
            </Button>
          </div>
        </form>
      ) : null}

      {estadoPub.mensaje ? (
        <Alert
          tone={estadoPub.ok ? "success" : "danger"}
          title={estadoPub.ok ? "Publicado" : "No se pudo publicar"}
        >
          {estadoPub.mensaje}
        </Alert>
      ) : null}
    </div>
  );
}

function Apartado({
  asignacion,
  parametro,
  valor,
  bloqueado,
}: {
  asignacion: string;
  parametro: Parametro;
  valor: Valor | undefined;
  bloqueado: boolean;
}) {
  const [estado, guardar, guardando] = useActionState(
    redactarResultado,
    INICIAL,
  );

  const puntaje =
    valor?.valor === null || valor?.valor === undefined
      ? null
      : String(valor.valor);

  return (
    <div className="border-line bg-surface rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text-strong font-medium">{parametro.etiqueta}</h3>
        {puntaje !== null && parametro.kind !== "texto" ? (
          <Badge tone="neutral">{puntaje}</Badge>
        ) : null}
      </div>

      {valor?.sugerido ? (
        <div className="mt-3">
          <p className="text-text-muted text-xs tracking-wide uppercase">
            Propuesto por el instrumento
          </p>
          <p className="text-text-body mt-1 text-sm">{valor.sugerido}</p>
        </div>
      ) : parametro.computed && !puntaje ? (
        <p className="text-text-muted mt-3 text-sm">
          El instrumento no pudo determinar este apartado. Escríbelo tú.
        </p>
      ) : null}

      {parametro.admite_nota && !bloqueado ? (
        <form action={guardar} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="asignacion" value={asignacion} />
          <input type="hidden" name="parametro" value={parametro.clave} />
          <label className="flex flex-col gap-1.5">
            <span className="text-text-muted text-sm">
              Tu redacción {valor?.nota ? "" : "(sustituye a la propuesta)"}
            </span>
            <textarea
              name="nota"
              rows={3}
              defaultValue={valor?.nota ?? ""}
              className="border-line bg-bg text-text-body rounded-lg border p-3 text-sm"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            {estado.mensaje ? (
              <span
                className={
                  estado.ok
                    ? "text-success-600 text-sm"
                    : "text-danger-600 text-sm"
                }
              >
                {estado.mensaje}
              </span>
            ) : null}
          </div>
        </form>
      ) : valor?.nota ? (
        <div className="mt-3">
          <p className="text-text-muted text-xs tracking-wide uppercase">
            Tu redacción
          </p>
          <p className="text-text-body mt-1 text-sm">{valor.nota}</p>
        </div>
      ) : null}
    </div>
  );
}

function titulo(seccion: string) {
  if (seccion === "disc") return "Perfil DISC";
  if (seccion === "dominancia") return "Dominancia cerebral";
  return "Otros apartados";
}

/**
 * En qué punto está antes de que haya nada que revisar.
 *
 * Ya no hay botón de abrir: aceptar el consentimiento abre el examen. Ese paso
 * no añadía criterio —la decisión ya la había tomado la persona— y en una
 * sesión de quince convocados eran quince clics.
 *
 * Queda `habilitar_examen` en la base para abrir a mano un caso suelto.
 */
function Abrir({ consentimiento }: { consentimiento: string | null }) {
  if (consentimiento !== "aceptado") {
    return (
      <Alert
        tone="warning"
        title={
          consentimiento === "rechazado"
            ? "Esta persona se negó a ser evaluada"
            : "Esperando su consentimiento"
        }
      >
        {consentimiento === "rechazado"
          ? "Puede cambiar de idea desde su cuenta cuando quiera. Hasta entonces el examen no se abre."
          : "Todavía no ha respondido al consentimiento. El examen no se abre sin él."}
      </Alert>
    );
  }

  return (
    <Alert tone="success" title="Puede empezar cuando quiera">
      Aceptó el consentimiento, así que su examen ya está disponible desde su
      cuenta. Cuando envíe sus respuestas podrás calificarlas aquí.
    </Alert>
  );
}
