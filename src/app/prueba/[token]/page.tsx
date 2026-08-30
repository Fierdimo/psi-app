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

  /*
   * Se acabó el tiempo.
   *
   * `asignacion_de_pase` la marca así cuando alguien vuelve pasada la ventana
   * del instrumento (migración 0056), y sin esta rama la pantalla caía en la
   * del consentimiento: le pedía consentir otra vez algo que ya no puede
   * responder, que es la peor respuesta posible a «¿qué ha pasado?».
   */
  const vencida = evaluacion.estado === "vencida";
  const terminada = ["enviada", "calificada", "publicada"].includes(
    evaluacion.estado,
  );

  return (
    <Marco>
      <div className="flex flex-col gap-1">
        <h1 className="text-h2">{evaluacion.instrumento}</h1>
        <p className="text-text-muted">
          {evaluacion.persona}
          {evaluacion.empresa ? ` · ${evaluacion.empresa}` : ""}
        </p>
      </div>

      {vencida ? (
        <Alert tone="warning" title="Se acabó el tiempo">
          Esta prueba tiene un tiempo límite desde que se empieza, y ya pasó.
          Tus respuestas no se enviaron. Si aún necesitas hacerla, habla con la
          empresa que te convocó: puede darte un acceso nuevo.
        </Alert>
      ) : terminada ? (
        /*
         * Ya respondió y sigue teniendo enlace, que es una combinación rara.
         *
         * Solo pasa cuando el cierre automático no llegó a publicar: en ese
         * caso el pase se deja vivo a propósito para que la persona pueda
         * volver. Aquí TAMPOCO se enseñan resultados —el perfil va a la
         * empresa que encargó la evaluación, no a esta pantalla— así que lo
         * único que puede hacer esta página es decirle a quién preguntar.
         */
        <Alert tone="success" title="Ya enviaste tus respuestas">
          Tus resultados van a{" "}
          {evaluacion.empresa ?? "la empresa que encargó la evaluación"}, que
          fue quien encargó la evaluación y con quien continúa tu proceso.
          Pregúntales a ellos por los siguientes pasos.
        </Alert>
      ) : enCurso ? (
        <Ejecutor
          asignacion={evaluacion.assignment_id}
          items={items}
          respuestas={respuestas}
          pase={token}
          persona={evaluacion.persona}
          instrumento={evaluacion.instrumento}
          empresa={evaluacion.empresa}
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
          empresa={evaluacion.empresa}
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
