import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Informe } from "@/components/evaluaciones/informe";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { RevisionInforme } from "@/components/profesional/revision-informe";
import { exigirProfesional } from "@/lib/auth/perfil";
import { consentimientoFirmado } from "@/lib/evaluaciones/consentimiento-firmado";
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
      "id, status, assessment_id, habilitado_at, assigned_at, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento, cargo), paciente:profiles!assignments_patient_id_fkey(nombre, apellidos, documento), organizacion:organizations(nombre)",
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

  const [
    { data: parametros },
    { data: valores },
    { data: resultado },
    { data: decision },
    { data: fijos },
  ] = await Promise.all([
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
    /* Las descripciones fijas de cada escala: sin ellas el documento se dibuja
       igual pero pierde el párrafo de «qué mide esto». */
    supabase.rpc("textos_fijos_del_instrumento", {
      p_assessment: asignacion.assessment_id,
    }),
  ]);

  const textosFijos = Object.fromEntries(
    ((fijos ?? []) as { parameter_key: string; cuerpo: string }[]).map((t) => [
      t.parameter_key,
      t.cuerpo,
    ]),
  );

  const nombre = quien
    ? [quien.nombre, quien.apellidos].filter(Boolean).join(" ")
    : "Sin nombre";

  const consentimiento = await consentimientoFirmado(supabase, id, {
    nombre,
    documento: quien?.documento ?? null,
    empresa: uno<{ nombre: string }>(asignacion.organizacion)?.nombre ?? null,
  });

  return (
    <Pantalla>
      <Link
        href="/profesional/evaluaciones"
        className="text-text-muted hover:text-text-strong text-sm"
      >
        ← Volver a evaluaciones
      </Link>

      {/*
        SIN ENCABEZADO PROPIO cuando hay informe.

        Repetía el nombre, el documento, la prueba y la empresa, que es
        exactamente la cabecera del documento que se enseña debajo. Dos veces
        lo mismo, y con formatos distintos, obliga a comprobar si dicen lo
        mismo. Mientras no hay informe sí hace falta: es lo único que identifica
        la pantalla.
      */}
      {asignacion.status !== "publicada" ? (
        <EncabezadoPagina
          titulo={nombre}
          descripcion={[
            uno<{ nombre: string }>(asignacion.assessment)?.nombre,
            quien?.documento ? `Documento ${quien.documento}` : null,
            uno<{ nombre: string }>(asignacion.organizacion)?.nombre,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : null}

      {/* Solo cuando ya hay algo que publicar: antes de eso lo dice la propia
          pantalla de abrir el examen, y repetirlo sería ruido. */}
      {(decision as string | null) !== "aceptado" &&
      !["asignada", "en_curso"].includes(asignacion.status) ? (
        <Alert tone="warning" title="Sin consentimiento vigente">
          Esta persona no tiene un consentimiento aceptado para esta evaluación.
          Puedes revisarla, pero no se podrá publicar mientras siga así.
        </Alert>
      ) : null}

      {/*
        EL DOCUMENTO TAL COMO SALE, antes del editor.

        El profesional revisaba sobre una lista de campos y firmaba sin haber
        visto nunca lo que iba a recibir la empresa. Publicar es afirmar que
        respondes por ese documento, y no se puede responder por algo que no se
        ha mirado.

        Va arriba y el editor debajo: primero qué dice, después dónde se toca.
      */}
      {asignacion.status === "publicada" ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-h3">Así lo recibe la empresa</h1>
            <a
              href={`/api/informe/${id}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Download aria-hidden="true" className="size-4" />
              Descargar el PDF
            </a>
          </div>

          {/* El mismo componente que ve la empresa y que vio la persona
              evaluada. Tres versiones de un informe se separan a la primera
              corrección; una sola no puede. */}
          <div className="border-line overflow-hidden rounded-xl border">
            <Informe
              parametros={parametros ?? []}
              valores={valores ?? []}
              notaGlobal={resultado?.nota_global ?? null}
              textosFijos={textosFijos}
              evaluado={{
                nombre,
                documento: quien?.documento ?? null,
                empresa:
                  uno<{ nombre: string }>(asignacion.organizacion)?.nombre ??
                  null,
                fechaISO: asignacion.assigned_at,
              }}
              consentimiento={consentimiento}
            />
          </div>
        </section>
      ) : null}

      {asignacion.status !== "publicada" && (
        <RevisionInforme
          asignacion={id}
          status={asignacion.status}
          parametros={parametros ?? []}
          valores={valores ?? []}
          notaGlobal={resultado?.nota_global ?? null}
          publicado={resultado?.released_at ?? null}
          consentimiento={(decision as string | null) ?? null}
        />
      )}
    </Pantalla>
  );
}
