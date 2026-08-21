"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calificarVarias } from "@/lib/evaluaciones/acciones-profesional";
import { BotonPase } from "@/components/citas/boton-pase";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * La cola de evaluaciones, como tabla.
 *
 * Era una lista de tarjetas, y con veinte pendientes dejaba de servir: cada
 * fila ocupaba cuatro líneas, comparar dos personas obligaba a desplazarse, y
 * calificar veinte eran veinte entradas al detalle y veinte vueltas.
 *
 * Una tabla resuelve las dos cosas a la vez. Comprime —una fila por persona,
 * las columnas alineadas, se recorre con la vista y no con el scroll— y
 * permite seleccionar varias para hacerles lo mismo de una vez.
 *
 * LO QUE SE PUEDE HACER EN LOTE ES CALIFICAR, Y SOLO ESO. Calificar es
 * mecánico: el motor lee las respuestas y propone, y nada de eso sale de aquí.
 * Publicar es la firma —dice que leíste ese informe y respondes por él— y
 * llega a la empresa que encargó la evaluación. Un botón que firma veinte de
 * golpe convierte esa afirmación en un clic, así que no existe.
 */

export type FilaEvaluacion = {
  id: string;
  status: string;
  nombre: string;
  documento: string | null;
  instrumento: string;
  empresa: string | null;
  fecha: string;
  /**
   * La ficha de la persona en su empresa, si la evaluación viene de una.
   *
   * Es lo que permite pedir su acceso. Un paciente particular no la tiene —ni
   * la necesita: entró con su cuenta, que es como llegó hasta aquí.
   */
  personaId: string | null;
};

const ETIQUETA: Record<
  string,
  { texto: string; tono: "success" | "warning" | "neutral" }
> = {
  enviada: { texto: "Por calificar", tono: "warning" },
  calificada: { texto: "Por publicar", tono: "warning" },
  en_curso: { texto: "Respondiendo", tono: "neutral" },
  asignada: { texto: "Asignada", tono: "neutral" },
  publicada: { texto: "Publicada", tono: "success" },
  vencida: { texto: "Vencida", tono: "neutral" },
  anulada: { texto: "Anulada", tono: "neutral" },
};

/** Solo estas se pueden calificar; el resto no ofrece casilla. */
const CALIFICABLE = new Set(["enviada", "calificada"]);

const INICIAL: EstadoFormulario = { ok: false };

export function TablaEvaluaciones({
  filas,
  zona,
}: {
  filas: FilaEvaluacion[];
  /** La de la consulta, para las horas de los pases. */
  zona: string;
}) {
  const [estado, accion, enviando] = useActionState(calificarVarias, INICIAL);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());

  const calificables = filas.filter((f) => CALIFICABLE.has(f.status));
  const todas =
    calificables.length > 0 && calificables.every((f) => elegidas.has(f.id));

  function alternar(id: string) {
    setElegidas((previo) => {
      const copia = new Set(previo);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  return (
    <form action={accion} className="flex flex-col gap-3">
      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Calificadas" : "No se pudo calificar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      {/*
        La barra de acciones ocupa sitio SOLO cuando hay algo elegido.
        Reservarle un hueco fijo pondría un botón apagado encima de la tabla
        todo el rato, que es ruido en la pantalla que más se mira.
      */}
      {elegidas.size > 0 && (
        <div className="border-accent-soft-border bg-accent-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <span className="text-accent-on-soft text-sm font-medium">
            {elegidas.size}{" "}
            {elegidas.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setElegidas(new Set())}
              className="text-text-muted hover:text-text-body ease-psi text-sm underline underline-offset-4 transition-colors duration-150"
            >
              Quitar la selección
            </button>

            <Button
              type="submit"
              variant="secondary"
              loading={enviando ? "Calificando…" : undefined}
            >
              <Sparkles aria-hidden="true" className="size-4" />
              Calificar {elegidas.size === 1 ? "la elegida" : "las elegidas"}
            </Button>
          </div>
        </div>
      )}

      {/*
        La tabla se desplaza dentro de su caja, nunca la página.
        En un teléfono, seis columnas no caben; que arrastre la página entera
        de lado deja el menú fuera de alcance.
      */}
      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-line text-text-muted border-b text-left">
              <th scope="col" className="w-10 p-3">
                <span className="sr-only">Seleccionar</span>
                <input
                  type="checkbox"
                  checked={todas}
                  disabled={calificables.length === 0}
                  onChange={(e) =>
                    setElegidas(
                      e.target.checked
                        ? new Set(calificables.map((f) => f.id))
                        : new Set(),
                    )
                  }
                  aria-label="Seleccionar todas las que se pueden calificar"
                  className="accent-accent size-4 align-middle"
                />
              </th>
              <th scope="col" className="p-3 font-medium">
                Persona
              </th>
              <th scope="col" className="p-3 font-medium">
                Instrumento
              </th>
              <th scope="col" className="p-3 font-medium">
                Empresa
              </th>
              <th scope="col" className="p-3 font-medium">
                Estado
              </th>
              <th scope="col" className="p-3 text-right font-medium">
                <span className="sr-only">Acceso</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {filas.map((f) => {
              const etiqueta = ETIQUETA[f.status] ?? {
                texto: f.status,
                tono: "neutral" as const,
              };
              const elegible = CALIFICABLE.has(f.status);

              return (
                <tr
                  key={f.id}
                  className="border-line hover:bg-accent-soft/40 ease-psi border-b transition-colors duration-150 last:border-0"
                >
                  <td className="p-3 align-middle">
                    {elegible ? (
                      <input
                        type="checkbox"
                        name="asignacion"
                        value={f.id}
                        checked={elegidas.has(f.id)}
                        onChange={() => alternar(f.id)}
                        aria-label={`Seleccionar la evaluación de ${f.nombre}`}
                        className="accent-accent size-4 align-middle"
                      />
                    ) : (
                      /* Sin casilla y sin hueco vacío: una casilla apagada
                         invita a pulsarla y no explica por qué no responde. */
                      <span className="sr-only">
                        No se puede calificar todavía
                      </span>
                    )}
                  </td>

                  <td className="p-3 align-middle">
                    <Link
                      href={`/profesional/evaluaciones/${f.id}`}
                      className="text-text-strong hover:text-accent ease-psi font-medium transition-colors duration-150"
                    >
                      {f.nombre}
                    </Link>
                    {f.documento && (
                      <span className="text-text-muted block text-xs">
                        {f.documento}
                      </span>
                    )}
                  </td>

                  <td className="text-text-body p-3 align-middle">
                    {f.instrumento}
                  </td>

                  <td className="text-text-body p-3 align-middle">
                    {f.empresa ?? "—"}
                  </td>

                  <td className="p-3 align-middle">
                    <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
                  </td>

                  {/*
                    El acceso, en la fila de quien lo necesita.

                    Estaba en una sección aparte al final, agrupado por sesión:
                    para dárselo a quien tienes delante había que reconocer a
                    qué sesión pertenecía y desplegarla. Aquí es la misma fila
                    que ya estás mirando.
                  */}
                  <td className="p-3 text-right align-middle">
                    {f.personaId && (
                      <BotonPase
                        persona={f.personaId}
                        nombre={f.nombre}
                        zona={zona}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
