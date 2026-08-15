import { redirect } from "next/navigation";

import { ArmazonPrivado } from "@/components/navegacion/armazon-privado";
import { obtenerPerfil } from "@/lib/auth/perfil";

/**
 * Las evaluaciones se ven con el mismo armazón que el resto de la aplicación.
 *
 * Vive fuera de `(paciente)` porque allí `exigirSesion()` reclama el
 * consentimiento de ATENCIÓN, y quien responde una prueba que encargó una
 * empresa no está en tratamiento con nadie (`SPEC.md` §9.2).
 *
 * Pero separarla por permisos le costó el aspecto: la persona entraba a su
 * prueba y se quedaba sin cabecera y sin navegación, con la aplicación
 * desapareciendo a su alrededor. Aquí solo se exige la sesión.
 */
export default async function LayoutEvaluacion({
  children,
}: LayoutProps<"/evaluacion">) {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar?siguiente=/evaluacion");

  return (
    <ArmazonPrivado nombre={perfil.nombre ?? "Tu espacio"}>
      {children}
    </ArmazonPrivado>
  );
}
