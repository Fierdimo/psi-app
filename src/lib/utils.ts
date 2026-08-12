import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases resolviendo conflictos de Tailwind (la última gana). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
