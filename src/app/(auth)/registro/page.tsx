import type { Metadata } from "next";
import Link from "next/link";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioRegistro } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <ArmazonAuth
      titulo="Crear cuenta"
      descripcion="Te enviaremos un correo para confirmar que la dirección es tuya."
      pie={
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link href="/ingresar" className="text-accent font-medium">
            Entrar
          </Link>
        </p>
      }
    >
      <FormularioRegistro />
    </ArmazonAuth>
  );
}
