import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Informes" };

export default async function InformesEmpresaPage() {
  await exigirEmpresa();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Informes"
        descripcion="Los resultados de las evaluaciones que encargaste, una vez el profesional los revise y los publique."
      />
      <EstadoVacio
        icono={ClipboardList}
        titulo="Todavía no hay informes"
        descripcion="Aparecerán aquí cuando el profesional revise los resultados y los publique. Nunca antes: una puntuación sin su lectura no informa, desinforma. Se publican a la vez para ti y para la persona evaluada."
        proximamente
        enlace={{ href: "/empresa/sesiones", texto: "Ver mis sesiones" }}
      />
    </Pantalla>
  );
}
