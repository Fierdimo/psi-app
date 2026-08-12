import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { CONSENTIMIENTO } from "@/lib/consentimiento";
import { exigirSesion } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documentos" };

/**
 * Placeholder con una excepción: el consentimiento firmado SÍ existe ya, y
 * ocultarlo sería absurdo. Es además el documento que más razones hay para
 * poder consultar en cualquier momento.
 */
export default async function DocumentosPage() {
  const perfil = await exigirSesion();
  const supabase = await crearClienteServidor();

  const { data: consentimiento } = await supabase
    .from("consents")
    .select("version, accepted_at")
    .eq("user_id", perfil.id)
    .eq("document_key", CONSENTIMIENTO.clave)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Documentos"
        descripcion="Tus consentimientos firmados, políticas de la consulta y comprobantes."
      />

      {consentimiento && (
        <ul className="border-line divide-line bg-panel divide-y rounded-lg border">
          <li className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-text-strong font-medium">
                Consentimiento informado
              </span>
              <span className="text-text-muted text-sm">
                Versión {consentimiento.version} · aceptado el{" "}
                <time dateTime={consentimiento.accepted_at}>
                  {new Date(consentimiento.accepted_at).toLocaleDateString(
                    "es",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </time>
              </span>
            </div>
            <Link
              href="/consentimiento-informado"
              className="text-accent text-sm font-medium"
            >
              Ver documento
            </Link>
          </li>
        </ul>
      )}

      <EstadoVacio
        icono={FileText}
        titulo="Aquí irán tus demás documentos"
        descripcion="Comprobantes, informes y cualquier documento que tu profesional comparta contigo quedarán guardados en esta sección."
        proximamente
      />
    </Pantalla>
  );
}
