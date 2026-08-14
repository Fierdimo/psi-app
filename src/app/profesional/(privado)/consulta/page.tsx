import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "La consulta" };

function Ajuste({
  etiqueta,
  valor,
  explicacion,
}: {
  etiqueta: string;
  valor: string;
  explicacion: string;
}) {
  return (
    <div className="border-line bg-panel flex flex-col gap-1 rounded-lg border p-6">
      <dt className="text-micro text-text-muted font-semibold tracking-[0.08em] uppercase">
        {etiqueta}
      </dt>
      <dd className="text-h3 text-text-strong tabular">{valor}</dd>
      <p className="text-text-muted max-w-[46ch] pt-1 text-sm">{explicacion}</p>
    </div>
  );
}

/**
 * Las reglas con las que opera la agenda.
 *
 * Se muestran aunque todavía no se editen: son el motivo por el que una
 * solicitud se rechaza por «poca anticipación», y quien atiende necesita poder
 * comprobar cuál es el número sin abrir la base de datos.
 */
export default async function ConsultaPage() {
  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { data: ajustes } = await supabase
    .from("clinic_settings")
    .select("min_notice_hours, default_duration_minutes, cancellation_policy")
    .maybeSingle();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="La consulta"
        descripcion="Las reglas con las que opera tu agenda. Se aplican a las solicitudes de pacientes y de empresas por igual."
      />

      <dl className="grid gap-4 sm:grid-cols-2">
        <Ajuste
          etiqueta="Anticipación mínima"
          valor={`${ajustes?.min_notice_hours ?? 24} horas`}
          explicacion="Una solicitud con menos margen se rechaza en la base, no en el formulario. Es lo que impide que te agenden para dentro de diez minutos."
        />
        <Ajuste
          etiqueta="Duración por defecto"
          valor={`${ajustes?.default_duration_minutes ?? 60} minutos`}
          explicacion="Lo que se propone al agendar. Una sesión de evaluación grupal suele necesitar más y se ajusta al crearla."
        />
      </dl>

      <div className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6">
        <h2 className="text-h4">Política de cancelación</h2>
        <p className="text-text-body max-w-[62ch]">
          {ajustes?.cancellation_policy?.trim() ||
            "Todavía sin definir. Mientras no exista, la plataforma no muestra ninguna condición al cancelar, que es preferible a inventar una."}
        </p>
      </div>

      <p className="text-text-muted text-sm">
        Editar estos valores desde aquí todavía no está construido: hoy se
        cambian en la base. Se muestran porque son la explicación de por qué una
        solicitud se rechaza, y eso no debería obligarte a abrir Studio.
      </p>
    </Pantalla>
  );
}
