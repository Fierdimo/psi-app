"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Panel que entra por la derecha, encima de lo que había.
 *
 * Se usa para abrir el detalle de algo sin perder de vista la lista de la que
 * salió: al cerrar, el calendario sigue donde estaba, en el mes que se estaba
 * mirando. Cambiar de pantalla entera obligaba a volver a situarse cada vez.
 *
 * Cerrar es `router.back()` y no una navegación a una ruta fija: así el panel
 * se comporta como espera el navegador —el botón «atrás» del móvil lo cierra—
 * y no inventa un historial propio.
 */
export function PanelLateral({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", alPulsar);

    // Con el panel abierto, el fondo no se desplaza: si lo hiciera, cerrar
    // devolvería a un sitio distinto del que se venía.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = previo;
    };
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-40 flex justify-end"
    >
      {/* El velo cierra al pulsarlo, que es lo que todo el mundo intenta
          primero. No es un botón para el lector de pantalla: para eso está la
          equis, que sí es alcanzable con el teclado. */}
      <div
        aria-hidden="true"
        onClick={() => router.back()}
        className="bg-overlay absolute inset-0"
      />

      <aside className="bg-bg ease-psi animate-panel border-line relative flex h-full w-full max-w-[600px] flex-col overflow-y-auto border-l shadow-lg">
        <div className="bg-bg sticky top-0 z-10 flex justify-end p-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Cerrar"
            className="text-text-muted hover:bg-accent-soft hover:text-accent ease-psi grid size-9 place-items-center rounded-md transition-colors duration-150"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="px-1 pb-8">{children}</div>
      </aside>
    </div>
  );
}
