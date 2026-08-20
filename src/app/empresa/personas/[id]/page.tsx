import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioPersona } from "@/components/empresa/formulario-persona";
import { ListadoDePersonas } from "@/components/empresa/listado-de-personas";
import { PaginaConPanel } from "@/components/navegacion/pagina-con-panel";
import { QuitarPersona } from "@/components/empresa/quitar-persona";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar persona" };

/**
 * Edición de una persona del listado.
 *
 * Reutiliza el mismo formulario que el alta: dos formularios para los mismos
 * campos se separan al primer cambio que se aplique solo a uno.
 */
export async function ContenidoDePersona({
  params,
}: PageProps<"/empresa/personas/[id]">) {
  await exigirEmpresa();
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data: persona } = await supabase
    .from("organization_people")
    .select(
      /*
       * Sin `profile_id`: esa columna ya no se concede a las cuentas.
       *
       * Pedirla no daba un error visible —la consulta fallaba, la ficha salía
       * vacía y la pantalla respondía «no existe»— así que el panel de editar
       * dejó de abrirse sin decir por qué. El formulario tampoco la usa ya.
       */
      "id, nombre, apellidos, email, documento, cargo, vinculo",
    )
    .eq("id", id)
    .maybeSingle();

  if (!persona) notFound();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo={[persona.nombre, persona.apellidos].filter(Boolean).join(" ")}
        descripcion="Corrige sus datos o retírala del listado."
      />
      <FormularioPersona persona={persona} />

      <div className="border-line border-t pt-5">
        <QuitarPersona persona={persona.id} />
      </div>
    </Pantalla>
  );
}

/** Abierta en directo, con el listado detrás. */
export default async function PersonaPage(
  props: PageProps<"/empresa/personas/[id]">,
) {
  return (
    <PaginaConPanel
      fondo={<ListadoDePersonas />}
      titulo="Editar persona"
      volverA="/empresa/personas"
    >
      <ContenidoDePersona {...props} />
    </PaginaConPanel>
  );
}
