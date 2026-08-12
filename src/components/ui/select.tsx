"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Desplegable nativo, repintado.
 *
 * Se usa `<select>` del sistema y no un menú hecho a mano: en móvil abre la
 * rueda nativa, funciona con lector de pantalla sin trabajo extra y soporta
 * escribir para buscar. Un desplegable propio tendría mejor pinta y peor
 * comportamiento.
 */
type SelectProps = Omit<React.ComponentProps<"select">, "id"> & {
  id: string;
  label: string;
  help?: string;
  error?: string;
  opciones: readonly { valor: string; etiqueta: string }[];
};

export function Select({
  id,
  label,
  help,
  error,
  opciones,
  className,
  ...props
}: SelectProps) {
  const helpId = help ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-text-strong text-sm font-medium">
        {label}
      </label>

      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "border-line-interactive bg-panel text-text-strong h-11 w-full appearance-none rounded-md border pr-10 pl-3 text-base",
            "ease-psi transition-[border-color,box-shadow] duration-150",
            "focus:border-accent focus:shadow-[0_0_0_3px_var(--focus-halo)] focus:outline-none",
            error && "border-danger-600",
            className,
          )}
          {...props}
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-text-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-danger-600 text-micro">
          {error}
        </p>
      )}
      {help && (
        <p id={helpId} className="text-text-muted text-micro">
          {help}
        </p>
      )}
    </div>
  );
}
