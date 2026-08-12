import { cn } from "@/lib/utils";

/**
 * Wordmark de la plataforma (SPEC.md §2.4).
 *
 * Punto único de cambio para la identidad: cuando llegue la marca definitiva,
 * se toca este archivo y la variable NEXT_PUBLIC_BRAND_NAME. Nada más.
 */

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Psi";

type BrandProps = {
  /** `dark` para fondos azul rey oscuro (panel de ingreso, área del profesional). */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  /** Oculta el texto y deja solo el glifo. */
  glyphOnly?: boolean;
  className?: string;
};

const glyphSize = {
  sm: "size-7 text-base rounded-[7px]",
  md: "size-9 text-xl rounded-[9px]",
  lg: "size-11 text-2xl rounded-[11px]",
};

const textSize = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

export function Brand({
  tone = "light",
  size = "md",
  glyphOnly = false,
  className,
}: BrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center leading-none font-semibold",
          glyphSize[size],
          tone === "dark"
            ? "bg-surface-0 text-brand-800"
            : "bg-brand-600 text-surface-0",
        )}
      >
        Ψ
      </span>
      {glyphOnly ? (
        <span className="sr-only">{BRAND_NAME}</span>
      ) : (
        <span
          className={cn(
            "font-semibold tracking-[-0.02em]",
            textSize[size],
            tone === "dark" ? "text-surface-0" : "text-brand-800",
          )}
        >
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}
