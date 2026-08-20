import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Brand } from "@/components/marca/brand";
import { Consentimiento } from "@/components/evaluaciones/consentimiento";
import { Ejecutor } from "@/components/evaluaciones/ejecutor";
import { CONSENTIMIENTO } from "@/lib/consentimiento";
import type { Item } from "@/lib/evaluaciones/motor";

export const metadata: Metadata = {
  title: "Tu evaluación",
  // Fuera de los buscadores: la dirección lleva el testigo de una persona.
  robots: { index: false, follow: false },
};

/**
 * La evaluación de quien no tiene cuenta.
 *
 * Para una psicotécnica de selección, quien responde es un candidato: entra
 * una vez y no vuelve. Obligarle a crear cuenta —correo, contraseña, confirmar
 * el correo— antes de empezar eran tres pantallas de fricción para algo de un
 * solo uso, y cada pantalla pierde gente en un proceso que la empresa quiere
 * cerrar hoy.
 *
 * Aquí el enlace ES la credencial. No hay sesión, así que la página se dibuja
 * con el cliente anónimo y todo lo que se puede hacer pasa por funciones que
 * resuelven el testigo a UNA asignación.
 *
 * Lo que se cedió a cambio está dicho en la migración 0037: sin cuenta no hay
 * historial entre empresas.
 */
export default async function PruebaConPasePage({
  params,
}: PageProps<"/prueba/[token]">) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase.rpc("evaluacion_de_pase", {
    p_token: token,
  });

  const evaluacion = (data ?? [])[0] as
    | {
        assignment_id: string;
        estado: string;
        instrumento: string;
        persona: string;
        empresa: string | null;
        consentimiento: string;
      }
    | undefined;

  if (error || !evaluacion) {
    return (
      <Marco>
        {/*
          El motivo, no «no válido».
          
          Un enlace vencido, uno mal copiado y una prueba ya enviada llevan aquí
          por caminos distintos, y quien lo mira necesita saber cuál es el suyo
          para saber a quién preguntar. La base ya lo distingue; aquí solo se
          repite.
        */}
        <Alert tone="danger" title="No pudimos abrir tu evaluación">
          {error?.message.replace(/^.*?:\s*/, "") ??
            "Ese enlace no corresponde a ninguna evaluación."}
        </Alert>
      </Marco>
    );
  }

  const { data: preguntas } = await supabase.rpc("preguntas_de_pase", {
    p_token: token,
  });

  const items = (preguntas ?? []) as (Item & { respuesta: unknown })[];

  const respuestas = Object.fromEntries(
    items.filter((i) => i.respuesta != null).map((i) => [i.id, i.respuesta]),
  );

  const enCurso = evaluacion.estado === "en_curso";

  return (
    <Marco>
      <div className="flex flex-col gap-1">
        <h1 className="text-h2">{evaluacion.instrumento}</h1>
        <p className="text-text-muted">
          {evaluacion.persona}
          {evaluacion.empresa ? ` · ${evaluacion.empresa}` : ""}
        </p>
      </div>

      {enCurso ? (
        <Ejecutor
          asignacion={evaluacion.assignment_id}
          items={items}
          respuestas={respuestas}
          pase={token}
        />
      ) : (
        <Consentimiento
          asignacion={evaluacion.assignment_id}
          decision={
            evaluacion.consentimiento === "sin_decidir"
              ? null
              : evaluacion.consentimiento
          }
          pase={token}
          version={CONSENTIMIENTO.version}
        />
      )}
    </Marco>
  );
}

/** Sin menú ni sesión: quien llega aquí no tiene dónde navegar. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto w-full max-w-[760px] px-6 py-5">
          <Brand size="sm" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
