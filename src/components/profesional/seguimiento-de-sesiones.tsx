import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { capitalizar, fechaLarga, hora } from "@/lib/fechas/formato";

/**
 * Cómo va cada sesión ya aceptada.
 *
 * «Solicitudes» solo enseñaba lo que esperaba una decisión, y en cuanto se
 * confirmaba una sesión desaparecía. El profesional perdía el hilo justo cuando
 * empieza lo que importa: si la gente consintió, si está respondiendo, si ya
 * hay informes. Para saberlo tenía que acordarse de qué empresa había pedido
 * qué y entrar a buscarla.
 *
 * NO ES UNA TABLA DE NÚMEROS. De los cinco recuentos que trae la base, cada
 * sesión enseña el que dice qué hacer ahora —«falta que 3 consientan», «2 por
 * calificar»— y el resto queda de contexto. Cinco cifras en fila obligan a
 * compararlas para deducir en qué punto está; una frase lo dice.
 */

export type Seguimiento = {
  appointment_id: string;
  empresa: string;
  starts_at: string;
  estado: string;
  convocados: number;
  con_hora: number;
  consintieron: number;
  respondiendo: number;
  enviadas: number;
  publicadas: number;
};

export function SeguimientoDeSesiones({
  sesiones,
  zona,
}: {
  sesiones: Seguimiento[];
  zona: string;
}) {
  if (sesiones.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-h3">Sesiones en marcha</h2>
        <p className="text-text-muted mt-1 text-sm">
          Las que ya aceptaste, y en qué punto está cada una.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {sesiones.map((s) => {
          const paso = siguientePaso(s);

          return (
            <li key={s.appointment_id}>
              <Link
                href={`/profesional/citas/${s.appointment_id}`}
                className="border-line bg-panel hover:border-accent ease-psi flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors duration-150"
              >
                <div className="min-w-0">
                  <p className="text-text-strong font-medium">{s.empresa}</p>
                  <p className="text-text-muted text-sm">
                    {capitalizar(fechaLarga(s.starts_at, zona))} ·{" "}
                    {hora(s.starts_at, zona)} · {s.convocados}{" "}
                    {s.convocados === 1 ? "persona" : "personas"}
                  </p>
                </div>

                <Badge tone={paso.tono}>{paso.texto}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Lo que falta, en una frase.
 *
 * Se mira en el orden en que bloquea: sin instrumento no hay nada que
 * consentir, sin consentimiento nadie puede empezar, y una prueba enviada
 * espera al profesional. Se nombra el PRIMER estorbo, no todos: enumerarlos
 * obliga a decidir cuál atender y esa decisión ya está tomada por el orden.
 */
function siguientePaso(s: Seguimiento): {
  texto: string;
  tono: "success" | "warning" | "neutral" | "accent";
} {
  const conEvaluacion =
    s.consintieron + s.respondiendo + s.enviadas + s.publicadas;

  if (conEvaluacion === 0 && s.enviadas === 0 && s.publicadas === 0) {
    // Nadie ha llegado a nada: o falta asignar, o falta que consientan.
    return { texto: "Falta asignar la evaluación", tono: "warning" };
  }

  if (s.enviadas > 0) {
    return {
      texto: `${s.enviadas} por revisar`,
      tono: "warning",
    };
  }

  if (s.con_hora < s.convocados) {
    return {
      texto: `${s.convocados - s.con_hora} sin hora`,
      tono: "warning",
    };
  }

  if (s.publicadas === s.convocados) {
    return { texto: "Informes listos", tono: "success" };
  }

  if (s.respondiendo > 0) {
    return { texto: `${s.respondiendo} respondiendo`, tono: "accent" };
  }

  const faltanConsentir = s.convocados - s.consintieron;
  if (faltanConsentir > 0) {
    return {
      texto: `${faltanConsentir} sin consentir`,
      tono: "neutral",
    };
  }

  return { texto: "Todo listo para el día", tono: "accent" };
}
