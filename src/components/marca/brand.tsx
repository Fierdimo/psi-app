import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Wordmark de la plataforma (SPEC.md §2.4).
 *
 * Punto único de cambio para la identidad: este archivo y la variable
 * NEXT_PUBLIC_BRAND_NAME. Nada más.
 *
 * El glifo es la marca real de la consulta —un perfil humano trazado como red
 * de nodos— en el mismo azul de `--brand-600`. Sobre fondos oscuros no existe
 * una versión clara del archivo, así que se invierte por filtro: la marca es
 * de un solo color, de modo que invertirla da blanco limpio y no un negativo
 * sucio.
 */

export const BRAND_NAME =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "JBR Psicometrías";

type BrandProps = {
  /** `dark` para fondos azul rey oscuro (panel de ingreso, área del profesional). */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  /** Oculta el texto y deja solo el glifo. */
  glyphOnly?: boolean;
  className?: string;
};

const glyphPx = { sm: 28, md: 36, lg: 44 };

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
  const px = glyphPx[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/marca/jbr-marca.png"
        alt=""
        aria-hidden="true"
        width={px}
        height={px}
        style={{ width: px, height: px }}
        className={cn(
          "shrink-0 object-contain",
          tone === "dark" && "brightness-0 invert",
        )}
      />
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
