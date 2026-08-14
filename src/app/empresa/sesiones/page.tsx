import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { fechaLarga, rangoHorario } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sesiones" };

/** Cómo se nombra cada estado ante la empresa, y con qué tono. */
const ESTADOS: Record<
  string,
  {
    texto: string;
    tone: "neutral" | "accent" | "success" | "warning" | "danger";
  }
> = {
  solicitada: { texto: "A la espera de confirmación", tone: "warning" },
  reprogramacion_solicitada: {
    texto: "Cambio de fecha pedido",
    tone: "warning",
  },
  confirmada: { texto: "Confirmada", tone: "accent" },
  realizada: { texto: "Realizada", tone: "success" },
  no_asistio: { texto: "Nadie asistió", tone: "danger" },
  cancelada: { texto: "Cancelada", tone: "neutral" },
  rechazada: { texto: "Rechazada", tone: "danger" },
};

export default async function SesionesPage() {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const { data: sesiones } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, patient_note")
    .order("starts_at", { ascending: false });

  const zona = perfil.timezone;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Sesiones de evaluación"
        descripcion="Una sesión reúne a varias personas de tu listado. La solicitas tú; el profesional la confirma cuando el trámite está resuelto."
      />

      {!sesiones || sesiones.length === 0 ? (
        <EstadoVacio
          icono={CalendarDays}
          titulo="Todavía no has solicitado ninguna sesión"
          descripcion="Carga primero a tu personal y después propone día y hora. La sesión no queda en firme hasta que el profesional la confirma, y él te contacta para resolver el trámite."
          proximamente
          enlace={{ href: "/empresa/personal", texto: "Ir a mi personal" }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sesiones.map((s) => {
            const estado = ESTADOS[s.status] ?? {
              texto: s.status,
              tone: "neutral" as const,
            };
            return (
              <li
                key={s.id}
                className="border-line bg-panel flex flex-wrap items-start justify-between gap-4 rounded-lg border p-5 shadow-xs"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-text-strong font-medium">
                    {fechaLarga(s.starts_at, zona)}
                  </p>
                  <p className="text-text-muted tabular text-sm">
                    {rangoHorario(s.starts_at, s.ends_at, zona)}
                  </p>
                  {s.patient_note && (
                    <p className="text-text-body max-w-[62ch] pt-1 text-sm">
                      {s.patient_note}
                    </p>
                  )}
                </div>
                <Badge tone={estado.tone}>{estado.texto}</Badge>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-text-muted text-sm">
        El formulario para solicitar una sesión desde aquí todavía no está
        construido. Mientras tanto, acuérdala con el profesional y él la agenda.
      </p>
    </Pantalla>
  );
}
