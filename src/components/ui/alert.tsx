import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Aviso (SPEC.md §8.4).
 *
 * Icono + título + descripción, siempre. El icono no es decorativo: es lo que
 * permite distinguir un error de una confirmación sin depender del color.
 *
 * `role="alert"` solo en tono `danger`, que es el único que interrumpe una
 * tarea en curso. Anunciar cada aviso informativo como alerta convierte al
 * lector de pantalla en ruido y la gente deja de escucharlo.
 */
type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; icon: LucideIcon }> = {
  info: {
    box: "bg-accent-soft border-l-accent text-accent-on-soft",
    icon: Info,
  },
  success: {
    box: "bg-success-50 border-l-success-600 text-success-600",
    icon: CheckCircle2,
  },
  warning: {
    box: "bg-warning-50 border-l-warning-700 text-warning-700",
    icon: AlertTriangle,
  },
  danger: {
    box: "bg-danger-50 border-l-danger-600 text-danger-600",
    icon: XCircle,
  },
};

type AlertProps = React.ComponentProps<"div"> & {
  tone?: Tone;
  title: string;
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: AlertProps) {
  const { box, icon: Icon } = styles[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex gap-3 rounded-lg border-l-[3px] px-4 py-3.5 text-sm leading-relaxed",
        box,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-text-body">{children}</div>}
      </div>
    </div>
  );
}
