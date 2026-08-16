import { CalendarPlus, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Controles } from "@/components/calendario/controles";
import { Leyenda } from "@/components/calendario/leyenda";
import { VistaAgenda } from "@/components/calendario/vista-agenda";
import { VistaMes } from "@/components/calendario/vista-mes";
import { VistaSemana } from "@/components/calendario/vista-semana";
import { Pantalla } from "@/components/navegacion/encabezado-pagina";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { exigirSesion } from "@/lib/auth/perfil";
import { ASPECTO, type Cita } from "@/lib/citas/estados";
import {
  ahoraEn,
  distanciaEnDias,
  esVista,
  etiquetaZonaActiva,
  fechaCorta,
  fechaDeReferencia,
  hora,
  intervaloDeVista,
  tituloDePeriodo,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendario" };

/**
 * Calendario del paciente (SPEC.md §7.4).
 *
 * La vista y la fecha viven en la URL, así que esta pantalla es un componente
 * de servidor sin estado de cliente: se consulta exactamente el rango que se
 * va a pintar y nada más.
 *
 * La vista por defecto depende del tamaño de pantalla, y eso no se puede saber
 * en el servidor. Se resuelve renderizando agenda y mes y ocultando una u otra
 * con CSS: en móvil manda la agenda, desde `sm` manda la retícula. Cuesta un
 * poco de HTML de más y evita un salto visual o una redirección con JavaScript.
 */
export default async function CalendarioPage({
  searchParams,
}: PageProps<"/calendario">) {
  const perfil = await exigirSesion();
  const params = await searchParams;
  const zona = perfil.timezone;

  const vistaParam =
    typeof params.vista === "string" ? params.vista : undefined;
  const vista = esVista(vistaParam) ? vistaParam : "mes";
  const referencia = fechaDeReferencia(
    typeof params.fecha === "string" ? params.fecha : undefined,
    zona,
  );

  const intervalo = intervaloDeVista(vista, referencia);
  const supabase = await crearClienteServidor();

  /*
   * RLS ya filtra por persona; el rango solo acota lo que se pinta.
   *
   * SE INCLUYEN LAS SESIONES DE EMPRESA a las que está convocada. Estaban
   * fuera —el filtro `organization_id is null` venía de impedir que una sesión
   * corporativa contara como «solicitud pendiente» suya y le bloqueara pedir
   * cita— pero eso apagó también el calendario: la persona tenía una sesión
   * con fecha, hora y dirección, y su calendario no la mencionaba.
   *
   * Donde el filtro SÍ debe seguir es en contar solicitudes pendientes, que es
   * otra cosa y está en otro sitio.
   */
  const [{ data: citasDelRango }, { data: proximas }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, organizacion:organizations(nombre)")
      .gte("starts_at", intervalo.start!.toUTC().toISO()!)
      .lte("starts_at", intervalo.end!.toUTC().toISO()!)
      .order("starts_at"),
    supabase
      .from("appointments")
      .select("*, organizacion:organizations(nombre)")
      .gte("starts_at", ahoraEn(zona).toUTC().toISO()!)
      .in("status", ["confirmada", "solicitada", "reprogramacion_solicitada"])
      .order("starts_at")
      .limit(4),
  ]);

  const citas = (citasDelRango ?? []) as Cita[];

  /*
   * Se distingue de una cita de terapia, y por su nombre.
   *
   * En el calendario de la persona conviven ahora dos cosas que se parecen —un
   * hueco con fecha y hora— y no lo son: a una va a que la atiendan, a la otra
   * la convocó una empresa para evaluarla. Verlas iguales invita a presentarse
   * al sitio equivocado.
   */
  const etiquetaDeCita = (cita: Cita) =>
    cita.organization_id !== null ? "Evaluación" : "";
  const siguientes = (proximas ?? []) as Cita[];

  // Para la agenda siempre se mira hacia delante, aunque se navegue por meses.
  const citasAgenda = citas.filter(
    (c) => c.starts_at >= ahoraEn(zona).startOf("day").toUTC().toISO()!,
  );

  return (
    <Pantalla>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1">Tu calendario</h1>
          <p className="text-text-muted flex items-center gap-1.5 text-sm">
            <Clock aria-hidden="true" className="size-3.5" />
            {etiquetaZonaActiva(zona)}
          </p>
        </div>

        <Link href="/solicitar-cita" className={buttonVariants({ size: "md" })}>
          <CalendarPlus aria-hidden="true" className="size-4" />
          Solicitar cita
        </Link>
      </header>

      {params.solicitada === "1" && (
        <Alert tone="success" title="Solicitud enviada">
          Tu profesional la revisará y te avisaremos por correo en cuanto la
          confirme. Hasta entonces aparece como «por confirmar».
        </Alert>
      )}
      {params.cancelada === "1" && (
        <Alert tone="info" title="Cita cancelada">
          Si necesitas otro horario puedes solicitar una cita nueva.
        </Alert>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Panel lateral: solo escritorio */}
        <aside className="hidden w-[240px] shrink-0 flex-col gap-6 lg:flex">
          <div className="flex flex-col gap-3">
            {/* h3, no h2: el título del periodo es el encabezado principal de
                la pantalla después del h1, y el panel lateral le está
                subordinado. */}
            <h3 className="text-text-muted text-micro font-semibold tracking-[0.08em] uppercase">
              Próximas
            </h3>
            {siguientes.length === 0 ? (
              <p className="text-text-muted text-sm">
                No tienes citas próximas.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {siguientes.map((cita) => (
                  <li key={cita.id}>
                    <Link
                      href={`/calendario/${cita.id}`}
                      className="border-line hover:border-accent hover:bg-accent-soft ease-psi flex flex-col gap-1 rounded-md border p-2.5 transition-colors duration-150"
                    >
                      <span className="text-text-strong tabular text-sm font-medium">
                        {fechaCorta(cita.starts_at, zona)} ·{" "}
                        {hora(cita.starts_at, zona)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={ASPECTO[cita.status].tono}>
                          {ASPECTO[cita.status].etiqueta}
                        </Badge>
                      </span>
                      <span className="text-text-muted text-micro">
                        {distanciaEnDias(cita.starts_at, zona)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Leyenda />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-h4" aria-live="polite">
              {tituloDePeriodo(vista, referencia)}
            </h2>
          </div>

          <Controles
            vista={vista}
            referencia={referencia}
            hoy={ahoraEn(zona)}
          />

          {vista === "agenda" && (
            <VistaAgenda
              citas={citasAgenda}
              zona={zona}
              etiquetaDeCita={etiquetaDeCita}
            />
          )}

          {vista === "mes" && (
            <>
              {/* Móvil: agenda. Escritorio: retícula. Ver la nota de arriba. */}
              <div className="sm:hidden">
                <VistaAgenda
                  citas={citasAgenda}
                  zona={zona}
                  etiquetaDeCita={etiquetaDeCita}
                />
              </div>
              <div className="hidden sm:block">
                <VistaMes
                  referencia={referencia}
                  citas={citas}
                  zona={zona}
                  etiquetaDeCita={etiquetaDeCita}
                />
              </div>
            </>
          )}

          {vista === "semana" && (
            <VistaSemana
              referencia={referencia}
              citas={citas}
              zona={zona}
              etiquetaDeCita={etiquetaDeCita}
            />
          )}

          {vista === "dia" && (
            <VistaSemana
              referencia={referencia}
              citas={citas}
              zona={zona}
              etiquetaDeCita={etiquetaDeCita}
              dias={1}
            />
          )}

          <div className="lg:hidden">
            <Leyenda />
          </div>
        </div>
      </div>
    </Pantalla>
  );
}
