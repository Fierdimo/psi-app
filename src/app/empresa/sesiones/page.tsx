import type { Metadata } from "next";

import { ListadoDeSesiones } from "@/components/empresa/listado-de-sesiones";

export const metadata: Metadata = { title: "Sesiones" };

export default async function SesionesPage({
  searchParams,
}: PageProps<"/empresa/sesiones">) {
  const { pagina } = await searchParams;

  return <ListadoDeSesiones pagina={Math.max(1, Number(pagina ?? 1) || 1)} />;
}
