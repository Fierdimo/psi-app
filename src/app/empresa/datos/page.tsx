import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Datos de la empresa" };

/** Una fila de la ficha. Etiqueta arriba, valor abajo, sin tabla. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-micro text-text-muted font-semibold tracking-[0.08em] uppercase">
        {etiqueta}
      </dt>
      <dd className="text-text-body">{valor?.trim() || "—"}</dd>
    </div>
  );
}

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

      <dl className="border-line bg-panel grid gap-6 rounded-lg border p-6 sm:grid-cols-2">
        <Dato etiqueta="Nombre" valor={org?.nombre ?? null} />
        <Dato etiqueta="NIT" valor={org?.nit ?? null} />
        <Dato
          etiqueta="Persona de contacto"
          valor={org?.contacto_nombre ?? null}
        />
        <Dato etiqueta="Correo" valor={org?.contacto_email ?? null} />
        <Dato etiqueta="Teléfono" valor={org?.contacto_telefono ?? null} />
      </dl>

      <p className="text-text-muted text-sm">
        Editar estos datos desde aquí todavía no está construido. Si algo cambió
        —sobre todo el teléfono o el correo—, avísale al profesional: es por
        donde te va a buscar.
      </p>
    </Pantalla>
  );
}
