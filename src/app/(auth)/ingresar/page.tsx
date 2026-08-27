import type { Metadata } from "next";
import Link from "next/link";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioIngreso } from "@/components/auth/formularios";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Entrar" };

export default async function IngresarPage({
  searchParams,
}: PageProps<"/ingresar">) {
  const params = await searchParams;
  const siguiente =
    typeof params.siguiente === "string" ? params.siguiente : undefined;
  const enlaceInvalido = params.error === "enlace";

  return (
    <ArmazonAuth
      titulo="Entrar"
      /*
        Se dice para quién es esta puerta, igual que en el alta.

        Decía «para consultar tus citas», que ya no existen. Y quien más
        probablemente aterrice aquí por error es alguien convocado a una
        evaluación buscando dónde entrar: su enlace no lleva contraseña,
        así que se le dice aquí en vez de dejarle probar correos.
      */
      descripcion=""
      pie={
        <>
          <p>
            ¿Aún no tienes cuenta?{" "}
            <Link href="/registro" className="text-accent font-medium">
              Crear una cuenta
            </Link>
          </p>
          <p>
            <Link href="/recuperar" className="text-accent">
              Olvidé mi contraseña
            </Link>
          </p>
        </>
      }
    >
      {enlaceInvalido && (
        <Alert tone="warning" title="Ese enlace ya no sirve">
          Los enlaces por correo caducan y solo pueden usarse una vez. Solicita
          uno nuevo desde «Olvidé mi contraseña».
        </Alert>
      )}

      <FormularioIngreso siguiente={siguiente} />
    </ArmazonAuth>
  );
}
