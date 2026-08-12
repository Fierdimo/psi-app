/**
 * Encabezado común de las pantallas privadas.
 *
 * Toda sección tiene título y una frase de contexto, incluidas las que aún no
 * tienen contenido: una pantalla que solo dice «Próximamente» sin explicar de
 * qué se trata no informa de nada.
 */
export function EncabezadoPagina({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-line flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-h1">{titulo}</h1>
        {descripcion && (
          <p className="text-text-body max-w-[62ch] text-lg">{descripcion}</p>
        )}
      </div>
      {children}
    </header>
  );
}

/** Contenedor de una pantalla privada. Medida y respiración uniformes. */
export function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {children}
    </div>
  );
}
