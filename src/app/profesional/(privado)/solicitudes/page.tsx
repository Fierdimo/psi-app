import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import {
  BandejaUsos,
  type SolicitudDeUsos,
} from "@/components/profesional/bandeja-usos";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { fechaLarga } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Solicitudes",
  robots: { index: false, follow: false },
};

/**
 * Lo que espera una decisión.
 *
 * Antes eran solicitudes de cita: una empresa proponía una fecha y había que
 * aceptarla o moverla. Ahora son COMPRAS DE USOS, y la decisión es de otra
 * naturaleza: no se juzga si la fecha cabe, se comprueba si el pago entró.
 *
 * Es la única decisión que le queda al profesional en el circuito. La empresa
 * encarga sus evaluaciones sola contra el saldo y el informe sale sin firma;
 * autorizar aquí es la única forma de que entre saldo al sistema.
 */
export default async function SolicitudesPage() {
  const perfil = await exigirProfesional();
  const supabase = await crearClienteServidor();

  const [{ data: ordenes }, { data: movimientos }] = await Promise.all([
    supabase
      .from("ticket_orders")
      .select(
        "id, cantidad, nota, created_at, organization_id, organizacion:organizations(nombre, contacto_nombre, contacto_email, contacto_telefono)",
      )
      .eq("status", "solicitada")
      .order("created_at"),
    /*
     * El libro entero y la suma aquí, en vez de una llamada a `saldo_de_usos`
     * por solicitud. Con cinco empresas en la bandeja serían cinco viajes a la
     * base para pintar cinco números, y el libro son decenas de filas.
     */
    supabase.from("ticket_ledger").select("organization_id, cantidad"),
  ]);

  const saldos = new Map<string, number>();
  for (const m of movimientos ?? []) {
    saldos.set(
      m.organization_id,
      (saldos.get(m.organization_id) ?? 0) + m.cantidad,
    );
  }

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const solicitudes: SolicitudDeUsos[] = (ordenes ?? []).map((o) => {
    const empresa = uno<{
      nombre: string;
      contacto_nombre: string | null;
      contacto_email: string | null;
      contacto_telefono: string | null;
    }>(o.organizacion);

    return {
      id: o.id,
      cantidad: o.cantidad,
      nota: o.nota,
      pedida: `Pedida el ${fechaLarga(o.created_at, perfil.timezone)}`,
      empresa: empresa?.nombre ?? "Empresa sin nombre",
      contactoNombre: empresa?.contacto_nombre ?? null,
      contactoEmail: empresa?.contacto_email ?? null,
      contactoTelefono: empresa?.contacto_telefono ?? null,
      saldoActual: saldos.get(o.organization_id) ?? 0,
    };
  });

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Solicitudes"
        descripcion="Compras de usos que esperan tu respuesta. Autoriza cuando hayas comprobado el pago; el saldo no se retira después."
      />

      {solicitudes.length === 0 ? (
        <EstadoVacio
          icono={Inbox}
          titulo="No hay nada esperando"
          descripcion="Cuando una empresa solicite usos para sus evaluaciones, aparecerá aquí con su canal de contacto al lado."
          enlace={{ href: "/profesional/empresas", texto: "Ver las empresas" }}
        />
      ) : (
        <BandejaUsos solicitudes={solicitudes} />
      )}
    </Pantalla>
  );
}
