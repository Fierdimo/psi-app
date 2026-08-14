import { CalendarDays, ClipboardList, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { buttonVariants } from "@/components/ui/button";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { fechaLarga, rangoHorario } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del área de la empresa.
 *
 * Responde a las tres preguntas con las que se entra: ¿cuándo es lo próximo?,
 * ¿a quién tengo cargado?, ¿hay algo esperándome? Nada más — un panel que
 * intenta decirlo todo no dice nada.
 */
export default async function InicioEmpresaPage() {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const [{ data: proximas }, { count: personas }, { data: pendientes }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status")
        .eq("status", "confirmada")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1),
      supabase
        .from("organization_people")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("id, starts_at")
        .in("status", ["solicitada", "reprogramacion_solicitada"])
        .order("starts_at"),
    ]);

  const proxima = proximas?.[0];
  const zona = perfil.timezone;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Tu espacio de empresa"
        descripcion="Desde aquí gestionas a quién evaluar, cuándo, y consultas los informes cuando el profesional los publique."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6 shadow-xs">
          <span className="bg-accent-soft text-accent grid size-10 place-items-center rounded-md">
            <CalendarDays aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-h4">Próxima sesión</h2>
          {proxima ? (
            <p className="text-text-body">
              {fechaLarga(proxima.starts_at, zona)}
              <br />
              <span className="tabular">
                {rangoHorario(proxima.starts_at, proxima.ends_at, zona)}
              </span>
            </p>
          ) : (
            <p className="text-text-muted">
              No hay ninguna sesión confirmada todavía.
            </p>
          )}
        </article>

        <article className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6 shadow-xs">
          <span className="bg-accent-soft text-accent grid size-10 place-items-center rounded-md">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-h4">Personas cargadas</h2>
          <p className="text-text-body">
            <span className="text-h2 tabular">{personas ?? 0}</span>
            <br />
            {personas === 1 ? "persona a evaluar" : "personas a evaluar"}
          </p>
        </article>

        <article className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6 shadow-xs">
          <span className="bg-accent-soft text-accent grid size-10 place-items-center rounded-md">
            <ClipboardList aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-h4">A la espera</h2>
          {pendientes && pendientes.length > 0 ? (
            <p className="text-text-body">
              <span className="text-h2 tabular">{pendientes.length}</span>
              <br />
              {pendientes.length === 1
                ? "solicitud pendiente de confirmar"
                : "solicitudes pendientes de confirmar"}
            </p>
          ) : (
            <p className="text-text-muted">Ninguna solicitud pendiente.</p>
          )}
        </article>
      </div>

      {/* Una solicitud no se confirma sola: el pago y el trámite ocurren fuera
          de la plataforma, y decirlo aquí evita que la espera parezca un fallo. */}
      {pendientes && pendientes.length > 0 && (
        <p className="border-accent-soft-border bg-accent-soft text-accent-on-soft rounded-lg border p-4 text-sm">
          Las solicitudes se confirman una vez resuelto el trámite con el
          profesional. Él se comunica por el canal de contacto que registraste.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/empresa/personas"
          className={buttonVariants({ variant: "secondary" })}
        >
          <UserPlus aria-hidden="true" className="size-4" />
          Cargar personas
        </Link>
        <Link href="/empresa/sesiones" className={buttonVariants()}>
          Solicitar una sesión
        </Link>
      </div>
    </Pantalla>
  );
}
