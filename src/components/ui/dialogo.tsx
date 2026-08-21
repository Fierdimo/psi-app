"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Un alto antes de algo que no se deshace.
 *
 * Confirmar una sesión le manda un correo a la empresa y le abre el acceso a
 * cada convocado; rechazarla le dice que no a una solicitud que tardó en
 * llegar. Ninguna de las dos tiene botón de volver atrás, y las dos estaban a
 * un clic de distancia del ratón.
 *
 * No es un `window.confirm`: ahí no cabe decir CUÁNTA gente queda citada ni en
 * cuántos días, que es justo lo que hay que mirar antes de decir que sí.
 *
 * El foco entra en el botón de cancelar, no en el de aceptar. Quien abrió esto
 * por accidente pulsa Intro o Espacio para quitárselo de encima: si el foco
 * estuviera en «aceptar», el modal habría convertido un clic accidental en dos.
 */
export function Dialogo({
  abierto,
  titulo,
  children,
  aceptar,
  aceptando,
  variante = "primary",
  formulario,
  onAceptar,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  children: React.ReactNode;
  /** Qué dice el botón que sigue adelante. Un verbo, no «Sí». */
  aceptar: string;
  /** Texto mientras la acción está en curso. Su presencia bloquea el botón. */
  aceptando?: string;
  variante?: "primary" | "destructive";
  /**
   * El `id` del formulario que envía el botón de aceptar, si lo hay.
   *
   * El atributo `form` de HTML permite que un botón envíe un formulario que no
   * lo contiene, así que la acción de servidor se dispara como en cualquier
   * otro sitio de la aplicación —con `useActionState` y su estado de envío— en
   * vez de tener que invocarla a mano desde un `onClick`.
   */
  formulario?: string;
  /** Para los diálogos que no envían nada, o para cerrar antes de enviar. */
  onAceptar?: () => void;
  onCerrar: () => void;
}) {
  const tituloId = useId();
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;

    cancelar.current?.focus();

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alPulsar);

    // El fondo no se desplaza mientras hay una decisión encima.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = previo;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/*
        El velo NO cierra al pulsarlo.
        
        En un panel de consulta cerrar por fuera es lo cómodo; aquí lo que se
        quiere es una decisión, y un clic despistado en el borde no es ninguna
        de las dos. Para salir están la tecla de escape y el botón.
      */}
      <div aria-hidden="true" className="bg-overlay absolute inset-0" />

      <div className="bg-bg border-line animate-panel relative flex w-full max-w-[28rem] flex-col gap-4 rounded-xl border p-5 text-left shadow-lg">
        <h2 id={tituloId} className="text-h4">
          {titulo}
        </h2>

        <div className="text-text-body flex flex-col gap-3 text-sm">
          {children}
        </div>

        {/*
          Cancelar a la IZQUIERDA de aceptar, y con el mismo tamaño.
          
          Un «no» pequeño y gris al lado de un «sí» grande de color es una
          pregunta que ya viene contestada.
        */}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelar}
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCerrar}
          >
            Cancelar
          </Button>
          <Button
            type={formulario ? "submit" : "button"}
            form={formulario}
            size="sm"
            variant={variante}
            onClick={onAceptar}
            loading={aceptando}
          >
            {aceptar}
          </Button>
        </div>
      </div>
    </div>
  );
}
