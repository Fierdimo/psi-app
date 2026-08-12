// Sin "use client" a propósito: este componente no usa estado ni efectos, solo
// estilos. Dejándolo como componente de servidor, `buttonVariants` puede
// importarse desde un componente de servidor (p. ej. para dar aspecto de botón
// a un <Link>), y sigue funcionando dentro de componentes cliente.
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Botón (SPEC.md §8.1).
 *
 * Reglas que este componente hace cumplir:
 *  - Una sola acción primaria por pantalla (responsabilidad de quien lo usa).
 *  - Todo botón que dispara red usa `loading` con TEXTO propio, no solo un
 *    spinner, y queda bloqueado para evitar doble envío.
 *  - Deshabilitado NO usa `cursor: not-allowed` — comunica el bloqueo con
 *    color, no con un cursor que sugiere que algo está roto.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md font-medium",
    "transition-[background-color,border-color,color] duration-150 ease-psi",
    "disabled:pointer-events-none disabled:bg-sunken disabled:text-text-muted",
    "disabled:border-line-decorative",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-surface-0 hover:bg-accent-hover active:bg-accent-active",
        secondary:
          "border border-line-interactive bg-panel text-accent-on-soft hover:border-accent hover:bg-accent-soft",
        ghost: "text-text-body hover:bg-sunken",
        destructive:
          "bg-danger-600 text-surface-0 hover:brightness-110 active:brightness-95",
        "destructive-quiet":
          "border border-danger-600 bg-transparent text-danger-600 hover:bg-danger-50",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-13 px-6 text-lg",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Texto mostrado mientras la operación está en curso, p. ej. "Enviando…".
     * Su presencia activa el estado de carga y bloquea el botón.
     */
    loading?: string;
  };

export function Button({
  className,
  variant,
  size,
  block,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isLoading = Boolean(loading);

  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {loading}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { buttonVariants };
