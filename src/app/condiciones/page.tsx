import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { BotonAceptarCondiciones } from "@/components/auth/boton-condiciones";
import { Brand } from "@/components/marca/brand";
import { inicioSegunRol, obtenerPerfil } from "@/lib/auth/perfil";
import {
  CONDICIONES_EMPRESA,
  SECCIONES_CONDICIONES_EMPRESA,
} from "@/lib/legal/condiciones-empresa";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Condiciones de uso" };

/**
 * Las condiciones de la empresa, bloqueantes.
 *
 * Pantalla propia y no una casilla al pie de un formulario, por el mismo
 * motivo que el consentimiento de la persona evaluada: lo que se acepta aquí
 * incluye responder de un dato sensible de alguien que no está en la sala.
 *
 * Cuando exista el alta de empresa (F5.1) la aceptación irá también allí, con
 * su casilla. Esta pantalla seguirá haciendo falta para las cuentas ya
 * creadas y para cada vez que se suba la versión del documento.
 */
export default async function CondicionesPage() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");

  // Quien no administra una empresa no tiene nada que aceptar aquí. Se
  // comprueba también en esta pantalla y no solo en el enrutado, porque una
  // pantalla que solo se protege en el middleware queda expuesta el día que
  // alguien llega por otro camino.
  if (perfil.role !== "empresa") redirect(inicioSegunRol(perfil.role));

  const supabase = await crearClienteServidor();
  const { data: yaAceptado } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", perfil.id)
    .eq("document_key", CONDICIONES_EMPRESA.clave)
    .eq("version", CONDICIONES_EMPRESA.version)
    .maybeSingle();

  if (yaAceptado) redirect("/empresa");

  return (
    <main className="bg-bg flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto w-full max-w-[720px] px-6 py-5">
          <Brand size="sm" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-3">
          <span className="bg-accent-soft text-accent grid size-12 place-items-center rounded-full">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-h1">Condiciones de uso</h1>
          <p className="text-text-body text-lg">
            Antes de encargar evaluaciones, lee de qué respondes. Se acepta una
            vez, y otra vez si el documento cambia.
          </p>
          <p className="text-text-muted text-micro tabular">
            Versión {CONDICIONES_EMPRESA.version}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {SECCIONES_CONDICIONES_EMPRESA.map((seccion) => (
            <section key={seccion.titulo} className="flex flex-col gap-2">
              <h2 className="text-h4">{seccion.titulo}</h2>
              {(Array.isArray(seccion.cuerpo)
                ? seccion.cuerpo
                : [seccion.cuerpo]
              ).map((parrafo, n) => (
                <p key={n} className="text-text-body">
                  {parrafo}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="border-line border-t pt-8">
          <BotonAceptarCondiciones />
        </div>
      </div>
    </main>
  );
}
