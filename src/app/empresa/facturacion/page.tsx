import { Receipt } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Facturación" };

export default async function FacturacionPage() {
  await exigirEmpresa();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Facturación"
        descripcion="El historial de lo contratado y sus comprobantes."
      />
      <EstadoVacio
        icono={Receipt}
        titulo="El pago se acuerda fuera de la plataforma"
        descripcion="Hoy el trámite se resuelve directamente con el profesional por el canal de contacto que registraste, y él confirma la sesión cuando está listo. Aquí vivirá el historial de lo contratado y sus comprobantes."
        proximamente
        enlace={{ href: "/empresa/datos", texto: "Ver mi canal de contacto" }}
      />
    </Pantalla>
  );
}
