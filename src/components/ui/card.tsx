import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tarjeta (SPEC.md §8.4).
 *
 * Borde O sombra, nunca ambos: duplicar la separación del fondo produce el
 * aspecto recargado que el spec rechaza. `accent` añade la barra izquierda
 * que se usa para destacar la próxima cita.
 */
type CardProps = React.ComponentProps<"div"> & {
  edge?: "border" | "shadow";
  accent?: boolean;
  sunken?: boolean;
};

export function Card({
  className,
  edge = "border",
  accent = false,
  sunken = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-6",
        sunken ? "bg-sunken" : "bg-panel",
        edge === "border" ? "border-line border" : "shadow-xs",
        accent && "border-l-accent border-l-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-h4 font-semibold tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("text-text-muted text-sm", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-line flex items-center justify-end gap-2.5 border-t pt-3.5",
        className,
      )}
      {...props}
    />
  );
}
