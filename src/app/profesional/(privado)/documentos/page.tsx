import { FileText } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentosProfesionalPage() {
  await exigirProfesional();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Documentos"
        descripcion="Certificados e informes que emites, y a quién los liberaste."
      />
      <EstadoVacio
        icono={FileText}
        titulo="Todavía no hay documentos"
        descripcion="Aquí subirás los certificados que acompañan a un resultado publicado. Se liberan junto con el informe, nunca antes, y quedan disponibles para la persona y para la empresa que encargó la evaluación."
        proximamente
        enlace={{
          href: "/profesional/evaluaciones",
          texto: "Ver evaluaciones",
        }}
      />
    </Pantalla>
  );
}
