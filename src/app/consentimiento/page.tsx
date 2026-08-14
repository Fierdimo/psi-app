import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { BotonAceptarConsentimiento } from "@/components/auth/boton-consentimiento";
import { Brand } from "@/components/marca/brand";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { CONSENTIMIENTO, SECCIONES_CONSENTIMIENTO } from "@/lib/consentimiento";
import { crearClienteServidor } from "@/lib/supabase/server";
import { inicioSegunRol } from "@/lib/auth/perfil";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Consentimiento informado" };

/**
 * Consentimiento informado bloqueante (SPEC.md §6.1).
 *
 * Pantalla propia, no una casilla al pie del registro. Es un requisito ético
 * de la práctica psicológica y, además, el momento donde más confianza se gana
 * o se pierde: alguien que va a entregar información sobre su salud mental
 * merece leer con calma qué se hace con ella.
 *
 * No hay botón de «rechazar» que lleve a ninguna parte útil, pero tampoco hay
 * trampa: quien no acepte simplemente cierra la sesión, y el enlace para
 * hacerlo está a la vista.
 */
export default async function ConsentimientoPage() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");

  // Quien no es paciente no está en posición de otorgarlo: el profesional lo
  // RECIBE, y una empresa no puede consentir por la persona a la que manda
  // evaluar. Se comprueba también aquí y no solo en el middleware, porque una
  // pantalla que solo se protege en el enrutado se queda expuesta el día que
  // alguien llega a ella por otro camino.
  if (perfil.role !== "paciente") redirect(inicioSegunRol(perfil.role));

  // Si ya lo aceptó, no tiene sentido volver a pedirlo.
  const supabase = await crearClienteServidor();
  const { data: yaAceptado } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", perfil.id)
    .eq("document_key", CONSENTIMIENTO.clave)
    .eq("version", CONSENTIMIENTO.version)
    .maybeSingle();

  if (yaAceptado) redirect(inicioSegunRol(perfil.role));

  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12"
    >
      <Brand size="md" />

      <header className="flex flex-col gap-3">
        <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
          <ShieldCheck aria-hidden="true" className="size-5.5" />
        </span>
        <h1 className="text-h1">Consentimiento informado</h1>
        <p className="text-text-body text-lg">
          Antes de empezar, lee cómo tratamos tu información. Es breve y está
          escrito para entenderse.
        </p>
      </header>

      <div className="border-line bg-panel flex flex-col gap-6 rounded-lg border p-6 sm:p-8">
        {SECCIONES_CONSENTIMIENTO.map((seccion) => (
          <section key={seccion.titulo} className="flex flex-col gap-1.5">
            <h2 className="text-h4">{seccion.titulo}</h2>
            <p className="text-text-body max-w-[68ch]">{seccion.cuerpo}</p>
          </section>
        ))}

        <p className="text-text-muted border-line text-micro tabular border-t pt-4">
          Versión {CONSENTIMIENTO.version}
        </p>
      </div>

      <BotonAceptarConsentimiento />
    </main>
  );
}
