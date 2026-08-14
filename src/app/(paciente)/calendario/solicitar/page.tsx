import type { Metadata } from "next";
import Link from "next/link";

import { FormularioSolicitud } from "@/components/calendario/formulario-solicitud";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { exigirSesion } from "@/lib/auth/perfil";
import {
  HORA_FIN_JORNADA,
  HORA_INICIO_JORNADA,
  ahoraEn,
  etiquetaZonaActiva,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solicitar cita" };

/** Horas ofrecidas, en pasos de 30 minutos dentro de la jornada. */
function horasDisponibles() {
  const horas: string[] = [];
  for (let h = HORA_INICIO_JORNADA; h < HORA_FIN_JORNADA; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
    horas.push(`${String(h).padStart(2, "0")}:30`);
  }
  return horas;
}

export default async function SolicitarCitaPage() {
  const perfil = await exigirSesion();
  const supabase = await crearClienteServidor();

  const { data: parametros } = await supabase
    .from("clinic_settings")
    .select("min_notice_hours, default_duration_minutes, cancellation_policy")
    .single();

  const margen = parametros?.min_notice_hours ?? 24;
  const duracion = parametros?.default_duration_minutes ?? 60;

  // La fecha mínima se calcula en la zona del paciente: en otra zona, «mañana»
  // puede ser un día distinto.
  const fechaMinima = ahoraEn(perfil.timezone)
    .plus({ hours: margen })
    .toISODate()!;

  // Ya tener una solicitud pendiente impide crear otra (índice parcial en la
  // base). Se avisa antes de que rellene el formulario, no después de enviarlo.
  const { data: pendiente } = await supabase
    /*
     * `organization_id is null` no es un filtro de más.
     *
     * Desde que existen las sesiones de evaluación, RLS le deja ver a esta
     * persona también las citas a las que su empresa la convocó. Sin acotar,
     * una sesión corporativa en estado «solicitada» hacía creer a la
     * plataforma que ya tenía una solicitud propia pendiente, y le bloqueaba
     * pedir cita — por algo que ni siquiera pidió ella.
     *
     * Regla general: en el área del paciente, «mis citas» son las que no
     * tienen organización detrás.
     */
    .from("appointments")
    .select("id")
    .is("organization_id", null)
    .in("status", ["solicitada", "reprogramacion_solicitada"])
    .maybeSingle();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Solicitar una cita"
        descripcion="Propón un día y una hora. Tu profesional confirmará si le encaja."
      />

      <div className="max-w-[640px]">
        {pendiente ? (
          <Alert tone="info" title="Ya tienes una solicitud pendiente">
            Espera a que tu profesional responda antes de pedir otra. Puedes{" "}
            <Link
              href={`/calendario/${pendiente.id}`}
              className="font-medium underline"
            >
              ver o retirar la solicitud
            </Link>
            .
          </Alert>
        ) : (
          <Card className="flex flex-col gap-6">
            <p className="text-text-muted text-sm">
              Las horas se muestran en tu zona horaria: {""}
              {etiquetaZonaActiva(perfil.timezone)}.
            </p>

            <FormularioSolicitud
              fechaMinima={fechaMinima}
              horas={horasDisponibles()}
              margenHoras={margen}
              duracionMinutos={duracion}
            />
          </Card>
        )}
      </div>
    </Pantalla>
  );
}
