import type { Metadata } from "next";

import { ListadoDeEvaluaciones } from "@/components/empresa/listado-de-evaluaciones";
import { esVistaEmpresa } from "@/lib/evaluaciones/estados-empresa";

export const metadata: Metadata = { title: "Evaluaciones" };

export default async function EvaluacionesEmpresaPage({
  searchParams,
}: PageProps<"/empresa/evaluaciones">) {
  const params = await searchParams;

  /*
   * Un `estado` que no existe se trata como «todas», no como un error.
   *
   * La dirección se comparte y se edita a mano; un 404 por una letra de más
   * en un parámetro de filtro es una respuesta desproporcionada a algo que se
   * arregla enseñando la lista entera.
   */
  const estado = params.estado;

  return (
    <ListadoDeEvaluaciones
      pagina={Math.max(1, Number(params.pagina ?? 1) || 1)}
      busqueda={String(params.q ?? "").trim()}
      vista={esVistaEmpresa(estado) ? estado : "todas"}
    />
  );
}
