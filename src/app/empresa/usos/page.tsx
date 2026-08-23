import { Wallet } from "lucide-react";
import type { Metadata } from "next";

import { FormularioUsos } from "@/components/empresa/formulario-usos";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { fechaLarga } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usos" };

const ESTADO: Record<
  string,
  { texto: string; tono: "success" | "warning" | "danger" }
> = {
  solicitada: { texto: "Esperando", tono: "warning" },
  autorizada: { texto: "Autorizada", tono: "success" },
  rechazada: { texto: "Rechazada", tono: "danger" },
};

/**
 * El saldo y de dónde viene.
 *
 * Las dos cosas juntas y no en pantallas distintas: un número sin su historia
 * es el principio de la conversación «pagué cincuenta y me aparecen cuarenta y
 * tres». Aquí el saldo está arriba y debajo está cada compra con su estado, su
 * fecha y el motivo si se rechazó.
 */
export default async function UsosPage() {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const [{ data: saldo }, { data: ordenes }] = await Promise.all([
    supabase.rpc("saldo_de_usos"),
    supabase
      .from("ticket_orders")
      .select("id, cantidad, nota, status, motivo, created_at, resuelta_at")
      .order("created_at", { ascending: false }),
  ]);

  const disponibles = typeof saldo === "number" ? saldo : 0;
  const compras = ordenes ?? [];
  const pendiente = compras.some((o) => o.status === "solicitada");
  const zona = perfil.timezone;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Usos"
        descripcion="Un uso es una evaluación. Se compran por tandas, y el profesional los autoriza cuando confirma el pago."
      />

      <div className="border-line bg-panel flex flex-wrap items-center gap-6 rounded-lg border p-6">
        <span className="bg-accent-soft text-accent grid size-12 place-items-center rounded-md">
          <Wallet aria-hidden="true" className="size-6" />
        </span>
        <div className="flex flex-col">
          <span className="text-h1 tabular">{disponibles}</span>
          <span className="text-text-muted text-sm">
            {disponibles === 1 ? "uso disponible" : "usos disponibles"}
          </span>
        </div>
      </div>

      <FormularioUsos pendiente={pendiente} />

      <section className="flex flex-col gap-4">
        <h2 className="text-h4">Tus compras</h2>

        {compras.length === 0 ? (
          <EstadoVacio
            icono={Wallet}
            titulo="Todavía no has pedido usos"
            descripcion="Cuando lo hagas, cada solicitud aparecerá aquí con su estado: esperando, autorizada o rechazada."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {compras.map((compra) => {
              const etiqueta = ESTADO[compra.status];

              return (
                <li
                  key={compra.id}
                  className="border-line bg-panel flex flex-wrap items-start justify-between gap-4 rounded-lg border p-5"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-text-strong font-semibold">
                      {compra.cantidad} {compra.cantidad === 1 ? "uso" : "usos"}
                    </span>
                    {compra.nota && (
                      <span className="text-text-body text-sm">
                        {compra.nota}
                      </span>
                    )}
                    <span className="text-text-muted text-sm">
                      Pedida el {fechaLarga(compra.created_at, zona)}
                    </span>
                    {/* El motivo del rechazo se enseña entero. Es lo único que
                        permite corregir y volver a intentarlo. */}
                    {compra.status === "rechazada" && compra.motivo && (
                      <span className="text-danger-600 text-sm">
                        {compra.motivo}
                      </span>
                    )}
                  </div>

                  {etiqueta && (
                    <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Pantalla>
  );
}
