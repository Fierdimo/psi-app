import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioEmpresa } from "@/components/empresa/formulario-empresa";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Datos de la empresa" };

/**
 * La ficha de la empresa, editable.
 *
 * Era de solo lectura: se rellenaba al registrarse y no se volvía a tocar. El
 * contacto es lo que más se queda viejo —cambia quien lleva el tema, cambia el
 * correo— y es justo por donde el profesional resuelve el trámite antes de
 * confirmar una sesión. Una dirección obsoleta detiene el circuito entero sin
 * que nadie sepa por qué.
 */
export default async function DatosEmpresaPage() {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const { data: org } = await supabase
    .from("organizations")
    .select("nombre, nit, contacto_nombre, contacto_email, contacto_telefono")
    .eq("id", perfil.organization_id)
    .maybeSingle();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Datos de la empresa"
        descripcion="Por este canal te contacta el profesional para resolver el trámite antes de confirmar una sesión."
      />

      <FormularioEmpresa
        empresa={{
          nombre: org?.nombre ?? "",
          nit: org?.nit ?? null,
          contacto_nombre: org?.contacto_nombre ?? null,
          contacto_email: org?.contacto_email ?? null,
          contacto_telefono: org?.contacto_telefono ?? null,
        }}
      />
    </Pantalla>
  );
}
