import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioSesion } from "@/components/empresa/formulario-sesion";
import { ListadoDeSesiones } from "@/components/empresa/listado-de-sesiones";
import { PaginaConPanel } from "@/components/navegacion/pagina-con-panel";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { ahoraEn } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solicitar una sesión" };

export async function ContenidoNuevaSesion() {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const [{ data: personas }, { data: ajustes }] = await Promise.all([
    supabase
      .from("organization_people")
      .select("id, nombre, apellidos, documento, cargo, vinculo")
      .order("nombre"),
    supabase.from("clinic_settings").select("min_notice_hours").maybeSingle(),
  ]);

  /*
   * La antelación mínima la fija la consulta, no esta pantalla.
   *
   * Aquí estaba escrito «mañana» a pelo, así que aunque el ajuste dijera cero
   * el calendario seguía sin dejar elegir hoy. Una regla que vive en dos
   * sitios es una regla que un día dirá dos cosas distintas, y la que gana es
   * la que el usuario ve.
   */
  const margen = ajustes?.min_notice_hours ?? 0;
  const fechaMinima = ahoraEn(perfil.timezone)
    .plus({ hours: margen })
    .toISODate()!;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Solicitar una sesión"
        descripcion="Elige la fecha y a quién convocas. El profesional la confirma cuando el trámite esté resuelto."
      />
      <FormularioSesion personas={personas ?? []} fechaMinima={fechaMinima} />
    </Pantalla>
  );
}

/** Abierta en directo, con el listado detrás. */
export default async function NuevaSesionPage() {
  return (
    <PaginaConPanel
      fondo={<ListadoDeSesiones />}
      titulo="Solicitar una sesión"
      volverA="/empresa/sesiones"
    >
      <ContenidoNuevaSesion />
    </PaginaConPanel>
  );
}
