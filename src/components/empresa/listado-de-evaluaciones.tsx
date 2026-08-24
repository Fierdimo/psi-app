import { ClipboardCheck, Printer, Search } from "lucide-react";
import Link from "next/link";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FiltroDeEvaluaciones } from "@/components/empresa/filtro-de-evaluaciones";
import { Paginacion } from "@/components/navegacion/paginacion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";
import {
  estadoParaLaEmpresa,
  estadosDeVista,
  VISTAS_EMPRESA,
  type VistaEvaluaciones,
} from "@/lib/evaluaciones/estados-empresa";
import { filtroDeBusqueda } from "@/lib/evaluaciones/busqueda";
import { fechaCorta } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Todo lo encargado, en una sola lista.
 *
 * ANTES ERAN DOS SECCIONES —«Evaluaciones» e «Informes»— y era la misma cosa
 * en dos momentos. Quien encargaba miraba en una para saber si ya habían
 * respondido y en la otra para leer el resultado, y las dos enseñaban las
 * mismas filas con distinto nombre: la lista de informes tenía que incluir las
 * no publicadas —o quien encargó veinte y ve cinco no sabe si las otras quince
 * se perdieron— y acababa siendo la lista de evaluaciones otra vez.
 *
 * Ahora hay una fila por encargo. Cuando está lista, se abre y el informe está
 * dentro; cuando no, se abre y dice en qué punto va.
 *
 * Vive aparte de su página para poder quedarse de fondo cuando el modal se
 * abre en directo, al recargar o al pegar la dirección.
 */

/**
 * Diez por página.
 *
 * Menos que las veinte de los listados anteriores, y a propósito: aquí cada
 * fila lleva cuatro columnas y se entra a leerlas, no a barrerlas. Con veinte
 * la paginación deja de usarse y se navega con la rueda, que es justo lo que
 * el buscador resuelve mejor.
 */
const POR_PAGINA = 10;

export async function ListadoDeEvaluaciones({
  pagina = 1,
  busqueda = "",
  vista = "todas",
}: {
  pagina?: number;
  /** Lo que se escribió en el buscador, ya recortado. */
  busqueda?: string;
  /** El grupo de estados elegido. */
  vista?: VistaEvaluaciones;
}) {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const desde = (pagina - 1) * POR_PAGINA;

  const filtroDeTexto = filtroDeBusqueda(busqueda);

  /*
   * `!inner` en la persona, y no es un detalle de sintaxis.
   *
   * Con la unión normal, filtrar por el nombre de la persona no descarta la
   * evaluación: devuelve la fila con la persona a nulo. Con `!inner`, filtrar
   * dentro filtra fuera, que es lo que un buscador tiene que hacer.
   */
  const contarEn = async (estados: string[]) => {
    let q = supabase
      .from("assignments")
      .select("id, persona:organization_people!inner(id)", {
        count: "exact",
        head: true,
      });

    if (estados.length > 0) q = q.in("status", estados);
    if (filtroDeTexto) q = q.or(filtroDeTexto, { referencedTable: "persona" });

    const { count } = await q;
    return count ?? 0;
  };

  /*
   * Las cuentas de los grupos van CON la búsqueda puesta.
   *
   * Sin eso, buscando «Zulema» aparecería «Sin responder 40» al lado de una
   * tabla con una fila, y a partir de ahí nadie se fía del número. Son
   * consultas de solo recuento —sin traer filas— y se lanzan a la vez.
   */
  const recuentos = await Promise.all(
    VISTAS_EMPRESA.map(
      async (v) => [v.clave, await contarEn(v.estados)] as const,
    ),
  );

  const cuentas = Object.fromEntries(recuentos) as Partial<
    Record<VistaEvaluaciones, number>
  >;

  let consulta = supabase
    .from("assignments")
    .select(
      "id, status, assigned_at, persona:organization_people!inner(nombre, apellidos, email, documento), prueba:assessments(nombre)",
      { count: "exact" },
    );

  const estados = estadosDeVista(vista);
  if (estados.length > 0) consulta = consulta.in("status", estados);
  if (filtroDeTexto)
    consulta = consulta.or(filtroDeTexto, { referencedTable: "persona" });

  const { data, count } = await consulta
    /*
     * De la más reciente a la más antigua, con desempate estable.
     *
     * Ordenar solo por la fecha deja los empates a criterio de Postgres, y con
     * `range` cada página se calcula en una consulta distinta: la misma fila
     * sale en la uno y en la dos, y otra no sale en ninguna. Ya pasó en el
     * listado de personas.
     */
    .order("assigned_at", { ascending: false })
    .order("id", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);

  const filas = data ?? [];
  const zona = perfil.timezone;

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const enlace = (n: number) => {
    const p = new URLSearchParams();
    // El grupo y la búsqueda viajan con la página, o pasar a la dos devuelve
    // la lista entera y sin filtrar.
    if (vista !== "todas") p.set("estado", vista);
    if (busqueda) p.set("q", busqueda);
    if (n > 1) p.set("pagina", String(n));
    const cadena = p.toString();
    return cadena ? `/empresa/evaluaciones?${cadena}` : "/empresa/evaluaciones";
  };

  /* La exportación se lleva los filtros puestos: saca lo que se está viendo,
     completo, no la página que se tenía delante. */
  const enlaceExportar = () => {
    const p = new URLSearchParams();
    if (vista !== "todas") p.set("estado", vista);
    if (busqueda) p.set("q", busqueda);
    const c = p.toString();
    return c
      ? `/empresa/evaluaciones/exportar?${c}`
      : "/empresa/evaluaciones/exportar";
  };

  const etiquetaVista =
    VISTAS_EMPRESA.find((v) => v.clave === vista)?.texto ?? "Todas";

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Evaluaciones"
        descripcion="Cada evaluación que has encargado. Cuando está lista, se abre y el informe está dentro."
      >
        <div className="flex flex-wrap gap-3">
          {/*
            En una pestaña nueva, y a propósito.

            La vista de impresión abre sola el diálogo del navegador; si se
            cancela, se cierra la pestaña y el listado sigue detrás con sus
            filtros como estaban. En la misma pestaña, cancelar dejaría a
            alguien plantado en una hoja pelada.
          */}
          {filas.length > 0 && (
            <a
              href={enlaceExportar()}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary" })}
            >
              <Printer aria-hidden="true" className="size-4" />
              Imprimir o PDF
            </a>
          )}

          <Link
            href="/empresa/evaluaciones/nueva"
            className={buttonVariants({ variant: "primary" })}
          >
            Encargar una evaluación
          </Link>
        </div>
      </EncabezadoPagina>

      <FiltroDeEvaluaciones
        vista={vista}
        busqueda={busqueda}
        cuentas={cuentas}
      />

      {filas.length === 0 ? (
        busqueda || vista !== "todas" ? (
          /*
            El vacío dice POR QUÉ está vacío.

            No es lo mismo «no hay ninguna» que «no hay ninguna con este filtro
            puesto»: lo segundo tiene arreglo desde aquí mismo, y el enlace es
            el arreglo.
          */
          <EstadoVacio
            icono={Search}
            titulo="Nada con estos filtros"
            descripcion={
              busqueda
                ? `No hay ninguna evaluación en «${etiquetaVista}» que coincida con «${busqueda}». Prueba con menos letras, o con el documento.`
                : `No tienes ninguna evaluación en «${etiquetaVista}».`
            }
            enlace={{ href: "/empresa/evaluaciones", texto: "Ver todas" }}
          />
        ) : (
          <EstadoVacio
            icono={ClipboardCheck}
            titulo="Todavía no has encargado ninguna"
            descripcion="Con saldo disponible, encargar una evaluación es un nombre y un correo: le llega su enlace y el informe aparece aquí cuando termine."
            enlace={{
              href: "/empresa/evaluaciones/nueva",
              texto: "Encargar la primera",
            }}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            Una tabla, no tarjetas.

            Son cuatro datos cortos por fila y lo que se hace con ellos es
            comparar: quién falta por responder, qué se encargó y cuándo. Una
            tarjeta por evaluación ocupa cuatro líneas y obliga a desplazarse
            para comparar dos.
          */}
          <div className="border-line bg-panel overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-line text-text-muted border-b text-sm">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Nombre
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Evaluación
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Fecha
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody className="divide-line divide-y">
                {filas.map((fila) => {
                  const persona = uno<{
                    nombre: string;
                    apellidos: string | null;
                    email: string;
                    documento: string | null;
                  }>(fila.persona);
                  const prueba = uno<{ nombre: string }>(fila.prueba);
                  const etiqueta = estadoParaLaEmpresa(fila.status);

                  const nombre =
                    [persona?.nombre, persona?.apellidos]
                      .filter(Boolean)
                      .join(" ") ||
                    persona?.email ||
                    "Sin nombre";

                  return (
                    <tr
                      key={fila.id}
                      className="hover:bg-accent-soft ease-psi transition-colors duration-150"
                    >
                      {/*
                        El enlace envuelve la primera celda y se estira sobre
                        toda la fila con `after`. Un `<tr>` no puede ser un
                        enlace, y poner uno por celda multiplicaría por cuatro
                        las paradas del tabulador para llegar al mismo sitio.
                      */}
                      <td className="relative px-4 py-3">
                        <Link
                          href={`/empresa/evaluaciones/${fila.id}`}
                          className="text-text-strong font-medium after:absolute after:inset-0 after:content-['']"
                        >
                          {nombre}
                        </Link>
                        <span className="text-text-muted block truncate text-sm">
                          {persona?.documento ?? persona?.email}
                        </span>
                      </td>
                      <td className="text-text-body px-4 py-3">
                        {prueba?.nombre}
                      </td>
                      <td className="text-text-muted tabular px-4 py-3">
                        {fechaCorta(fila.assigned_at, zona)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Paginacion
            pagina={pagina}
            total={count ?? filas.length}
            porPagina={POR_PAGINA}
            nombre="evaluaciones"
            enlace={enlace}
          />
        </div>
      )}
    </Pantalla>
  );
}
