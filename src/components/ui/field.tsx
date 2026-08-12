"use client";

import { AlertCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo de formulario (SPEC.md §8.2).
 *
 * Decisiones que este componente hace cumplir y que NO son negociables:
 *
 *  - `text-base` (16px) siempre. Por debajo de 16px iOS hace zoom al enfocar
 *    el campo y descoloca la pantalla.
 *  - Borde `line-interactive` (#8494AC, 3.08:1). El gris suave que se ve mejor
 *    (#C6D0DE) da 1.56:1 e incumple WCAG 1.4.11 para límites de componentes
 *    interactivos. Un campo cuyo borde no se distingue del fondo no existe
 *    para quien tiene baja visión.
 *  - Etiqueta SIEMPRE visible arriba. Nunca el placeholder como etiqueta:
 *    desaparece al escribir y deja al usuario sin contexto.
 *  - Los campos opcionales se marcan "(opcional)". Los obligatorios NO llevan
 *    asterisco — marcar la excepción es menos ruidoso que marcar la norma.
 *  - El error se liga con `aria-describedby` y se anuncia con `role="alert"`.
 */

type FieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  /** Texto de ayuda persistente bajo el campo. */
  help?: string;
  /** Mensaje de error. Su presencia cambia el campo a estado de error. */
  error?: string;
  optional?: boolean;
};

export function Field({
  id,
  label,
  help,
  error,
  optional,
  className,
  ...props
}: FieldProps) {
  const helpId = help ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-text-strong text-sm font-medium">
        {label}
        {optional && (
          <span className="text-text-muted ml-1.5 font-normal">(opcional)</span>
        )}
      </label>

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "bg-panel text-text-strong h-11 w-full rounded-md border px-3 text-base",
          "placeholder:text-text-muted",
          "ease-psi transition-[border-color,box-shadow] duration-150",
          "focus:outline-none focus-visible:outline-none",
          "disabled:bg-sunken disabled:text-text-muted",
          error
            ? "border-danger-600 focus:border-danger-600 focus:shadow-[0_0_0_3px_var(--focus-halo-danger)]"
            : "border-line-interactive focus:border-accent focus:shadow-[0_0_0_3px_var(--focus-halo)]",
          className,
        )}
        {...props}
      />

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-micro text-danger-600 flex items-start gap-1.5"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {error}
        </p>
      )}

      {help && (
        <p id={helpId} className="text-micro text-text-muted">
          {help}
        </p>
      )}
    </div>
  );
}
