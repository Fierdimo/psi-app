import type { Metadata } from "next";

import { ListadoDeSesiones } from "@/components/empresa/listado-de-sesiones";

export const metadata: Metadata = { title: "Sesiones" };

export default async function SesionesPage() {
  return <ListadoDeSesiones />;
}
