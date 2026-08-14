import { Users } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Personal" };

/**
 * El listado de personas de la empresa.
 *
 * La columna que importa es la última: si la persona ya tiene cuenta o sigue
 * pendiente de aceptar su invitación. Es lo que determina si podrá responder
 * el día de la sesión, y es la pregunta que trae aquí a quien administra.
 */
export default async function PersonalPage() {
  await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const { data: personas } = await supabase
    .from("organization_people")
    .select("id, documento, nombre, apellidos, email, cargo, profile_id")
    .order("nombre");

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Personal"
        descripcion="Las personas que quieres evaluar. Se identifican por su documento, no por su correo: así se les reconoce aunque cambien de trabajo o de dirección."
      />

      {!personas || personas.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="Todavía no has cargado a nadie"
          descripcion="Carga a las personas que quieras evaluar con su documento y su correo. Podrás convocarlas a una sesión aunque todavía no tengan cuenta: la crean cuando reciben su invitación."
          proximamente
        />
      ) : (
        <div className="border-line bg-panel overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Personal cargado</caption>
            <thead className="border-line bg-bg border-b">
              <tr className="text-text-muted text-left">
                <th scope="col" className="px-4 py-3 font-medium">
                  Documento
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Cargo
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Correo
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Cuenta
                </th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.id} className="border-line border-b last:border-0">
                  <td className="text-text-body tabular px-4 py-3">
                    {p.documento}
                  </td>
                  <td className="text-text-strong px-4 py-3 font-medium">
                    {[p.nombre, p.apellidos].filter(Boolean).join(" ")}
                  </td>
                  <td className="text-text-muted px-4 py-3">
                    {p.cargo ?? "—"}
                  </td>
                  <td className="text-text-muted px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">
                    {p.profile_id ? (
                      <Badge tone="success">Activa</Badge>
                    ) : (
                      <Badge tone="neutral">Sin aceptar</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-text-muted text-sm">
        La carga masiva desde un archivo todavía no está construida. Mientras
        tanto, el profesional puede cargar tu listado por ti.
      </p>
    </Pantalla>
  );
}
