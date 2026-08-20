import Link from "next/link";

/**
 * Anterior y siguiente, con el total delante.
 *
 * Vivía escrita a mano dentro de la cola de evaluaciones. En cuanto hizo falta
 * en las sesiones y en los informes de la empresa iban a ser tres copias de lo
 * mismo, que es como acaban divergiendo: una dice «página 1 de 2» y otra «2
 * páginas», y nadie decidió que fueran distintas.
 *
 * Solo aparece cuando hay más de una página. «Página 1 de 1» debajo de tres
 * filas es ruido que ocupa el sitio de algo útil.
 *
 * No hay saltos numerados a propósito. Con dos páginas sobran, y con veinte no
 * se llega a la catorce pulsando: se llega buscando, y para eso está el
 * buscador donde lo hay.
 */
export function Paginacion({
  pagina,
  total,
  porPagina,
  enlace,
  nombre = "resultados",
}: {
  pagina: number;
  total: number;
  porPagina: number;
  /** Cómo se construye la dirección de otra página, conservando los filtros. */
  enlace: (pagina: number) => string;
  /** Cómo se llama lo que se cuenta: «sesiones», «informes»… */
  nombre?: string;
}) {
  const ultima = Math.max(1, Math.ceil(total / porPagina));

  if (ultima <= 1) return null;

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <span className="text-text-muted text-sm">
        {total} {nombre} · página {pagina} de {ultima}
      </span>

      <div className="flex items-center gap-2">
        {pagina > 1 && (
          <Link
            href={enlace(pagina - 1)}
            className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          >
            Anterior
          </Link>
        )}
        {pagina < ultima && (
          <Link
            href={enlace(pagina + 1)}
            className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          >
            Siguiente
          </Link>
        )}
      </div>
    </nav>
  );
}
