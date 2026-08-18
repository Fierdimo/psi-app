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

  const { data: personas } = await supabase
    .from("organization_people")
    .select("id, nombre, apellidos, documento, cargo, vinculo")
    .order("nombre");

  const fechaMinima = ahoraEn(perfil.timezone).plus({ days: 1 }).toISODate()!;

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
