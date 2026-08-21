import { Search, Users } from "lucide-react";

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
import { Paginacion } from "@/components/navegacion/paginacion";
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
/**
 * Cuántas personas por página.
 *
 * Es la lista que más filas acumula del área —una empresa carga cien de golpe
 * antes de una tanda— y la que peor aguanta sin tope: son cien filas de tabla
 * entre quien entra y el botón de cargar a alguien más.
 */
const POR_PAGINA = 20;

export async function ListadoDePersonas({
  avisos,
  pagina = 1,
  busqueda = "",
}: {
  pagina?: number;
  /** Lo que se escribió en el buscador, ya recortado. */
  busqueda?: string;
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

  const desde = (pagina - 1) * POR_PAGINA;

  let consulta = supabase
    .from("organization_people")
    .select("id, documento, nombre, apellidos, email, cargo, vinculo", {
      count: "exact",
    });

  if (busqueda) {
    /*
     * Se busca por lo que se recuerda de alguien.
     *
     * Quien busca en un listado de cien personas tiene en la cabeza un nombre
     * a medias, una cédula, o el puesto —«el conductor»—. Restringirlo al
     * nombre obliga a acertar con la ortografía de un apellido ajeno.
     */
    const patron = `%${busqueda}%`;
    consulta = consulta.or(
      [
        `nombre.ilike.${patron}`,
        `apellidos.ilike.${patron}`,
        `documento.ilike.${patron}`,
        `cargo.ilike.${patron}`,
        `email.ilike.${patron}`,
      ].join(","),
    );
  }

  const { data: personas, count } = await consulta
    /*
     * Un desempate estable, o las páginas se solapan.
     *
     * Ordenar solo por el nombre deja el orden de los empates a criterio de
     * Postgres, y con `range` cada página se calcula en una consulta distinta:
     * la misma fila puede salir en la uno y en la dos, y otra no salir en
     * ninguna. Con la base local eran 16 de 20 repetidas entre página y
     * página. El identificador no se repite nunca.
     */
    .order("nombre")
    .order("id")
    .range(desde, desde + POR_PAGINA - 1);

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

      {/*
        Un formulario `GET`, sin JavaScript.
        
        La búsqueda queda en la dirección, así que se puede recargar, guardar y
        volver atrás sin perderla — y el resultado se puede pasar por chat a
        quien pregunta por alguien.
      */}
      <form
        action="/empresa/personas"
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <label htmlFor="q" className="text-text-body text-sm font-medium">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder="Nombre, documento, cargo o correo"
            className="border-line-interactive bg-panel text-text-strong placeholder:text-text-muted focus-visible:outline-accent h-11 rounded-md border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>

        <button
          type="submit"
          className="border-line-interactive text-accent-on-soft hover:bg-accent-soft ease-psi inline-flex h-11 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors duration-150"
        >
          <Search aria-hidden="true" className="size-4" />
          Buscar
        </button>

        {busqueda && (
          <Link
            href="/empresa/personas"
            className="text-text-muted hover:text-text-body ease-psi self-center text-sm underline underline-offset-4 transition-colors duration-150"
          >
            Ver todas
          </Link>
        )}
      </form>

      {!personas || personas.length === 0 ? (
        busqueda ? (
          /* Buscar y no encontrar no es lo mismo que no tener a nadie: el
             estado vacío de «carga a tu primera persona» aquí desorienta. */
          <p className="text-text-muted text-sm">
            Nadie coincide con «{busqueda}».
          </p>
        ) : (
          <EstadoVacio
            icono={Users}
            titulo="Todavía no has cargado a nadie"
            descripcion="Podrás convocarlas a una sesión y recibirán su enlace para responder, tengan cuenta o no."
            enlace={{
              href: "/empresa/personas/nueva",
              texto: "Cargar la primera",
            }}
          />
        )
      ) : (
        <div className="border-line bg-panel overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Personal cargado</caption>
            <thead className="border-line bg-bg border-b">
              <tr className="text-text-muted text-left">
                {/*
                  El nombre va PRIMERO, porque es por donde se ordena.
                  
                  Con el documento delante, la primera columna no seguía ningún
                  orden visible y la lista parecía barajada. `aria-sort` lo dice
                  además para quien no ve la flecha.
                */}
                <th
                  scope="col"
                  aria-sort="ascending"
                  className="px-4 py-3 font-medium"
                >
                  Nombre ↑
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Documento
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
                  <td className="text-text-strong px-4 py-3 font-medium">
                    {[p.nombre, p.apellidos].filter(Boolean).join(" ")}
                  </td>
                  <td className="text-text-body tabular px-4 py-3">
                    {p.documento}
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

      <Paginacion
        pagina={pagina}
        total={count ?? 0}
        porPagina={POR_PAGINA}
        nombre="personas"
        enlace={(n) => {
          // La búsqueda viaja con la página: pasar a la dos no puede devolver
          // el listado entero.
          const params = new URLSearchParams();
          if (busqueda) params.set("q", busqueda);
          if (n > 1) params.set("pagina", String(n));
          const cola = params.toString();
          return `/empresa/personas${cola ? `?${cola}` : ""}`;
        }}
      />

      <p className="text-text-muted text-sm">
        La carga masiva desde un archivo todavía no está construida: por ahora
        se añaden de una en una. El sistema acepta la lista completa de golpe,
        así que si son muchas, pásasela al profesional.
      </p>
    </Pantalla>
  );
}
