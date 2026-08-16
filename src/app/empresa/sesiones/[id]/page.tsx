import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioSesion } from "@/components/empresa/formulario-sesion";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { ahoraEn } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar la solicitud" };

/**
 * Corregir una solicitud, mientras siga siendo una solicitud.
 *
 * Una vez confirmada, la fecha es un compromiso de dos y a los convocados ya
 * se les avisó: cambiarla por detrás haría que alguien se presentara el día
 * que no era. La base lo rechaza; aquí ni se ofrece.
 */
export default async function EditarSesionPage({
  params,
}: PageProps<"/empresa/sesiones/[id]">) {
  const perfil = await exigirEmpresa();
  const { id } = await params;

  const supabase = await crearClienteServidor();

  const [{ data: sesion }, { data: personas }, { data: convocados }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, modality, location, patient_note",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("organization_people")
        .select("id, nombre, apellidos, documento, cargo, vinculo")
        .order("nombre"),
      supabase
        .from("appointment_attendees")
        .select("person_id")
        .eq("appointment_id", id),
    ]);

  if (!sesion) notFound();

  const fechaMinima = ahoraEn(perfil.timezone).plus({ days: 1 }).toISODate()!;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Editar la solicitud"
        descripcion="Puedes cambiar la fecha y a quién convocas mientras el profesional no la haya respondido."
      />

      {sesion.status !== "solicitada" ? (
        <Alert tone="info" title="Esta sesión ya no se edita">
          El profesional ya respondió, así que la fecha es un compromiso de dos
          y a los convocados se les avisó. Si necesitas cambiarla, escríbele.
        </Alert>
      ) : (
        <FormularioSesion
          personas={personas ?? []}
          fechaMinima={fechaMinima}
          sesion={{
            id: sesion.id,
            starts_at: sesion.starts_at,
            ends_at: sesion.ends_at,
            modality: sesion.modality,
            location: sesion.location,
            patient_note: sesion.patient_note,
          }}
          inicial={(convocados ?? []).map((c) => c.person_id)}
        />
      )}
    </Pantalla>
  );
}
