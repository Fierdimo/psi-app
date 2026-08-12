import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

/**
 * Agenda mínima de F1. La bandeja de solicitudes con confirmar/rechazar y las
 * vistas de calendario llegan en F5.
 *
 * Ya lee citas reales a propósito: sirve para comprobar en vivo que RLS
 * distingue de verdad entre roles. Un paciente que llegara a esta consulta
 * vería solo las suyas; el profesional las ve todas.
 */
export default async function AgendaPage() {
  await exigirProfesional();

  const supabase = await crearClienteServidor();
  const { data: citas } = await supabase
    .from("appointments")
    .select("id, starts_at, status, modality, patient_id")
    .order("starts_at", { ascending: true })
    .limit(20);

  const pendientes =
    citas?.filter((c) =>
      ["solicitada", "reprogramacion_solicitada"].includes(c.status),
    ) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">Agenda</h1>
        <p className="text-text-body">
          {pendientes.length > 0
            ? `Solicitudes pendientes de confirmar: ${pendientes.length}`
            : "No hay solicitudes pendientes."}
        </p>
      </header>

      <Alert tone="info" title="Vista preliminar">
        El calendario y las acciones de confirmar, reprogramar y rechazar llegan
        en la siguiente fase. Esta lista existe para verificar que el acceso por
        rol funciona contra datos reales.
      </Alert>

      <Card className="flex flex-col gap-3">
        <h2 className="text-h4">Próximas citas ({citas?.length ?? 0})</h2>
        <ul className="flex flex-col">
          {citas?.map((cita) => (
            <li
              key={cita.id}
              className="border-line flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
            >
              <time
                dateTime={cita.starts_at}
                className="text-text-strong text-sm"
              >
                {new Date(cita.starts_at).toLocaleString("es", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </time>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">{cita.modality}</span>
                <Badge
                  tone={
                    cita.status === "confirmada"
                      ? "success"
                      : cita.status === "solicitada"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {cita.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
