import Link from "next/link";
import { Search } from "lucide-react";

import {
  VISTAS_EMPRESA,
  type VistaEvaluaciones,
} from "@/lib/evaluaciones/estados-empresa";

/**
 * Filtro por estado y buscador de la lista de evaluaciones.
 *
 * Los dos juntos y en este orden porque se usan juntos: quien busca a alguien
 * y no lo encuentra en «Sin responder» lo siguiente que hace es mirar en
 * «Informe listo», y volver a escribir el nombre sobra.
 *
 * Enlaces y no un desplegable. Un desplegable dentro del formulario obligaría
 * a elegir y además pulsar «Buscar»; así cambiar de grupo es un clic. Y como
 * son enlaces, el estado vive en la dirección: se recarga, se guarda y se pasa
 * por chat.
 */
export function FiltroDeEvaluaciones({
  vista,
  busqueda,
  cuentas,
}: {
  vista: VistaEvaluaciones;
  busqueda: string;
  /**
   * Cuántas hay en cada grupo, con la búsqueda aplicada.
   *
   * Se cuentan CON el filtro de texto puesto o los números mentirían: buscando
   * «Zulema», un «Sin responder 40» al lado de una tabla con una fila es peor
   * que no poner número.
   */
  cuentas: Partial<Record<VistaEvaluaciones, number>>;
}) {
  const direccion = (
    clave: VistaEvaluaciones,
    conBusqueda: boolean = true,
  ) => ({
    pathname: "/empresa/evaluaciones",
    query: {
      // «todas» es el valor por defecto: no ensucia la dirección.
      ...(clave === "todas" ? {} : { estado: clave }),
      ...(conBusqueda && busqueda ? { q: busqueda } : {}),
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {VISTAS_EMPRESA.map((v) => {
          const activa = v.clave === vista;
          const cuenta = cuentas[v.clave];

          return (
            <Link
              key={v.clave}
              href={direccion(v.clave)}
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
        Un formulario `GET`, sin JavaScript. La búsqueda queda en la dirección,
        así que se puede recargar, guardar y volver atrás sin perderla.
      */}
      <form
        action="/empresa/evaluaciones"
        className="flex flex-wrap items-end gap-2"
      >
        {/* El grupo elegido viaja con la búsqueda: buscar dentro de «Informe
            listo» no debería devolverte a «Todas». */}
        {vista !== "todas" && (
          <input type="hidden" name="estado" value={vista} />
        )}

        <div className="flex max-w-[24rem] min-w-[16rem] flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-text-body text-sm font-medium">
            Buscar una evaluación
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder="Nombre, documento o correo"
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
            href={direccion(vista, false)}
            className="text-text-muted hover:text-text-body ease-psi self-center text-sm underline underline-offset-4 transition-colors duration-150"
          >
            Quitar la búsqueda
          </Link>
        )}
      </form>
    </div>
  );
}
