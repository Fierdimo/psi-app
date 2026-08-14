import type { Metadata } from "next";
import Link from "next/link";

import { TarjetaProximaCita } from "@/components/calendario/tarjeta-proxima-cita";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { SECCIONES } from "@/components/navegacion/secciones";
import { Badge } from "@/components/ui/badge";
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

  const [{ data: proximas }, { data: pendientes }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .is("organization_id", null)
      .gte("starts_at", ahoraISO)
      .in("status", ["confirmada", "solicitada", "reprogramacion_solicitada"])
      .order("starts_at")
      .limit(1),
    supabase
      .from("appointments")
      .select("*")
      .is("organization_id", null)
      .in("status", ["solicitada", "reprogramacion_solicitada"])
      .order("starts_at"),
  ]);

  const proxima = ((proximas ?? []) as Cita[])[0] ?? null;
  const enEspera = (pendientes ?? []) as Cita[];
  const accesos = SECCIONES.filter((s) => s.href !== "/panel");

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo={`Hola, ${perfil.nombre ?? "bienvenido"}`}
        descripcion="Este es tu espacio privado. Solo tú y tu profesional pueden ver lo que hay aquí."
      />

      <TarjetaProximaCita cita={proxima} zona={zona} />

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
          {accesos.map(({ href, etiqueta, icono: Icono, placeholder }) => (
            <li key={href}>
              <Link
                href={href}
                className="border-line bg-panel hover:border-accent hover:bg-accent-soft ease-psi flex h-full items-start gap-3 rounded-lg border p-4 transition-colors duration-150"
              >
                <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-md">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-text-strong font-medium">
                    {etiqueta}
                  </span>
                  <span className="text-text-muted text-micro">
                    {placeholder ? "Próximamente" : "Disponible"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Pantalla>
  );
}
