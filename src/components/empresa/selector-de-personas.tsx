"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface PersonaElegible {
  id: string;
  nombre: string;
  apellidos: string | null;
  documento: string;
  cargo: string | null;
  vinculo: string;
}

/**
 * A quién se convoca, cuando la lista es larga.
 *
 * Antes era una lista de casillas con TODAS las personas cargadas. Con doce ya
 * costaba, y una empresa que encarga cien evaluaciones tiene cien filas: había
 * que recorrerlas con la vista buscando un nombre, y lo ya elegido se perdía
 * al desplazarse.
 *
 * Tres decisiones:
 *
 *   · Se BUSCA en vez de recorrer, por nombre, documento o cargo. El documento
 *     entra en la búsqueda porque es lo que distingue a dos personas que se
 *     llaman igual, que es justo cuando uno duda.
 *   · Lo elegido va ARRIBA y siempre visible, con su aspa para quitarlo. Antes
 *     había que volver a encontrar la fila para desmarcarla.
 *   · Los resultados se limitan y se dice cuántos quedan fuera, en vez de
 *     pintar cien filas que nadie va a leer.
 *
 * Los seleccionados viajan como `<input type="hidden">`, así que el formulario
 * sigue siendo un formulario y la acción de servidor no cambia.
 */
export function SelectorDePersonas({
  personas,
  nombre = "personas",
  inicial = [],
  error,
}: {
  personas: PersonaElegible[];
  nombre?: string;
  inicial?: string[];
  error?: string;
}) {
  const [elegidas, setElegidas] = useState<string[]>(inicial);
  const [busqueda, setBusqueda] = useState("");

  const porId = useMemo(
    () => new Map(personas.map((p) => [p.id, p])),
    [personas],
  );

  const TOPE = 8;

  const coincidencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const libres = personas.filter((p) => !elegidas.includes(p.id));

    if (q === "") return libres;

    return libres.filter((p) =>
      [p.nombre, p.apellidos, p.documento, p.cargo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [personas, elegidas, busqueda]);

  const visibles = coincidencias.slice(0, TOPE);
  const ocultas = coincidencias.length - visibles.length;

  function alternar(id: string) {
    setElegidas((previas) =>
      previas.includes(id) ? previas.filter((x) => x !== id) : [...previas, id],
    );
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-text-strong flex flex-wrap items-baseline gap-2 font-medium">
        A quién convocas
        <span className="text-text-muted text-sm font-normal">
          {elegidas.length === 0
            ? "ninguna seleccionada"
            : `${elegidas.length} de ${personas.length}`}
        </span>
      </legend>

      {error && <p className="text-danger-600 text-sm">{error}</p>}

      {elegidas.map((id) => (
        <input key={id} type="hidden" name={nombre} value={id} />
      ))}

      {elegidas.length > 0 && (
        <div className="border-line bg-bg flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-text-strong text-sm font-medium">
              Convocadas ({elegidas.length})
            </span>
            <button
              type="button"
              onClick={() => setElegidas([])}
              className="text-text-muted hover:text-danger-600 text-sm"
            >
              Quitar todas
            </button>
          </div>

          {/*
            Lo elegido tampoco crece sin freno.
            Con veinticinco personas esta zona medía casi 900 px y empujaba el
            botón de enviar fuera de la pantalla; con cien, la pantalla entera
            era una lista de nombres. Tope y desplazamiento propio.
          */}
          <ul className="flex max-h-40 flex-wrap gap-2 overflow-y-auto overscroll-contain">
            {elegidas.map((id) => {
              const p = porId.get(id);
              if (!p) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => alternar(id)}
                    className="bg-accent-soft text-accent-on-soft hover:bg-accent hover:text-surface-0 ease-psi flex items-center gap-1.5 rounded-full py-1 pr-2 pl-3 text-sm transition-colors duration-150"
                  >
                    {[p.nombre, p.apellidos].filter(Boolean).join(" ")}
                    <X aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">Quitar de la convocatoria</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <label className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="text-text-muted pointer-events-none absolute left-3 size-4"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, documento o cargo"
          aria-label="Buscar personas"
          className="border-line-interactive bg-panel text-text-body w-full rounded-md border py-2.5 pr-3 pl-9 text-sm"
        />
      </label>

      {personas.length === 0 ? (
        <p className="text-text-muted text-sm">
          Todavía no has cargado a nadie. Añade personas antes de pedir una
          sesión.
        </p>
      ) : visibles.length === 0 ? (
        <p className="text-text-muted text-sm">
          {busqueda.trim() === ""
            ? "Ya las elegiste a todas."
            : "Nadie coincide con esa búsqueda."}
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-md border">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => alternar(p.id)}
                className={cn(
                  "hover:bg-accent-soft ease-psi flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
                )}
              >
                {/*
                  Sin la etiqueta de vínculo.

                  Empleado y aspirante reciben el mismo trato desde que la
                  evaluación es de la convocatoria, así que solo servía para
                  empujar el nombre y partir la fila en dos cuando el nombre
                  era largo.
                */}
                <span className="min-w-0 flex-1">
                  <span className="text-text-strong block font-medium">
                    {[p.nombre, p.apellidos].filter(Boolean).join(" ")}
                  </span>
                  <span className="text-text-muted block text-sm">
                    {p.documento}
                    {p.cargo && ` · ${p.cargo}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Añadir en bloque, porque el caso real es «encargo cien exámenes».
        Elegirlas de una en una son cien clics, y el buscador ya sabe cuáles
        son: si la búsqueda acota a un cargo o a un lote de documentos, se
        añaden todas de una vez.
      */}
      {coincidencias.length > 1 && (
        <button
          type="button"
          onClick={() =>
            setElegidas((previas) => [
              ...previas,
              ...coincidencias.map((p) => p.id),
            ])
          }
          className="text-accent-on-soft hover:text-accent self-start text-sm font-medium"
        >
          Añadir {coincidencias.length}{" "}
          {busqueda.trim() === "" ? "personas" : "que coinciden"}
        </button>
      )}

      {ocultas > 0 && (
        <p className="text-text-muted text-sm">
          Se muestran {visibles.length} de {coincidencias.length}. Afina la
          búsqueda o añádelas todas.
        </p>
      )}
    </fieldset>
  );
}
