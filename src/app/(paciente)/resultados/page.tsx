import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";

export const metadata: Metadata = { title: "Resultados" };

export default function ResultadosPage() {
  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Resultados de evaluaciones"
        descripcion="Las evaluaciones que tu profesional te asigne y sus resultados."
      />
      <EstadoVacio
        icono={ClipboardList}
        titulo="Todavía no hay evaluaciones"
        descripcion="Aquí aparecerán las evaluaciones que tu profesional te asigne. Los resultados se comparten una vez revisados con él, porque una puntuación sin interpretación puede confundir más que ayudar."
        proximamente
        enlace={{ href: "/calendario", texto: "Ver mi calendario" }}
      />
    </Pantalla>
  );
}
