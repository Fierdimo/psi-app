import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";

import { TarjetaProximaCita } from "@/components/calendario/tarjeta-proxima-cita";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { SECCIONES } from "@/components/navegacion/secciones";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { exigirSesion } from "@/lib/auth/perfil";
import { ASPECTO, MODALIDAD, type Cita } from "@/lib/citas/estados";
import {
  ahoraEn,
  capitalizar,
  distanciaEnDias,
  fechaLarga,
  hora,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Panel de inicio del paciente (SPEC.md §7.3).
 *
 * Orden deliberado: primero la próxima cita, que es lo que la persona viene a
 * ver; después lo que está esperando respuesta; y al final el mapa de
 * secciones, que en móvil es además la única forma de llegar a las que no
 * caben en la barra inferior.
 */
export default async function PanelPage() {
  const perfil = await exigirSesion();
  const zona = perfil.timezone;
  const supabase = await crearClienteServidor();
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;

  const [{ data: proximas }, { data: pendientes }, { data: evaluaciones }] =
    await Promise.all([
      /*
       * También la sesión que encargó una empresa.
       *
       * El filtro `organization_id is null` estaba aquí por la misma razón que
       * en el calendario —que una sesión corporativa no contara como solicitud
       * pendiente suya— y aquí apagaba lo mismo: la persona tenía una sesión
       * con fecha y dirección y su pantalla de inicio no la mencionaba. Se
       * arregló el calendario y se olvidó el panel, que es donde se aterriza.
       *
       * Y se piden varias, no una: con una cita de terapia el sábado y una
       * evaluación el martes, la segunda no existía en esta pantalla.
       */
      supabase
        .from("appointments")
        .select("*, organizacion:organizations(nombre)")
        .gte("starts_at", ahoraISO)
        .in("status", ["confirmada", "solicitada", "reprogramacion_solicitada"])
        .order("starts_at")
        .limit(4),
      supabase
        .from("appointments")
        .select("*")
        .is("organization_id", null)
        .in("status", ["solicitada", "reprogramacion_solicitada"])
        .order("starts_at"),
      /*
       * Las evaluaciones que esperan a la persona.
       *
       * Van ARRIBA del todo y no en el mapa de secciones: es lo único de esta
       * pantalla donde alguien está esperando por ella, y hasta ahora no
       * aparecía en ningún sitio —la prueba se asignaba y la persona no tenía
       * cómo llegar—.
       */
      supabase
        .from("assignments")
        .select("id, status, assessment:assessments(nombre)")
        .in("status", ["asignada", "en_curso"])
        .order("assigned_at"),
    ]);

  const siguientes = (proximas ?? []) as Cita[];
  const proxima = siguientes[0] ?? null;

  /*
   * Lo que viene DESPUÉS de la próxima.
   *
   * La tarjeta destacada enseña una sola cita, así que con una cita de terapia
   * el martes y una sesión de evaluación el viernes, la segunda no existía en
   * esta pantalla. Se veía en el calendario y no aquí, que es donde se
   * aterriza.
   */
  const despues = siguientes.slice(1);
  const enEspera = (pendientes ?? []) as Cita[];
  const accesos = SECCIONES.filter((s) => s.href !== "/panel");

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo={`Hola, ${perfil.nombre ?? "bienvenido"}`}
        descripcion="Este es tu espacio privado. Solo tú y tu profesional pueden ver lo que hay aquí."
      >
        {/*
          Pedir cita, arriba y a la vista.

          Es la razón por la que la mayoría entra, y estaba escondida una
          pantalla más adentro: había que ir a «Calendario» y buscarla allí.
          Aquí es lo primero que se ve al aterrizar.
        */}
        <Link href="/solicitar-cita" className={buttonVariants()}>
          <CalendarPlus aria-hidden="true" className="size-4" />
          Solicitar cita
        </Link>
      </EncabezadoPagina>

      {(evaluaciones ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">Tienes una evaluación pendiente</h2>
          <ul className="border-line divide-line bg-panel divide-y rounded-lg border">
            {(evaluaciones ?? []).map((e) => {
              const prueba = Array.isArray(e.assessment)
                ? e.assessment[0]
                : e.assessment;

              return (
                <li key={e.id}>
                  <Link
                    href={`/evaluacion/${e.id}`}
                    className="hover:bg-accent-soft ease-psi flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150"
                  >
                    <span className="text-text-strong flex-1 font-medium">
                      {prueba?.nombre ?? "Evaluación"}
                    </span>
                    <Badge tone="warning">
                      {e.status === "en_curso" ? "A medias" : "Sin empezar"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <TarjetaProximaCita cita={proxima} zona={zona} />

      {despues.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">Después</h2>
          <ul className="border-line divide-line bg-panel divide-y rounded-lg border">
            {despues.map((cita) => (
              <li key={cita.id}>
                <Link
                  href={`/calendario/${cita.id}`}
                  className="hover:bg-accent-soft ease-psi flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150"
                >
                  <span className="text-text-strong tabular font-medium">
                    {capitalizar(fechaLarga(cita.starts_at, zona))} ·{" "}
                    {hora(cita.starts_at, zona)}
                  </span>
                  <span className="text-text-muted flex-1 text-sm">
                    {cita.organization_id
                      ? "Sesión de evaluación"
                      : MODALIDAD[cita.modality]}
                    {" · "}
                    {distanciaEnDias(cita.starts_at, zona)}
                  </span>
                  <Badge tone={ASPECTO[cita.status].tono}>
                    {ASPECTO[cita.status].etiqueta}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {enEspera.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">Esperando respuesta</h2>
          <ul className="border-line divide-line bg-panel divide-y rounded-lg border">
            {enEspera.map((cita) => (
              <li key={cita.id}>
                <Link
                  href={`/calendario/${cita.id}`}
                  className="hover:bg-accent-soft ease-psi flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150"
                >
                  <span className="text-text-strong tabular font-medium">
                    {capitalizar(fechaLarga(cita.starts_at, zona))} ·{" "}
                    {hora(cita.starts_at, zona)}
                  </span>
                  <span className="text-text-muted flex-1 text-sm">
                    {MODALIDAD[cita.modality]} ·{" "}
                    {distanciaEnDias(cita.starts_at, zona)}
                  </span>
                  <Badge tone={ASPECTO[cita.status].tono}>
                    {ASPECTO[cita.status].etiqueta}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-h3">Tus secciones</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map(({ href, etiqueta, icono: Icono }) => (
            <li key={href}>
              <Link
                href={href}
                className="border-line bg-panel hover:border-accent hover:bg-accent-soft ease-psi flex h-full items-start gap-3 rounded-lg border p-4 transition-colors duration-150"
              >
                <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-md">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                {/*
                  Sin el «Disponible / Próximamente» de debajo.
                  
                  Servía para distinguir lo construido de lo que no, y ya no hay
                  nada sin construir en el menú: todas las tarjetas decían
                  «Disponible», que es ruido repetido tantas veces como
                  secciones haya.
                */}
                <span className="text-text-strong font-medium">{etiqueta}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Pantalla>
  );
}
