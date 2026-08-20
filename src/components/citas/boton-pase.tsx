"use client";

import { KeyRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { EnlacesDeAcceso } from "@/components/citas/enlaces-de-acceso";
import { paseDePersona } from "@/lib/citas/acciones-pase-persona";
import type { EnlaceDeAcceso } from "@/lib/validacion/auth";

/**
 * El acceso de una persona, en una ventana sobre la tabla.
 *
 * Se pide al pulsar y no viene con la página: cargarla no tiene por qué
 * arrastrar veinticinco testigos vivos hasta el navegador cuando casi siempre
 * se abre para otra cosa.
 */
export function BotonPase({
  persona,
  nombre,
}: {
  persona: string;
  nombre: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pase, setPase] = useState<EnlaceDeAcceso | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;

    let vigente = true;

    paseDePersona(persona).then((salida) => {
      if (!vigente) return;
      if (salida.ok) setPase(salida.pase);
      else setFallo(salida.mensaje);
    });

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alPulsar);

    return () => {
      vigente = false;
      document.removeEventListener("keydown", alPulsar);
    };
  }, [abierto, persona]);

  return (
    <>
      <button
        type="button"
        /* Se limpia al ABRIR y no dentro del efecto: reiniciar el estado
           durante el render encadena una segunda pasada por cada apertura. */
        onClick={() => {
          setPase(null);
          setFallo(null);
          setAbierto(true);
        }}
        className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
      >
        <KeyRound aria-hidden="true" className="size-3.5" />
        Acceso
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Acceso de ${nombre}`}
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
        >
          {/* El velo cierra al pulsarlo, que es lo que todo el mundo intenta
              primero. Para el teclado está la equis. */}
          <div
            aria-hidden="true"
            onClick={() => setAbierto(false)}
            className="bg-overlay absolute inset-0"
          />

          <div className="bg-bg border-line animate-panel relative flex max-h-[85vh] w-full max-w-[36rem] flex-col overflow-y-auto rounded-xl border p-4 text-left shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-h4">Acceso de {nombre}</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-text-muted hover:bg-accent-soft hover:text-accent ease-psi grid size-9 shrink-0 place-items-center rounded-md transition-colors duration-150"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="pt-3">
              {fallo ? (
                <Alert tone="danger" title="No se pudo obtener">
                  {fallo}
                </Alert>
              ) : pase ? (
                <EnlacesDeAcceso
                  enlaces={[pase]}
                  titulo="Su enlace de entrada"
                  nota="El mismo que le llega por correo. Enséñale el QR y que lo escanee con su teléfono, o cópiaselo."
                />
              ) : (
                <p className="text-text-muted text-sm">Buscando su acceso…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
