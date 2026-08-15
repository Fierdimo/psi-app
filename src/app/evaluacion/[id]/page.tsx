import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Ejecutor } from "@/components/evaluaciones/ejecutor";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { Consentimiento } from "@/components/evaluaciones/consentimiento";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Item } from "@/lib/evaluaciones/motor";

export const metadata: Metadata = { title: "Mi evaluación" };

/**
 * La pantalla de la persona evaluada.
 *
 * Vive fuera del área de atención a propósito: quien llega aquí puede haber
 * sido convocado por una empresa y no ser paciente de nadie. Pedirle el
 * consentimiento clínico de tratamiento sería el error de categoría que
 * documenta `SPEC.md` §9.2.
 */
export default async function EvaluacionPage({
  params,
  searchParams,
}: PageProps<"/evaluacion/[id]">) {
  const { id } = await params;
  const { enviada } = await searchParams;

  const perfil = await obtenerPerfil();
  if (!perfil) redirect(`/ingresar?siguiente=/evaluacion/${id}`);

  const supabase = await crearClienteServidor();

  /*
   * Sin filtro por persona: lo pone RLS.
   *
   * `mi_asignacion()` ya decide qué asignaciones ve cada quien, así que
   * repetir aquí la condición solo añadiría un sitio más donde equivocarse —y
   * el sitio que de verdad protege es el otro.
   */
  const { data: asignacion } = await supabase
    .from("assignments")
    .select(
      "id, status, habilitado_at, assessment:assessments(nombre, descripcion)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!asignacion) notFound();

  const embebida = asignacion.assessment as
    | { nombre: string; descripcion: string | null }
    | { nombre: string; descripcion: string | null }[]
    | null;

  const prueba = Array.isArray(embebida) ? embebida[0] : embebida;

  const { data: decision } = await supabase
    .rpc("consentimiento_de", { p_assignment: id })
    .single<string | null>();

  const enCurso = asignacion.status === "en_curso";

  const { data: items } = enCurso
    ? await supabase
        .from("assessment_items")
        .select("id, posicion, tipo, enunciado, escala, opciones")
        .order("posicion")
    : { data: null };

  const { data: respuestas } = enCurso
    ? await supabase
        .from("responses")
        .select("item_id, valor")
        .eq("assignment_id", id)
    : { data: null };

  return (
    <Pantalla>
      {/*
        Una salida, siempre visible.
        La pantalla ocupaba la ventana entera sin forma de volver, y eso en una
        página que pide consentimiento no es un descuido de diseño: quien se
        siente encerrado firma por salir. Poder irse es parte de que la
        decisión sea libre.
      */}
      <Link
        href="/evaluacion"
        className="text-text-muted hover:text-text-strong text-sm"
      >
        ← Volver a mis evaluaciones
      </Link>

      <EncabezadoPagina
        titulo={prueba?.nombre ?? "Tu evaluación"}
        descripcion={prueba?.descripcion ?? undefined}
      />

      {enviada ? (
        <Alert tone="success" title="Enviaste tus respuestas">
          Ya no tienes que hacer nada más. El profesional revisa los resultados
          antes de que estén disponibles: no son automáticos, y por eso tardan.
        </Alert>
      ) : asignacion.status === "publicada" ? (
        <Alert tone="success" title="Tu informe ya está disponible">
          Puedes consultarlo en tu sección de resultados.
        </Alert>
      ) : ["enviada", "calificada"].includes(asignacion.status) ? (
        <Alert tone="info" title="Tus respuestas están enviadas">
          El profesional las está revisando. Cuando termine, tu informe
          aparecerá en tu sección de resultados.
        </Alert>
      ) : enCurso ? (
        <Ejecutor
          asignacion={id}
          items={(items ?? []) as Item[]}
          respuestas={Object.fromEntries(
            (respuestas ?? []).map((r) => [r.item_id, r.valor]),
          )}
        />
      ) : (
        <Consentimiento
          asignacion={id}
          decision={decision ?? null}
          habilitada={asignacion.habilitado_at !== null}
        />
      )}
    </Pantalla>
  );
}
