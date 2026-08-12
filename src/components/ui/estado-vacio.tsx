import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Estado vacío (SPEC.md §7.6, §10).
 *
 * Un placeholder bien hecho construye confianza; uno mal hecho parece
 * abandono. La regla: explica qué vivirá aquí, por qué aún no está, y qué
 * hacer mientras tanto.
 *
 * NUNCA una fecha estimada. Una promesa incumplida cuesta más que la ausencia.
 */
export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  proximamente = false,
  enlace,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  proximamente?: boolean;
  enlace?: { href: string; texto: string };
}) {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-4 py-16 text-center">
      <span className="bg-accent-soft text-accent grid size-14 place-items-center rounded-full">
        <Icono aria-hidden="true" className="size-6" />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-h4">{titulo}</h2>
        <p className="text-text-body">{descripcion}</p>
      </div>

      {proximamente && (
        <span className="bg-sunken text-text-muted text-micro rounded-sm px-2.5 py-1 font-semibold tracking-[0.06em] uppercase">
          Próximamente
        </span>
      )}

      {enlace && (
        <Link href={enlace.href} className="text-accent text-sm font-medium">
          {enlace.texto}
        </Link>
      )}
    </div>
  );
}
