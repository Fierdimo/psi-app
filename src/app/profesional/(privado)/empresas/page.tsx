import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Empresas" };

/**
 * Las organizaciones cliente.
 *
 * La columna de contacto no es un adorno: entre que una empresa pide usos y tú
 * los autorizas hay un pago que ocurre fuera de la plataforma, y este es el
 * sitio donde encuentras por dónde hablarle.
 */
export default async function EmpresasPage() {
  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const { data: empresas } = await supabase
    .from("organizations")
    .select(
      "id, nombre, nit, contacto_nombre, contacto_email, contacto_telefono",
    )
    .order("nombre");

  /*
   * El libro entero, sumado aquí.
   *
   * Sustituye al recuento de `organization_people`, que contaba «personas a
   * evaluar» — un dato que dejó de significar nada cuando las fichas pasaron a
   * ser de un solo uso: con el modelo nuevo, cien evaluaciones son cien fichas
   * y ninguna de ellas es una persona en plantilla.
   *
   * Lo que sí dice algo de una empresa cliente son sus usos: cuántos le quedan
   * y cuántos ha gastado.
   */
  const { data: movimientos } = await supabase
    .from("ticket_ledger")
    .select("organization_id, kind, cantidad");

  const saldo = new Map<string, number>();
  const gastados = new Map<string, number>();

  for (const m of movimientos ?? []) {
    saldo.set(
      m.organization_id,
      (saldo.get(m.organization_id) ?? 0) + m.cantidad,
    );
    if (m.kind === "consumo") {
      gastados.set(
        m.organization_id,
        (gastados.get(m.organization_id) ?? 0) - m.cantidad,
      );
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Empresas"
        descripcion="Las organizaciones que contratan evaluaciones. Su canal de contacto es por donde se resuelve el pago antes de autorizar sus usos."
      />

      {!empresas || empresas.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo="Todavía no hay empresas"
          descripcion="Aparecerán aquí cuando una organización se registre. Desde su cuenta solicita usos —que tú autorizas al confirmar el pago— y con ellos encarga evaluaciones."
          enlace={{
            href: "/profesional/solicitudes",
            texto: "Ver las solicitudes",
          }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {empresas.map((e) => (
            <li
              key={e.id}
              className="border-line bg-panel flex flex-col gap-2 rounded-lg border p-6 shadow-xs"
            >
              <h2 className="text-h4">{e.nombre}</h2>
              {e.nit && (
                <p className="text-text-muted tabular text-sm">NIT {e.nit}</p>
              )}
              <dl className="mt-1 flex gap-6">
                <div className="flex flex-col">
                  <dt className="text-text-muted text-sm">Usos disponibles</dt>
                  <dd className="text-text-strong tabular text-lg font-semibold">
                    {saldo.get(e.id) ?? 0}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-muted text-sm">Ya consumidos</dt>
                  <dd className="text-text-body tabular text-lg">
                    {gastados.get(e.id) ?? 0}
                  </dd>
                </div>
              </dl>
              <div className="border-line mt-2 flex flex-col gap-1 border-t pt-3 text-sm">
                {e.contacto_nombre && (
                  <p className="text-text-body">{e.contacto_nombre}</p>
                )}
                {e.contacto_telefono && (
                  <a
                    href={`tel:${e.contacto_telefono}`}
                    className="text-accent tabular"
                  >
                    {e.contacto_telefono}
                  </a>
                )}
                {e.contacto_email && (
                  <a
                    href={`mailto:${e.contacto_email}`}
                    className="text-accent"
                  >
                    {e.contacto_email}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Pantalla>
  );
}
