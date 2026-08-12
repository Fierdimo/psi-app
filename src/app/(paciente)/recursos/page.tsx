import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";

export const metadata: Metadata = { title: "Recursos y tareas" };

export default function RecursosPage() {
  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Recursos y tareas"
        descripcion="Lecturas, ejercicios y registros que tu profesional te asigne entre sesiones."
      />
      <EstadoVacio
        icono={BookOpen}
        titulo="No tienes recursos asignados"
        descripcion="Cuando tu profesional te asigne material para trabajar entre sesiones, lo encontrarás aquí junto con las fechas en que conviene completarlo."
        proximamente
        enlace={{ href: "/panel", texto: "Volver al inicio" }}
      />
    </Pantalla>
  );
}
