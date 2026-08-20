import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioHorario } from "@/components/profesional/formulario-horario";
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
    .select(
      "min_notice_hours, default_duration_minutes, cancellation_policy, jornada_inicio, jornada_fin, pausa_inicio, pausa_fin, dias_laborables",
    )
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
          valor={
            (ajustes?.min_notice_hours ?? 0) > 0
              ? `${ajustes?.min_notice_hours} horas`
              : "Sin margen: se puede pedir para hoy"
          }
          explicacion={
            (ajustes?.min_notice_hours ?? 0) > 0
              ? "Una solicitud con menos margen se rechaza en la base, no en el formulario."
              : "Se puede agendar hasta el último momento. Lo único que sigue cerrado es el pasado: nadie puede pedir una cita para una hora que ya ocurrió."
          }
        />
        <Ajuste
          etiqueta="Duración de cada cita"
          valor={`${ajustes?.default_duration_minutes ?? 60} minutos`}
          explicacion="El tamaño de bloque de tu agenda. De aquí sale cuánta gente cabe en un día, y ya no lo decide quien pide la cita."
        />
      </dl>

      {/*
        El horario, editable.

        Antes esta pantalla solo miraba, y decía que para cambiar algo había que
        abrir la base de datos. Con la duración pasando a ser decisión del
        profesional —y no de quien pide— eso dejó de ser un inconveniente y pasó
        a ser un bloqueo: sin esta pantalla no hay forma de declarar la jornada.
      */}
      <section className="border-line bg-panel flex flex-col gap-4 rounded-lg border p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4">Tu jornada</h2>
          <p className="text-text-muted max-w-[62ch] text-sm">
            De aquí salen las franjas que se pueden agendar. Quien pide una cita
            elige una de ellas; ya no escribe la hora y la duración que quiera.
          </p>
        </div>

        <FormularioHorario
          horario={{
            jornada_inicio: ajustes?.jornada_inicio ?? "08:00",
            jornada_fin: ajustes?.jornada_fin ?? "17:00",
            default_duration_minutes: ajustes?.default_duration_minutes ?? 60,
            pausa_inicio: ajustes?.pausa_inicio ?? null,
            pausa_fin: ajustes?.pausa_fin ?? null,
            dias_laborables: ajustes?.dias_laborables ?? [1, 2, 3, 4, 5],
          }}
        />
      </section>

      <div className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6">
        <h2 className="text-h4">Política de cancelación</h2>
        <p className="text-text-body max-w-[62ch]">
          {ajustes?.cancellation_policy?.trim() ||
            "Todavía sin definir. Mientras no exista, la plataforma no muestra ninguna condición al cancelar, que es preferible a inventar una."}
        </p>
      </div>
    </Pantalla>
  );
}
