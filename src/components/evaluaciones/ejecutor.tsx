"use client";

import { useMemo, useState, useTransition } from "react";

import { enviarPrueba, responder } from "@/lib/evaluaciones/acciones";
import {
  enviarConPase,
  responderConPase,
  type CierreDeLaPrueba,
} from "@/lib/evaluaciones/acciones-pase";
import { FinDeLaPrueba } from "@/components/evaluaciones/fin-de-la-prueba";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/evaluaciones/motor";
import { cn } from "@/lib/utils";

/**
 * El ejecutor: donde la persona responde.
 *
 * Un solo componente dibuja cualquier instrumento, porque los ítems son datos.
 * Añadir una prueba nueva no debería tocar este archivo salvo que traiga un
 * TIPO de ítem que no existía.
 *
 * Se avanza bloque a bloque y no con las 68 preguntas en una página larga: en
 * una elección forzada hay que comparar cuatro palabras entre sí, y con seis
 * bloques a la vista la gente compara con el de al lado.
 */

interface Props {
  asignacion: string;
  items: Item[];
  respuestas: Record<string, unknown>;
}

interface Marca {
  mas?: string;
  menos?: string;
}

/**
 * ¿Está REALMENTE contestado este ítem?
 *
 * En un bloque de elección forzada hacen falta las DOS columnas. Marcar solo
 * «más» dejaba avanzar y contaba como respondido, y ese bloque puntúa mal: la
 * escala se calcula restando los «menos» a los «más», así que media respuesta
 * desplaza el perfil sin que nada lo avise.
 */
function contestado(item: Item, valor: unknown): boolean {
  if (valor === undefined || valor === null) return false;

  if (item.tipo === "forced_choice") {
    const marca = valor as Marca;
    return Boolean(marca.mas) && Boolean(marca.menos);
  }

  return true;
}

/**
 * El mismo ejecutor sirve con cuenta y sin ella.
 *
 * Con `pase`, las respuestas van por las funciones que resuelven el testigo;
 * sin él, por las que miran la sesión. Duplicar el componente habría dejado
 * dos pantallas de examen que se separan al primer arreglo que se aplique solo
 * a una — y esta es la pantalla donde la gente pasa media hora.
 */
export function Ejecutor({
  asignacion,
  items,
  respuestas,
  pase,
  persona,
  instrumento,
  empresa,
}: Props & {
  pase?: string;
  /**
   * Quién responde, qué prueba y para quién.
   *
   * Se pintan en la cabecera de la página del pase, que es lo que le confirma
   * a quien abre un enlace recibido por correo que la prueba es la suya.
   */
  persona?: string;
  instrumento?: string;
  empresa?: string | null;
}) {
  const [valores, setValores] = useState<Record<string, unknown>>(respuestas);
  const [indice, setIndice] = useState(() => {
    // Se retoma donde se quedó. Si hubo una caída, volver a empezar sería
    // castigar a la persona por un fallo nuestro.
    const primeraSin = items.findIndex((i) => !contestado(i, respuestas[i.id]));
    return primeraSin === -1 ? items.length - 1 : primeraSin;
  });
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  /*
   * La despedida, cuando ya se envió. Nula mientras se responde.
   *
   * Vive en el cliente y no se recarga de la página porque el pase se apaga en
   * el mismo gesto: volver al servidor devolvería «este enlace ya se usó» en
   * vez de la pantalla final, y con ella se iría el botón de descarga.
   */
  const [cierre, setCierre] = useState<CierreDeLaPrueba | null>(null);

  /*
   * Enviada aparte del cierre, y hace falta que sean dos cosas.
   *
   * `cierre` en nulo significa «el motor no llegó a publicar», que es un caso
   * real —el cierre automático está escrito para no lanzar nunca— y también es
   * el estado inicial. Sin este testigo, una prueba enviada sin informe
   * volvería al cuestionario como si no se hubiera enviado.
   */
  const [enviada, setEnviada] = useState(false);

  const item = items[indice];

  const respondidos = useMemo(
    () => items.filter((i) => contestado(i, valores[i.id])).length,
    [items, valores],
  );

  const completo = respondidos === items.length;

  /*
   * No se avanza sin responder.
   *
   * Antes «Siguiente» siempre estaba activo, así que era fácil pasar de largo
   * sin darse cuenta y descubrir 68 pantallas después que faltaban respuestas
   * sueltas. En un instrumento ipsativo un bloque en blanco no es un dato
   * menos: descuadra el perfil entero.
   */
  const respondido = contestado(item, valores[item.id]);

  function guardar(valor: unknown) {
    setValores((previos) => ({ ...previos, [item.id]: valor }));
    setFallo(null);

    // Se guarda en cuanto se marca. La pantalla no espera al servidor: si algo
    // falla se avisa, pero la persona no se queda mirando un reloj en cada
    // una de las 68 preguntas.
    const guardado = pase
      ? responderConPase(pase, item.id, valor)
      : responder(asignacion, item.id, valor);

    guardado.then((r) => {
      if (!r.ok) {
        setFallo(
          r.mensaje ??
            "No pudimos guardar esa respuesta. Revisa tu conexión y vuelve a marcarla.",
        );
      }
    });
  }

  /*
   * Enviada la prueba, esta pantalla deja de ser un examen.
   *
   * Se sustituye entera en vez de añadir la despedida debajo: quedarse el
   * cuestionario arriba invita a revisar respuestas que ya no se pueden
   * cambiar, y deja el «ya puedes cerrar esta página» a 68 preguntas de scroll
   * de donde tiene que estar.
   */
  if (enviada) {
    return <FinDeLaPrueba cierre={cierre} />;
  }

  return (
    /* Misma razón que en el informe: aquí se lee un enunciado, no se opera. */
    <div className="flex max-w-[70ch] flex-col gap-6">
      <Progreso hechos={respondidos} total={items.length} />

      {fallo ? (
        <Alert tone="danger" title="No se guardó tu última respuesta">
          {fallo}
        </Alert>
      ) : null}

      <div className="border-line bg-panel rounded-xl border p-6">
        <p className="text-text-muted text-sm">
          {indice + 1} de {items.length}
        </p>
        <h2 className="text-text-strong mt-1 text-lg font-semibold">
          {item.enunciado}
        </h2>

        <div className="mt-5">
          {item.tipo === "forced_choice" ? (
            <EleccionForzada
              item={item}
              valor={(valores[item.id] ?? {}) as Marca}
              onCambio={guardar}
            />
          ) : item.tipo === "likert" ? (
            <Likert
              item={item}
              valor={valores[item.id] as number | undefined}
              onCambio={guardar}
            />
          ) : (
            <Alert
              tone="warning"
              title="Este tipo de pregunta aún no se dibuja"
            >
              Avísale al profesional: la prueba tiene un ítem de tipo «
              {item.tipo}» que esta pantalla no sabe mostrar.
            </Alert>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={indice === 0}
          onClick={() => setIndice((n) => Math.max(0, n - 1))}
        >
          Anterior
        </Button>

        {indice < items.length - 1 ? (
          <Button
            disabled={!respondido}
            onClick={() => setIndice((n) => n + 1)}
          >
            Siguiente
          </Button>
        ) : (
          <form
            action={(formData) =>
              iniciarEnvio(async () => {
                if (pase) {
                  const r = await enviarConPase(pase);
                  if (!r.ok) {
                    setFallo(r.mensaje ?? "No se pudo enviar.");
                    return;
                  }
                  /*
                   * `null` cuando el motor no llegó a publicar.
                   *
                   * La pantalla del final lo distingue para decir «se está
                   * preparando» en vez de prometer un correo que no salió.
                   */
                  setCierre(r.cierre ?? null);
                  setEnviada(true);
                  return;
                }
                await enviarPrueba({ ok: false, mensaje: "" }, formData);
              })
            }
          >
            <input type="hidden" name="asignacion" value={asignacion} />
            <Button type="submit" disabled={!completo || enviando}>
              {enviando ? "Enviando…" : "Terminar y enviar"}
            </Button>
          </form>
        )}
      </div>

      {/* Se dice POR QUÉ está apagado. Un botón inerte sin explicación se lee
          como una avería. */}
      {!respondido ? (
        <p className="text-text-muted text-sm">
          {item.tipo === "forced_choice"
            ? "Marca las dos: la que más te describe y la que menos. Puedes volver atrás cuando quieras y cambiar lo que ya marcaste."
            : "Responde para continuar. Puedes volver atrás cuando quieras y cambiar lo que ya marcaste."}
        </p>
      ) : null}

      {!completo && indice === items.length - 1 ? (
        <Alert tone="info" title="Te faltan respuestas">
          Has respondido {respondidos} de {items.length}. Usa «Anterior» para
          volver a las que quedaron en blanco; el botón de enviar se activa
          cuando estén todas.
        </Alert>
      ) : null}
    </div>
  );
}

function Progreso({ hechos, total }: { hechos: number; total: number }) {
  const porcentaje = Math.round((hechos / total) * 100);
  return (
    <div>
      <div className="text-text-muted flex justify-between text-sm">
        <span>
          {hechos} de {total} respondidas
        </span>
        <span>{porcentaje}%</span>
      </div>
      <div
        className="bg-line mt-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de la prueba"
      >
        <div
          className="bg-accent h-full transition-all"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Elegir la que MÁS y la que MENOS describe.
 *
 * La misma opción no puede ser las dos cosas: marcar «más» donde ya estaba
 * «menos» libera la otra en vez de dejar un estado imposible que la persona
 * tendría que deshacer a mano.
 */
function EleccionForzada({
  item,
  valor,
  onCambio,
}: {
  item: Item;
  valor: Marca;
  onCambio: (v: Marca) => void;
}) {
  function marcar(columna: "mas" | "menos", id: string) {
    const otra = columna === "mas" ? "menos" : "mas";
    const siguiente: Marca = { ...valor, [columna]: id };
    if (siguiente[otra] === id) delete siguiente[otra];
    onCambio(siguiente);
  }

  return (
    <>
      {/*
        La instrucción va en cada bloque, no una vez al principio.
        Son 28 pantallas iguales: quien llegue a la novena no va a recordar
        una frase que leyó al empezar, y equivocarse de columna le cambia el
        perfil.
      */}
      <p className="text-text-muted mb-4 text-sm">
        De estas cuatro, marca la que{" "}
        <strong className="text-text-strong">más</strong> te describe y la que{" "}
        <strong className="text-text-strong">menos</strong>. No hay respuestas
        buenas ni malas.
      </p>

      <table className="w-full">
        <thead>
          <tr className="text-text-muted text-sm">
            <th className="pb-2 text-left font-medium">Opción</th>
            <th className="w-20 pb-2 font-medium">Más</th>
            <th className="w-20 pb-2 font-medium">Menos</th>
          </tr>
        </thead>
        <tbody>
          {item.opciones.map((opcion) => (
            <tr key={opcion.id} className="border-line border-t">
              <td className="text-text-body py-3">{opcion.texto}</td>
              {(["mas", "menos"] as const).map((columna) => (
                <td key={columna} className="py-3 text-center">
                  <input
                    type="radio"
                    name={`${item.id}-${columna}`}
                    checked={valor[columna] === opcion.id}
                    onChange={() => marcar(columna, opcion.id)}
                    aria-label={`${opcion.texto}: la que ${columna === "mas" ? "más" : "menos"} me describe`}
                    className="size-5 accent-[var(--accent)]"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Likert({
  item,
  valor,
  onCambio,
}: {
  item: Item;
  valor: number | undefined;
  onCambio: (v: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-text-muted mb-3 text-sm">
        1 es «no me describe» y 5 es «me describe del todo».
      </legend>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={cn(
              "ease-psi flex size-12 cursor-pointer items-center justify-center rounded-lg border text-base font-medium transition-colors duration-150",
              // Lo marcado tiene que verse a un metro de distancia: son 40
              // afirmaciones seguidas y la única señal de que la respuesta
              // quedó registrada es esta.
              valor === n
                ? "border-accent bg-accent text-surface-0"
                : "border-line-interactive bg-panel text-text-body hover:border-accent hover:bg-accent-soft",
            )}
          >
            <input
              type="radio"
              name={item.id}
              value={n}
              checked={valor === n}
              onChange={() => onCambio(n)}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
