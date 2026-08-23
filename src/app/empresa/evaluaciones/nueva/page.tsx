import { Wallet } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { FormularioEvaluacion } from "@/components/empresa/formulario-evaluacion";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Encargar una evaluación" };

/**
 * El formulario, aparte de su página.
 *
 * Lo reutiliza el modal interceptado, igual que hace el alta de personas.
 * Duplicarlo dejaría dos altas que se separan al primer arreglo que se aplique
 * solo a una, y esta es la pantalla que gasta el saldo de alguien.
 */
export async function ContenidoNuevaEvaluacion() {
  await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const [{ data: saldo }, { data: catalogo }] = await Promise.all([
    supabase.rpc("saldo_de_usos"),
    supabase
      .from("assessments")
      .select("clave, nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const disponibles = typeof saldo === "number" ? saldo : 0;

  const pruebas = (catalogo ?? []).map((a) => ({
    valor: a.clave,
    etiqueta: a.nombre,
  }));

  /*
   * Sin saldo NO se enseña el formulario.
   *
   * Enseñarlo con el botón apagado obliga a rellenar cuatro campos para
   * descubrir al final que no se puede. La pantalla dice lo que pasa y adónde
   * ir, que es lo único útil en ese momento.
   */
  if (disponibles < 1) {
    return (
      <EstadoVacio
        icono={Wallet}
        titulo="No te quedan usos"
        descripcion="Cada evaluación gasta uno. Solicita más y el profesional los autorizará en cuanto confirme el pago."
        enlace={{ href: "/empresa/usos", texto: "Ir a solicitar usos" }}
      />
    );
  }

  if (pruebas.length === 0) {
    return (
      <EstadoVacio
        icono={Wallet}
        titulo="No hay pruebas disponibles"
        descripcion="El catálogo está vacío ahora mismo. Escríbenos y lo resolvemos."
      />
    );
  }

  return <FormularioEvaluacion pruebas={pruebas} saldo={disponibles} />;
}

/**
 * La página completa: al recargar, al pegar la dirección o sin JavaScript.
 *
 * En la navegación normal se llega al modal, que es lo mismo con el listado
 * detrás.
 */
export default async function NuevaEvaluacionPage() {
  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Encargar una evaluación"
        descripcion="Nombre y correo. Le llega un enlace con su código QR, y el informe vuelve por correo en cuanto termine."
      >
        <Link
          href="/empresa/evaluaciones"
          className={buttonVariants({ variant: "ghost" })}
        >
          Volver
        </Link>
      </EncabezadoPagina>

      <ContenidoNuevaEvaluacion />
    </Pantalla>
  );
}
