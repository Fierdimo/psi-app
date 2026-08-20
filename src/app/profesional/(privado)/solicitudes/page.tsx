import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { BandejaSolicitudes } from "@/components/profesional/bandeja-solicitudes";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  SeguimientoDeSesiones,
  type Seguimiento,
} from "@/components/profesional/seguimiento-de-sesiones";
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

  const [{ data }, { data: enMarcha }] = await Promise.all([
    supabase
      .from("appointments")
      .select(SELECT_DE_CITA)
      .in("status", ["solicitada", "reprogramacion_solicitada"])
      .order("starts_at"),
    supabase.rpc("seguimiento_de_sesiones"),
  ]);

  const solicitudes = (data ?? []) as unknown as CitaConPaciente[];
  const sesiones = (enMarcha ?? []) as Seguimiento[];

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Solicitudes"
        descripcion="Lo que espera tu respuesta, y cómo va lo que ya aceptaste."
      />

      {solicitudes.length === 0 && sesiones.length === 0 ? (
        <EstadoVacio
          icono={Inbox}
          titulo="No hay nada esperando"
          descripcion="Cuando una persona pida una cita o una empresa encargue una sesión de evaluación, aparecerá aquí."
          enlace={{ href: "/profesional/agenda", texto: "Ver la agenda" }}
        />
      ) : (
        <>
          {/*
            Lo que espera decisión va primero, y solo si lo hay.
            
            Un encabezado «Esperan tu respuesta» sobre una lista vacía es un
            hueco que se lee como un fallo.
          */}
          {solicitudes.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-h3">Esperan tu respuesta</h2>
                <p className="text-text-muted mt-1 text-sm">
                  Cada una se acepta o se rechaza entera.
                </p>
              </div>

              <BandejaSolicitudes
                solicitudes={solicitudes}
                zona={perfil.timezone}
                sinEncabezado
              />
            </section>
          )}

          <SeguimientoDeSesiones sesiones={sesiones} zona={perfil.timezone} />
        </>
      )}
    </Pantalla>
  );
}
