import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";

export const metadata: Metadata = { title: "Mis sesiones" };

export default function SesionesPage() {
  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Mis sesiones"
        descripcion="El historial de tus sesiones y el material que tu profesional comparta contigo."
      />
      <EstadoVacio
        icono={NotebookPen}
        titulo="Aún no hay sesiones registradas"
        descripcion="Verás la fecha y modalidad de cada sesión realizada, junto con lo que tu profesional decida compartir. Las notas clínicas no se publican aquí: están protegidas por el secreto profesional."
        proximamente
        enlace={{ href: "/calendario", texto: "Ver mi calendario" }}
      />
    </Pantalla>
  );
}
