import Link from "next/link";
import type { Metadata } from "next";

import { BotonImprimir } from "@/components/empresa/boton-imprimir";
import { buttonVariants } from "@/components/ui/button";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { filtroDeBusqueda } from "@/lib/evaluaciones/busqueda";
import {
  esVistaEmpresa,
  estadoParaLaEmpresa,
  estadosDeVista,
  VISTAS_EMPRESA,
} from "@/lib/evaluaciones/estados-empresa";
import { fechaCorta, fechaLarga } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Evaluaciones · para imprimir",
  // Fuera de los buscadores: lleva nombres y correos de personas evaluadas.
  robots: { index: false, follow: false },
};

/**
 * Cuántas filas caben en una exportación.
 *
 * No es un número de diseño: PostgREST corta en mil por defecto, y una tabla
 * que se corta sin avisar es peor que una que no se puede sacar. Se pide el
 * tope y, si se alcanza, la propia hoja lo dice para que nadie firme un
 * informe incompleto creyéndolo completo.
 */
const TOPE = 1000;

/**
 * El listado, para papel.
 *
 * SE EXPORTA LO FILTRADO Y COMPLETO, no la página que se estaba viendo. Son
 * las dos mitades de la misma decisión: quien exporta con «Informe listo»
 * puesto quiere esas y solo esas, y quien exporta sin filtros quiere las
 * trescientas, no las diez de la primera página.
 *
 * Por eso la hoja declara arriba qué filtros llevaba. Una tabla impresa que no
 * dice que estaba filtrada es un documento que engaña sin querer.
 */
export default async function ExportarEvaluacionesPage({
  searchParams,
}: PageProps<"/empresa/evaluaciones/exportar">) {
  const perfil = await exigirEmpresa();
  const params = await searchParams;

  const busqueda = String(params.q ?? "").trim();
  const vista = esVistaEmpresa(params.estado) ? params.estado : "todas";

  const supabase = await crearClienteServidor();

  const [{ data: organizacion }, consulta] = await Promise.all([
    supabase
      .from("organizations")
      .select("nombre")
      .eq("id", perfil.organization_id)
      .maybeSingle(),
    (async () => {
      let q = supabase
        .from("assignments")
        .select(
          "id, status, assigned_at, persona:organization_people!inner(nombre, apellidos, email, documento), prueba:assessments(nombre)",
          { count: "exact" },
        );

      const estados = estadosDeVista(vista);
      if (estados.length > 0) q = q.in("status", estados);

      const filtro = filtroDeBusqueda(busqueda);
      if (filtro) q = q.or(filtro, { referencedTable: "persona" });

      return q
        .order("assigned_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, TOPE - 1);
    })(),
  ]);

  const filas = consulta.data ?? [];
  const total = consulta.count ?? filas.length;
  const zona = perfil.timezone;

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const etiquetaVista =
    VISTAS_EMPRESA.find((v) => v.clave === vista)?.texto ?? "Todas";

  const volver = () => {
    const p = new URLSearchParams();
    if (vista !== "todas") p.set("estado", vista);
    if (busqueda) p.set("q", busqueda);
    const c = p.toString();
    return c ? `/empresa/evaluaciones?${c}` : "/empresa/evaluaciones";
  };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-6 py-8 print:max-w-none print:px-0 print:py-0">
      {/* Los controles no se imprimen: son cómo se llega al documento. */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <BotonImprimir />
        <Link href={volver()} className={buttonVariants({ variant: "ghost" })}>
          Volver al listado
        </Link>
      </div>

      <header className="border-line flex flex-col gap-1 border-b pb-4">
        <h1 className="text-h3">Evaluaciones</h1>
        <p className="text-text-body">{organizacion?.nombre}</p>
        {/*
          Los filtros, en el documento.

          Es lo que separa una tabla de un dato: sin esta línea, una hoja con
          doce filas parece «tenemos doce evaluaciones» cuando dice «tenemos
          doce con informe listo que se llaman algo parecido a Pérez».
        */}
        <p className="text-text-muted text-sm">
          {etiquetaVista}
          {busqueda ? ` · búsqueda: «${busqueda}»` : ""} ·{" "}
          {total === 1 ? "1 evaluación" : `${total} evaluaciones`} · generado el{" "}
          {fechaLarga(new Date().toISOString(), zona)}
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="text-text-body">
          No hay ninguna evaluación con estos filtros.
        </p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-line text-text-muted border-b">
              <th scope="col" className="py-2 pr-4 font-medium">
                Nombre
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Documento o correo
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Evaluación
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Fecha
              </th>
              <th scope="col" className="py-2 font-medium">
                Estado
              </th>
            </tr>
          </thead>

          <tbody>
            {filas.map((fila) => {
              const persona = uno<{
                nombre: string;
                apellidos: string | null;
                email: string;
                documento: string | null;
              }>(fila.persona);
              const prueba = uno<{ nombre: string }>(fila.prueba);

              return (
                /* `break-inside-avoid`: una fila partida entre dos páginas deja
                   el nombre arriba y su estado abajo. */
                <tr
                  key={fila.id}
                  className="border-line break-inside-avoid border-b"
                >
                  <td className="text-text-strong py-2 pr-4">
                    {[persona?.nombre, persona?.apellidos]
                      .filter(Boolean)
                      .join(" ") || "Sin nombre"}
                  </td>
                  <td className="text-text-body py-2 pr-4">
                    {persona?.documento ?? persona?.email}
                  </td>
                  <td className="text-text-body py-2 pr-4">{prueba?.nombre}</td>
                  <td className="text-text-body tabular py-2 pr-4">
                    {fechaCorta(fila.assigned_at, zona)}
                  </td>
                  <td className="text-text-body py-2">
                    {estadoParaLaEmpresa(fila.status).texto}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/*
        El aviso de recorte, si lo hubo.

        Una tabla que se corta en silencio es la peor forma de fallar aquí:
        quien la imprime la usa para decidir, y no tiene cómo saber que le
        faltan filas.
      */}
      {total > TOPE ? (
        <p className="text-text-muted border-line border-t pt-4 text-sm">
          Se listan las primeras {TOPE} de {total}. Afina la búsqueda o el
          estado para sacarlas todas.
        </p>
      ) : null}
    </div>
  );
}
