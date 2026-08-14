import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Empresas" };

/**
 * Las organizaciones cliente.
 *
 * La columna de contacto no es un adorno: entre que una empresa solicita y tú
 * confirmas hay un trámite que ocurre fuera de la plataforma, y este es el
 * sitio donde encuentras por dónde hablarle.
 */
export default async function EmpresasPage() {
  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { data: empresas } = await supabase
    .from("organizations")
    .select(
      "id, nombre, nit, contacto_nombre, contacto_email, contacto_telefono",
    )
    .order("nombre");

  const { data: personas } = await supabase
    .from("organization_people")
    .select("organization_id");

  const cuantas = new Map<string, number>();
  for (const p of personas ?? []) {
    cuantas.set(p.organization_id, (cuantas.get(p.organization_id) ?? 0) + 1);
  }

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Empresas"
        descripcion="Las organizaciones que contratan evaluaciones. Su canal de contacto es por donde se resuelve el trámite antes de confirmar una sesión."
      />

      {!empresas || empresas.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo="Todavía no hay empresas"
          descripcion="Aparecerán aquí cuando una organización se registre. Desde su cuenta carga a las personas que quiere evaluar —aspirantes o empleados— y solicita sesiones, que llegan a tu bandeja como cualquier otra solicitud."
          proximamente
          enlace={{ href: "/profesional/agenda", texto: "Ver la agenda" }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {empresas.map((e) => (
            <li
              key={e.id}
              className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6 shadow-xs"
            >
              <h2 className="text-h4">{e.nombre}</h2>
              {e.nit && (
                <p className="text-text-muted tabular text-sm">NIT {e.nit}</p>
              )}
              <p className="text-text-body text-sm">
                {cuantas.get(e.id) ?? 0}{" "}
                {cuantas.get(e.id) === 1
                  ? "persona a evaluar"
                  : "personas a evaluar"}
              </p>
              <div className="border-line mt-2 flex flex-col gap-1 border-t pt-3 text-sm">
                {e.contacto_nombre && (
                  <p className="text-text-body">{e.contacto_nombre}</p>
                )}
                {e.contacto_telefono && (
                  <a
                    href={`tel:${e.contacto_telefono}`}
                    className="text-accent tabular"
                  >
                    {e.contacto_telefono}
                  </a>
                )}
                {e.contacto_email && (
                  <a
                    href={`mailto:${e.contacto_email}`}
                    className="text-accent"
                  >
                    {e.contacto_email}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Pantalla>
  );
}
