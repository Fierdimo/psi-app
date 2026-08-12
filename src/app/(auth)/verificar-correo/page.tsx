import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ArmazonAuth } from "@/components/auth/armazon-auth";

export const metadata: Metadata = { title: "Confirma tu correo" };

export default function VerificarCorreoPage() {
  return (
    <ArmazonAuth
      titulo="Confirma tu correo"
      pie={
        <p>
          <Link href="/ingresar" className="text-accent">
            Volver a entrar
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-4">
        <span className="bg-accent-soft text-accent grid size-12 place-items-center rounded-full">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>

        <p className="text-text-body">
          Te enviamos un enlace de confirmación. Ábrelo desde este mismo
          dispositivo para entrar a tu espacio.
        </p>

        <p className="text-text-muted text-sm">
          Si no aparece en unos minutos, revisa la carpeta de correo no deseado.
          El enlace caduca y solo puede usarse una vez.
        </p>
      </div>
    </ArmazonAuth>
  );
}
