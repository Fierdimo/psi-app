import type { Metadata } from "next";

import { ListadoDePersonas } from "@/components/empresa/listado-de-personas";

export const metadata: Metadata = { title: "Personas" };

export default async function PersonasPage({
  searchParams,
}: PageProps<"/empresa/personas">) {
  return <ListadoDePersonas avisos={await searchParams} />;
}
