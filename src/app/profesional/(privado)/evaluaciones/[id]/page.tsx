import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { RevisionInforme } from "@/components/profesional/revision-informe";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Revisar evaluación",
  robots: { index: false, follow: false },
};

/**
 * La pantalla donde el informe se revisa y se firma.
 *
 * Es el único sitio de la plataforma donde un resultado pasa de existir a ser
 * visible. Por eso enseña, en este orden: quién es, qué propone el motor, qué
 * escribe el profesional encima, y solo al final el botón de publicar.
 */
export default async function RevisarEvaluacionPage({
  params,
}: PageProps<"/profesional/evaluaciones/[id]">) {
  await exigirProfesional();
  const { id } = await params;

  const supabase = await crearClienteServidor();

  const { data: asignacion } = await supabase
    .from("assignments")
    .select(
      "id, status, assessment_id, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento, cargo), paciente:profiles!assignments_patient_id_fkey(nombre, apellidos, documento), organizacion:organizations(nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!asignacion) notFound();

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  type Persona = {
    nombre: string;
    apellidos: string | null;
    documento: string | null;
    cargo?: string | null;
  };

  const quien =
    uno<Persona>(asignacion.persona) ?? uno<Persona>(asignacion.paciente);

  const [{ data: parametros }, { data: valores }, { data: resultado }, { data: decision }] =
    await Promise.all([
      supabase
        .from("assessment_parameters")
        .select("clave, etiqueta, kind, seccion, computed, admite_nota, posicion")
        .eq("assessment_id", asignacion.assessment_id)
        .order("posicion"),
      supabase
        .from("result_values")
        .select("parameter_key, valor, sugerido, nota")
        .eq("assignment_id", id),
      supabase
        .from("results")
        .select("nota_global, released_at")
        .eq("assignment_id", id)
        .maybeSingle(),
      supabase.rpc("consentimiento_de", { p_assignment: id }),
    ]);

  const nombre = quien
    ? [quien.nombre, quien.apellidos].filter(Boolean).join(" ")
    : "Sin nombre";

  return (
    <Pantalla>
      <Link
        href="/profesional/evaluaciones"
        className="text-text-muted hover:text-text-strong text-sm"
      >
        ← Volver a evaluaciones
      </Link>

      <EncabezadoPagina
        titulo={nombre}
        descripcion={[
          uno<{ nombre: string }>(asignacion.assessment)?.nombre,
          quien?.documento ? `Documento ${quien.documento}` : null,
          quien?.cargo ?? null,
          uno<{ nombre: string }>(asignacion.organizacion)?.nombre,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {(decision as string | null) !== "aceptado" ? (
        <Alert tone="warning" title="Sin consentimiento vigente">
          Esta persona no tiene un consentimiento aceptado para esta evaluación.
          Puedes revisarla, pero no se podrá publicar mientras siga así.
        </Alert>
      ) : null}

      <RevisionInforme
        asignacion={id}
        status={asignacion.status}
        parametros={parametros ?? []}
        valores={valores ?? []}
        notaGlobal={resultado?.nota_global ?? null}
        publicado={resultado?.released_at ?? null}
      />
    </Pantalla>
  );
}
