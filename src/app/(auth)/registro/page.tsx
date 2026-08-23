import type { Metadata } from "next";
import Link from "next/link";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioRegistro } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Crear cuenta de empresa" };

export default async function RegistroPage({
  searchParams,
}: PageProps<"/registro">) {
  const params = await searchParams;
  const siguiente =
    typeof params.siguiente === "string" ? params.siguiente : undefined;

  return (
    <ArmazonAuth
      titulo="Crear cuenta de empresa"
      /*
        Se dice para quién es, arriba y en el título.

        El alta pública es la de una organización que contrata evaluaciones, y
        la única: quien va a responder una prueba no crea ninguna cuenta —le
        llega un enlace— y el profesional tampoco se registra aquí. Sin decirlo,
        alguien rellena siete campos para descubrir al final que este no era su
        sitio.
      */
      descripcion="Para organizaciones que contratan evaluaciones. Te enviaremos un correo para confirmar que la dirección es tuya."
      pie={
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link
            href={
              siguiente
                ? `/ingresar?siguiente=${encodeURIComponent(siguiente)}`
                : "/ingresar"
            }
            className="text-accent font-medium"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <FormularioRegistro siguiente={siguiente} />
    </ArmazonAuth>
  );
}
