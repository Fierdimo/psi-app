import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Evaluaciones" };

export default async function EvaluacionesPage() {
  await exigirProfesional();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Evaluaciones"
        descripcion="Los instrumentos que aplicas, a quién se los asignaste y los resultados a la espera de tu revisión."
      />
      <EstadoVacio
        icono={ClipboardList}
        titulo="El motor de evaluaciones está en construcción"
        descripcion="Aquí vivirán el catálogo de instrumentos, las asignaciones y la pantalla donde revisas cada resultado, escribes tu interpretación y decides publicarlo. Nada llega a la persona ni a su empresa hasta que tú lo firmes."
        proximamente
        enlace={{ href: "/profesional/agenda", texto: "Volver a la agenda" }}
      />
    </Pantalla>
  );
}
