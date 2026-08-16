import { CalendarPlus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ASPECTO, MODALIDAD, type Cita } from "@/lib/citas/estados";
import {
  capitalizar,
  distanciaEnDias,
  enZona,
  fechaCompleta,
  rangoHorario,
} from "@/lib/fechas/formato";

/**
 * Vista de agenda: lista cronológica agrupada por día.
 *
 * Es la vista POR DEFECTO EN MÓVIL, y no por comodidad de implementación. Una
 * retícula mensual en 375 px de ancho es ilegible y sus chips se convierten en
 * objetivos de toque imposibles. Además responde directamente a la pregunta
 * que trae un paciente al entrar: «¿cuándo es lo próximo?».
 */
export function VistaAgenda({
  citas,
  zona,
  /**
   * Distingue una sesión de evaluación de una cita de atención.
   *
   * Se parecen —un hueco con fecha y hora— y no lo son: a una va a que la
   * atiendan, a la otra la convocó una empresa para evaluarla. Verlas iguales
   * invita a presentarse al sitio equivocado.
   */
  etiquetaDeCita,
}: {
  citas: Cita[];
  zona: string;
  etiquetaDeCita?: (cita: Cita) => string;
}) {
  if (citas.length === 0) {
    return (
      <EstadoVacio
        icono={CalendarPlus}
        titulo="No tienes citas programadas"
        descripcion="Cuando solicites una cita o tu profesional te asigne una, aparecerá aquí con su estado."
        enlace={{ href: "/calendario/solicitar", texto: "Solicitar una cita" }}
      />
    );
  }

  // Agrupación por día en la zona del perfil, no en la del servidor.
  const porDia = new Map<string, Cita[]>();
  for (const cita of citas) {
    const clave = enZona(cita.starts_at, zona).toISODate()!;
    porDia.set(clave, [...(porDia.get(clave) ?? []), cita]);
  }

  return (
    <ol className="flex flex-col gap-6">
      {[...porDia.entries()].map(([dia, delDia]) => {
        const fecha = enZona(delDia[0].starts_at, zona);
        return (
          <li key={dia} className="flex flex-col gap-2">
            <h3 className="text-text-muted flex items-baseline gap-2 text-sm font-semibold">
              <span className="text-text-strong">
                {capitalizar(fecha.toFormat("cccc d 'de' LLLL"))}
              </span>
              <span className="font-normal">
                {distanciaEnDias(delDia[0].starts_at, zona)}
              </span>
            </h3>

            <ul className="border-line divide-line bg-panel divide-y rounded-lg border">
              {delDia.map((cita) => {
                const aspecto = ASPECTO[cita.status];
                return (
                  <li key={cita.id}>
                    <Link
                      href={`/calendario/${cita.id}`}
                      /* Etiqueta completa, igual que en el chip del calendario:
                         la fecha vive en el encabezado del grupo, y quien
                         navega saltando de enlace en enlace nunca la oye. */
                      aria-label={[
                        etiquetaDeCita?.(cita)
                          ? `${etiquetaDeCita(cita)} ${aspecto.descripcion.toLowerCase()}`
                          : `Cita ${aspecto.descripcion.toLowerCase()}`,
                        fechaCompleta(cita.starts_at, zona),
                        rangoHorario(cita.starts_at, cita.ends_at, zona),
                        MODALIDAD[cita.modality],
                      ].join(", ")}
                      className="hover:bg-accent-soft ease-psi flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150"
                    >
                      <span className="text-text-strong tabular w-[112px] font-medium">
                        {rangoHorario(cita.starts_at, cita.ends_at, zona)}
                      </span>
                      <span className="text-text-body flex-1 text-sm">
                        {MODALIDAD[cita.modality]}
                        {cita.location && ` · ${cita.location}`}
                      </span>
                      {etiquetaDeCita?.(cita) ? (
                        <Badge tone="neutral">{etiquetaDeCita(cita)}</Badge>
                      ) : null}
                      <Badge tone={aspecto.tono}>{aspecto.etiqueta}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
