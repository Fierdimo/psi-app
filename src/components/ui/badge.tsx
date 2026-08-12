import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Badge de estado (SPEC.md §8.4).
 *
 * El color NUNCA es el único portador de información: el badge siempre lleva
 * texto, y las pantallas que lo usan repiten el estado en prosa. Un badge
 * ámbar sin la palabra "por confirmar" no comunica nada a quien no distingue
 * ese tono.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2.5 py-1 text-micro font-semibold tracking-[0.01em] uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-text-muted",
        accent: "bg-accent-soft text-accent-on-soft",
        success: "bg-success-50 text-success-600",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-600",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
