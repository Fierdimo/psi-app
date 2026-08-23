"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Un modal ancho, centrado, para lo que se lee en horizontal.
 *
 * Existe junto a `PanelLateral` y no en su lugar. El panel de la derecha es
 * para editar algo corto —un formulario de cinco campos— donde conservar la
 * lista a la vista ayuda. Un informe no es eso: son párrafos y una tabla de
 * parámetros, y en 600 px de ancho se lee a tres palabras por línea con el
 * doble de desplazamiento vertical.
 *
 * Comparte con el panel todo lo que no es forma, porque son las decisiones que
 * costaron: cerrar con Escape, cerrar pulsando el velo, bloquear el
 * desplazamiento del fondo, y desmontarse solo cuando la navegación ya se fue
 * a otra parte.
 */
export function ModalAncho({
  titulo,
  children,
  ruta,
  /**
   * A dónde ir al cerrar cuando no hay «atrás» al que volver.
   *
   * Lo pasa la ruta directa —la que se abre al recargar o al pegar la
   * dirección—, donde `router.back()` sacaría del sitio o, en una pestaña
   * nueva, no haría nada y el modal se quedaría clavado.
   */
  volverA,
}: {
  titulo: string;
  children: React.ReactNode;
  ruta?: string;
  volverA?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const cerrar = () => {
    if (volverA) router.push(volverA);
    else router.back();
  };

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alPulsar);

    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = previo;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, volverA]);

  if (ruta && pathname !== ruta && !pathname.startsWith(`${ruta}/`))
    return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-40 flex items-center justify-center p-0 sm:p-6"
    >
      <div
        aria-hidden="true"
        onClick={cerrar}
        className="bg-overlay absolute inset-0"
      />

      {/*
        A pantalla completa en el móvil y con márgenes desde `sm`.
        
        Un modal centrado con márgenes en una pantalla de 360 px deja el
        contenido en 300 y el velo alrededor no sirve para nada: ahí lo que
        hace falta es todo el ancho.
      */}
      <section className="bg-bg border-line ease-psi animate-panel relative flex max-h-full w-full max-w-[1000px] flex-col overflow-hidden border shadow-lg sm:max-h-[88vh] sm:rounded-xl">
        <header className="border-line bg-bg flex items-start justify-between gap-4 border-b px-6 py-4">
          <h2 className="text-h4 min-w-0 truncate">{titulo}</h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="text-text-muted hover:bg-accent-soft hover:text-accent ease-psi -mr-2 grid size-9 shrink-0 place-items-center rounded-md transition-colors duration-150"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        {/* El desplazamiento vive DENTRO, con la cabecera fija: en un informe
            largo, perder el botón de cerrar al bajar obliga a volver arriba
            para salir. */}
        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </section>
    </div>
  );
}
