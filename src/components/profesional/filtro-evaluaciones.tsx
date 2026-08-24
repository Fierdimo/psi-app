import Link from "next/link";
import { Search } from "lucide-react";

/**
 * El filtro y el buscador de las evaluaciones.
 *
 * Existen porque esta lista SOLO CRECE. Cada persona evaluada deja una fila
 * para siempre, así que a los dos años son miles y la pantalla deja de servir.
 *
 * La partición es por lo que se hace con cada grupo:
 *
 *   · «Todas» es la portada: lo último que ha llegado, de cualquier empresa.
 *   · «Por revisar» es trabajo tuyo, y drena: lo calificas y sale. Desde que
 *     el informe se publica solo, está vacía casi siempre.
 *   · «En marcha» es de otros —están respondiendo— y también drena.
 *   · «Publicadas» ya no es una lista, es un archivo. No se recorre, se busca.
 *
 * Por eso el buscador vive aquí arriba y no dentro de una pestaña: quien busca
 * a alguien concreto normalmente lo busca entre las publicadas, que es lo que
 * nunca va a encontrar recorriendo.
 */

export type Vista = "revisar" | "curso" | "publicadas" | "todas";

/*
 * «Todas» va primera, y es la que se abre por defecto.
 *
 * Encabezaba «Por revisar» cuando esto era una cola: lo que esperaba tu
 * revisión era el trabajo del día. Con el informe publicándose solo esa
 * pestaña está vacía casi siempre, y abrir en una lista vacía parece una
 * pantalla rota.
 */
export const VISTAS: { clave: Vista; texto: string; estados: string[] }[] = [
  { clave: "todas", texto: "Todas", estados: [] },
  {
    clave: "revisar",
    texto: "Por revisar",
    estados: ["enviada", "calificada"],
  },
  { clave: "curso", texto: "En marcha", estados: ["asignada", "en_curso"] },
  { clave: "publicadas", texto: "Publicadas", estados: ["publicada"] },
];

export function FiltroEvaluaciones({
  vista,
  busqueda,
  cuentas,
}: {
  vista: Vista;
  busqueda: string;
  /** Cuántas hay en cada pestaña. Sin el número, «Por revisar» no dice si hay algo que hacer. */
  cuentas: Partial<Record<Vista, number>>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filtrar evaluaciones" className="flex flex-wrap gap-2">
        {VISTAS.map((v) => {
          const activa = v.clave === vista;
          const cuenta = cuentas[v.clave];

          return (
            <Link
              key={v.clave}
              /* La búsqueda se conserva al cambiar de pestaña: quien busca a
                 alguien y no lo encuentra en «Por revisar» lo siguiente que
                 hace es mirar en «Publicadas», y volver a escribir el nombre
                 sobra. */
              href={{
                pathname: "/profesional/evaluaciones",
                query: {
                  // «todas» es el valor por defecto: no ensucia la dirección.
                  ...(v.clave === "todas" ? {} : { estado: v.clave }),
                  ...(busqueda ? { q: busqueda } : {}),
                },
              }}
              aria-current={activa ? "page" : undefined}
              className={
                activa
                  ? "bg-accent text-surface-0 ease-psi rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                  : "border-line-interactive text-text-body hover:bg-accent-soft ease-psi rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
              }
            >
              {v.texto}
              {cuenta !== undefined && cuenta > 0 && (
                <span className="tabular ml-1.5 opacity-80">{cuenta}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/*
        Un formulario `GET` y no un campo con JavaScript: la búsqueda queda en
        la dirección, así que se puede recargar, guardar y volver atrás sin
        perderla. Y funciona con el teclado sin que nadie lo programe.
      */}
      <form
        action="/profesional/evaluaciones"
        className="flex flex-wrap items-end gap-2"
      >
        {vista !== "todas" && (
          <input type="hidden" name="estado" value={vista} />
        )}

        <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-text-body text-sm font-medium">
            Buscar una evaluación
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder="Nombre, documento o empresa"
            className="border-line-interactive bg-panel text-text-strong placeholder:text-text-muted focus-visible:outline-accent h-11 rounded-md border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>

        <button
          type="submit"
          className="border-line-interactive text-accent-on-soft hover:bg-accent-soft ease-psi inline-flex h-11 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors duration-150"
        >
          <Search aria-hidden="true" className="size-4" />
          Buscar
        </button>

        {busqueda && (
          <Link
            href={{
              pathname: "/profesional/evaluaciones",
              query: vista === "todas" ? {} : { estado: vista },
            }}
            className="text-text-muted hover:text-text-body ease-psi self-center text-sm underline underline-offset-4 transition-colors duration-150"
          >
            Quitar la búsqueda
          </Link>
        )}
      </form>
    </div>
  );
}
