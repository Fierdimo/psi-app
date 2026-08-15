import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { BandejaSolicitudes } from "@/components/profesional/bandeja-solicitudes";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { SELECT_DE_CITA, type CitaConPaciente } from "@/lib/citas/estados";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Solicitudes",
  robots: { index: false, follow: false },
};

/**
 * Lo que espera una decisión, en su propia pantalla.
 *
 * Estaba dentro de la agenda, debajo del calendario. Confirmar la solicitud de
 * una empresa obligaba a entrar a una pantalla que va de otra cosa —el mes— y
 * buscar ahí abajo: es la acción más frecuente del día y estaba a dos saltos.
 *
 * Sigue apareciendo en la agenda además de aquí. No es duplicar por descuido:
 * quien abre la agenda por la mañana tiene que ver lo que le espera sin
 * cambiar de sitio, y quien viene a decidir no tiene por qué pasar por el
 * calendario.
 */
export default async function SolicitudesPage() {
  const perfil = await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("appointments")
    .select(SELECT_DE_CITA)
    .in("status", ["solicitada", "reprogramacion_solicitada"])
    .order("starts_at");

  const solicitudes = (data ?? []) as unknown as CitaConPaciente[];

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Solicitudes"
        descripcion="Las citas y sesiones que esperan tu confirmación. Cada una se acepta o se rechaza entera."
      />

      {solicitudes.length === 0 ? (
        <EstadoVacio
          icono={Inbox}
          titulo="No hay nada esperando"
          descripcion="Cuando una persona pida una cita o una empresa encargue una sesión de evaluación, aparecerá aquí."
          enlace={{ href: "/profesional/agenda", texto: "Ver la agenda" }}
        />
      ) : (
        <BandejaSolicitudes
          solicitudes={solicitudes}
          zona={perfil.timezone}
          sinEncabezado
        />
      )}
    </Pantalla>
  );
}
