import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { ahoraEn, fechaCorta, hora } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pacientes",
  robots: { index: false, follow: false },
};

type Fila = {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
};

export default async function PacientesPage() {
  const perfil = await exigirProfesional();
  const zona = perfil.timezone;
  const supabase = await crearClienteServidor();

  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;

  const [{ data: pacientes }, { data: proximas }, { data: eliminaciones }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nombre, apellidos, telefono")
        .eq("role", "paciente")
        .order("apellidos"),
      supabase
        .from("appointments")
        .select("patient_id, starts_at, status")
        .gte("starts_at", ahoraISO)
        .in("status", ["confirmada", "solicitada", "reprogramacion_solicitada"])
        .order("starts_at"),
      supabase
        .from("account_deletion_requests")
        .select("user_id")
        .eq("status", "solicitada"),
    ]);

  // Primera cita futura de cada paciente. La consulta viene ordenada, así que
  // basta con quedarse con la primera de cada uno.
  const proxima = new Map<string, { starts_at: string; status: string }>();
  for (const cita of proximas ?? []) {
    if (!proxima.has(cita.patient_id)) proxima.set(cita.patient_id, cita);
  }

  const pidenBaja = new Set((eliminaciones ?? []).map((e) => e.user_id));
  const filas = (pacientes ?? []) as Fila[];

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1">Pacientes</h1>
        <p className="text-text-muted text-sm">
          {filas.length} {filas.length === 1 ? "persona" : "personas"} con
          cuenta en la plataforma.
        </p>
      </header>

      {filas.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="Todavía no hay pacientes"
          descripcion="Cuando alguien cree su cuenta aparecerá en esta lista y podrás agendarle citas."
        />
      ) : (
        <div className="border-line overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-line bg-sunken border-b">
                {["Paciente", "Teléfono", "Próxima cita", ""].map((h, i) => (
                  <th
                    key={i}
                    className="text-text-muted text-micro px-4 py-2.5 text-left font-semibold tracking-[0.08em] uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((paciente) => {
                const cita = proxima.get(paciente.id);
                const nombre =
                  [paciente.nombre, paciente.apellidos]
                    .filter(Boolean)
                    .join(" ") || "Sin nombre";

                return (
                  <tr
                    key={paciente.id}
                    className="border-line border-b last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/profesional/pacientes/${paciente.id}`}
                          className="text-text-strong hover:text-accent font-medium"
                        >
                          {nombre}
                        </Link>
                        {/* Una baja pendiente es un trámite con plazos: no
                            puede quedar enterrada en una pantalla aparte. */}
                        {pidenBaja.has(paciente.id) && (
                          <Badge tone="warning">Pidió eliminar su cuenta</Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-text-body tabular px-4 py-3">
                      {paciente.telefono ?? "—"}
                    </td>
                    <td className="text-text-body tabular px-4 py-3">
                      {cita
                        ? `${fechaCorta(cita.starts_at, zona)} · ${hora(cita.starts_at, zona)}`
                        : "—"}
                      {cita && cita.status !== "confirmada" && (
                        <span className="text-warning-700 text-micro ml-2">
                          por confirmar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/profesional/pacientes/${paciente.id}`}
                        className="text-accent text-sm font-medium"
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
