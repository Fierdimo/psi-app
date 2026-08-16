import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import {
  Informe,
  type ParametroInforme,
  type ValorInforme,
} from "@/components/evaluaciones/informe";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Informe",
  robots: { index: false, follow: false },
};

/**
 * El informe de una persona, para la empresa que lo encargó.
 *
 * Se reutiliza el MISMO componente que ve la persona evaluada. No es ahorro de
 * código: es que las dos partes lean exactamente lo mismo. Dos versiones del
 * informe acabarían diciendo cosas distintas al primer cambio, y la persona
 * tiene derecho a saber qué se dijo de ella.
 *
 * Si la evaluación no está publicada, RLS no devuelve nada y esto responde 404
 * — igual que si no existiera. Ese candado está en la base y no aquí.
 */
export default async function InformeEmpresaPage({
  params,
}: PageProps<"/empresa/informes/[id]">) {
  await exigirEmpresa();
  const { id } = await params;

  const supabase = await crearClienteServidor();

  const [{ data: asignacion }, { data: valores }, { data: resultado }] =
    await Promise.all([
      supabase
        .from("assignments")
        .select(
          "id, assessment_id, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento, cargo)",
        )
        .eq("id", id)
        .eq("status", "publicada")
        .maybeSingle(),
      supabase
        .from("result_values")
        .select("parameter_key, valor, sugerido, nota")
        .eq("assignment_id", id),
      supabase
        .from("results")
        .select("nota_global, released_at")
        .eq("assignment_id", id)
        .maybeSingle(),
    ]);

  if (!asignacion) notFound();

  const { data: parametros } = await supabase
    .from("assessment_parameters")
    .select("clave, etiqueta, kind, seccion")
    .eq("assessment_id", asignacion.assessment_id)
    .order("posicion");

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  type Persona = {
    nombre: string;
    apellidos: string | null;
    documento: string;
    cargo: string | null;
  };

  const persona = uno<Persona>(asignacion.persona);

  return (
    <Pantalla>
      <Link
        href="/empresa/informes"
        className="text-text-muted hover:text-text-strong text-sm"
      >
        ← Volver a informes
      </Link>

      <EncabezadoPagina
        titulo={
          persona
            ? [persona.nombre, persona.apellidos].filter(Boolean).join(" ")
            : "Informe"
        }
        descripcion={[
          uno<{ nombre: string }>(asignacion.assessment)?.nombre,
          persona?.documento ? `Documento ${persona.documento}` : null,
          persona?.cargo,
          resultado?.released_at
            ? `Firmado el ${new Date(resultado.released_at).toLocaleDateString("es-CO")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <Informe
        parametros={(parametros ?? []) as ParametroInforme[]}
        valores={(valores ?? []) as ValorInforme[]}
        notaGlobal={resultado?.nota_global ?? null}
      />
    </Pantalla>
  );
}
