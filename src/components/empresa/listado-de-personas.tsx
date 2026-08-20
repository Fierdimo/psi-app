import { Users } from "lucide-react";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * El listado de personas, aparte de su página.
 *
 * Mismo motivo que el de sesiones: poder quedarse de fondo cuando el panel se
 * abre en directo, al recargar o al pegar la dirección.
 */
/**
 * El listado de personas a evaluar.
 *
 * «Personas» y no «personal»: buena parte de las evaluaciones son para
 * candidatos a un puesto, que no trabajan en la empresa y puede que nunca lo
 * hagan. Llamarles personal sería afirmar un vínculo laboral inexistente.
 *
 * La columna que importa es la última: si la persona ya tiene cuenta o sigue
 * pendiente de aceptar su invitación. Es lo que determina si podrá responder
 * el día de la sesión, y es la pregunta que trae aquí a quien administra.
 */
export async function ListadoDePersonas({
  avisos,
}: {
  /**
   * Los avisos de «se guardó» y «se retiró», que llegan por la dirección.
   *
   * Se reciben ya resueltos en vez de leer `searchParams` aquí: este listado
   * también se pinta de fondo bajo un panel, y ahí los parámetros de la
   * dirección son los del panel, no los suyos.
   */
  avisos?: { guardada?: string; retirada?: string };
}) {
  await exigirEmpresa();
  const { guardada, retirada } = avisos ?? {};
  const supabase = await crearClienteServidor();

  const { data: personas } = await supabase
    .from("organization_people")
    .select("id, documento, nombre, apellidos, email, cargo, vinculo")
    .order("nombre");

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Personas a evaluar"
        descripcion="Aspirantes a un puesto o gente que ya trabaja contigo. Se identifican por su documento y no por su correo: así se les reconoce aunque cambien de trabajo o de dirección."
      >
        {/*
          El formulario ya no vive dentro del listado.
          Un listado con un formulario encima deja de leerse de un vistazo, y
          es lo único que se viene a hacer aquí: mirar quién está y en qué
          estado. Cargar a alguien es un acto aparte y se abre como panel.
        */}
        <Link href="/empresa/personas/nueva" className={buttonVariants()}>
          <UserPlus aria-hidden="true" className="size-4" />
          Cargar persona
        </Link>
      </EncabezadoPagina>

      {guardada && (
        <Alert tone="success" title="Datos actualizados">
          Los cambios ya están en el listado.
        </Alert>
      )}
      {retirada && (
        <Alert tone="info" title="Persona retirada">
          Ya no aparece en tu listado ni se puede convocar.
        </Alert>
      )}

      {!personas || personas.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="Todavía no has cargado a nadie"
          descripcion="Podrás convocarlas a una sesión aunque todavía no tengan cuenta: la crean cuando reciben su invitación."
          enlace={{
            href: "/empresa/personas/nueva",
            texto: "Cargar la primera",
          }}
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
                  <span className="sr-only">Acciones</span>
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
                  <td className="px-4 py-3 text-right">
                    {/* Editar abre el mismo formulario del alta, como panel. */}
                    <Link
                      href={`/empresa/personas/${p.id}`}
                      className="text-accent-on-soft hover:text-accent text-sm font-medium"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-text-muted text-sm">
        La carga masiva desde un archivo todavía no está construida: por ahora
        se añaden de una en una. El sistema acepta la lista completa de golpe,
        así que si son muchas, pásasela al profesional.
      </p>
    </Pantalla>
  );
}
