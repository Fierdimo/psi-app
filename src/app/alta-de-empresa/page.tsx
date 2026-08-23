import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioAltaDeEmpresa } from "@/components/empresa/formulario-alta";
import { inicioSegunRol, obtenerPerfil } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Completa los datos de tu empresa" };

/**
 * La salida de un callejón que casi nunca se pisa.
 *
 * Desde la migración 0058 la organización nace con la cuenta, así que llegar
 * aquí significa que algo la creó por otra vía: la API de administración, un
 * registro sin datos de empresa. Sin esta pantalla esas cuentas quedarían
 * atrapadas —el área de empresa las rebota por no tener organización, y las
 * rebota hacia el área de empresa— y solo se saldría de ahí desde la base.
 */
export default async function AltaDeEmpresaPage() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");

  // Quien ya tiene empresa, o no administra ninguna, no pinta nada aquí.
  if (perfil.role !== "empresa" || perfil.organization_id) {
    redirect(inicioSegunRol(perfil.role));
  }

  return (
    <ArmazonAuth
      titulo="Completa los datos de tu empresa"
      descripcion="Tu cuenta existe pero no tiene una organización asociada. Con estos datos queda lista."
    >
      <FormularioAltaDeEmpresa />
    </ArmazonAuth>
  );
}
