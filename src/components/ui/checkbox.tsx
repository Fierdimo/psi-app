"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Casilla de verificación.
 *
 * Toda la fila es objetivo de toque, no solo el cuadrito de 16 px: la etiqueta
 * envuelve al control, así que pulsar en cualquier parte funciona. Alto mínimo
 * 44 px por WCAG 2.5.8.
 */
type CheckboxProps = Omit<React.ComponentProps<"input">, "type" | "id"> & {
  id: string;
  label: string;
  descripcion?: string;
};

export function Checkbox({
  id,
  label,
  descripcion,
  className,
  ...props
}: CheckboxProps) {
  const descId = descripcion ? `${id}-desc` : undefined;

  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 py-1"
    >
      <input
        id={id}
        type="checkbox"
        aria-describedby={descId}
        className={cn(
          "border-line-interactive text-accent accent-accent mt-0.5 size-5 shrink-0 rounded-sm border",
          className,
        )}
        {...props}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-text-strong text-sm font-medium">{label}</span>
        {descripcion && (
          <span id={descId} className="text-text-muted text-micro">
            {descripcion}
          </span>
        )}
      </span>
    </label>
  );
}
