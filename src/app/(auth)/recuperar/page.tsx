import type { Metadata } from "next";
import Link from "next/link";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioRecuperar } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <ArmazonAuth
      titulo="Recuperar contraseña"
      descripcion="Escribe tu correo y te enviaremos un enlace para crear una nueva."
      pie={
        <p>
          <Link href="/ingresar" className="text-accent">
            Volver a entrar
          </Link>
        </p>
      }
    >
      <FormularioRecuperar />
    </ArmazonAuth>
  );
}
