import type { Metadata } from "next";

import { ListadoDePersonas } from "@/components/empresa/listado-de-personas";

export const metadata: Metadata = { title: "Personas" };

export default async function PersonasPage({
  searchParams,
}: PageProps<"/empresa/personas">) {
  const params = await searchParams;

  return (
    <ListadoDePersonas
      avisos={params}
      pagina={Math.max(1, Number(params.pagina ?? 1) || 1)}
      busqueda={String(params.q ?? "").trim()}
    />
  );
}
