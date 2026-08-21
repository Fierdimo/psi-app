import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioSesion } from "@/components/empresa/formulario-sesion";
import { PasesDeSesion } from "@/components/citas/pases-de-sesion";
import { ListadoDeSesiones } from "@/components/empresa/listado-de-sesiones";
import { PaginaConPanel } from "@/components/navegacion/pagina-con-panel";
import { exigirEmpresa } from "@/lib/auth/perfil";
import {
  abarcaVariosDias,
  ahoraEn,
  capitalizar,
  fechaLarga,
  rangoDeFechas,
  rangoHorario,
} from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sesión" };

/**
 * Una sesión, y lo que se puede hacer con ella en cada momento.
 *
 * MIENTRAS ES SOLICITUD se edita: la fecha y a quién convocas. Una vez
 * confirmada, la fecha es un compromiso de dos y a los convocados ya se les
 * avisó, así que cambiarla por detrás haría que alguien se presentara el día
 * que no era. La base lo rechaza; aquí ni se ofrece.
 *
 * YA CONFIRMADA lo que hace falta es lo contrario: repartir el acceso. Esta
 * pantalla era hasta ahora un callejón —«ya no se edita, escríbele»— cuando es
 * justo el momento en que la empresa tiene algo que hacer.
 */
export async function ContenidoDeSesion({
  params,
}: PageProps<"/empresa/sesiones/[id]">) {
  const perfil = await exigirEmpresa();
  const { id } = await params;

  const supabase = await crearClienteServidor();

  const [
    { data: sesion },
    { data: personas },
    { data: convocados },
    { data: ajustes },
  ] = await Promise.all([
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
    supabase.from("clinic_settings").select("min_notice_hours").maybeSingle(),
  ]);

  if (!sesion) notFound();

  /*
   * La antelación mínima la fija la consulta, no esta pantalla.
   *
   * Aquí estaba escrito «mañana» a pelo, así que aunque el ajuste dijera cero
   * el calendario seguía sin dejar elegir hoy. Una regla que vive en dos
   * sitios es una regla que un día dirá dos cosas distintas, y la que gana es
   * la que el usuario ve.
   */
  const margen = ajustes?.min_notice_hours ?? 0;
  const fechaMinima = ahoraEn(perfil.timezone)
    .plus({ hours: margen })
    .toISODate()!;

  const repartible =
    sesion.status === "confirmada" || sesion.status === "realizada";

  /*
   * Cuándo es, sabiendo que puede no ser un solo día.
   *
   * El profesional reparte por persona, y una tanda que no cabe en su jornada
   * continúa en las siguientes. Aquí se escribía siempre «lunes 24 de agosto ·
   * 08:00 – 11:00», que para una sesión de lunes a miércoles es falso dos
   * veces: ni es solo el lunes, ni son tres horas. La empresa es quien avisa a
   * su gente; leer eso y reenviarlo es mandar a doce personas el día que no es.
   */
  const enVariosDias = abarcaVariosDias(
    sesion.starts_at,
    sesion.ends_at,
    perfil.timezone,
  );

  const cuando = enVariosDias
    ? `${capitalizar(rangoDeFechas(sesion.starts_at, sesion.ends_at, perfil.timezone))} · cada persona tiene su hora`
    : `${capitalizar(fechaLarga(sesion.starts_at, perfil.timezone))} · ${rangoHorario(sesion.starts_at, sesion.ends_at, perfil.timezone)}`;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo={repartible ? "Sesión" : "Editar la solicitud"}
        descripcion={
          repartible
            ? /*
               * Cuándo es, en el encabezado.
               *
               * La pantalla se titulaba «La sesión» y no decía en ningún sitio
               * qué día ni a qué hora: quien entra a repartir los accesos es
               * quien tiene que avisar a su gente, y esa es la primera cosa
               * que necesita copiar en el mensaje.
               */
              cuando + (sesion.location ? ` · ${sesion.location}` : "")
            : "Puedes cambiar la fecha y a quién convocas mientras el profesional no la haya respondido."
        }
      />

      {sesion.status !== "solicitada" ? (
        <div className="flex flex-col gap-4">
          {/*
            Los pases van PRIMERO cuando los hay.

            El aviso de «ya no se edita» responde a algo que la empresa no ha
            preguntado; lo que viene a hacer aquí es repartir. Arriba del todo,
            el aviso empujaba la única acción de la pantalla por debajo del
            pliegue en un teléfono.

            Y solo con la sesión en pie: repartir accesos de una cancelada o
            rechazada es mandar a alguien a presentarse a nada.
          */}
          {repartible && (
            <PasesDeSesion
              citaId={sesion.id}
              zona={perfil.timezone}
              titulo="Pases de acceso de esta sesión"
              nota={
                enVariosDias
                  ? "Entrégale a cada persona el suyo, y solo el suyo: quien tenga el enlace puede entrar como ella. Esta tanda no cabía en un día, así que cada quien tiene SU fecha además de su hora: está escrita junto a su nombre y va incluida al copiar la lista."
                  : "Entrégale a cada persona el suyo, y solo el suyo: quien tenga el enlace puede entrar como ella. Están listos desde que el profesional confirmó la sesión."
              }
            />
          )}

          <Alert tone="info" title="Esta sesión ya no se edita">
            El profesional ya respondió, así que la fecha es un compromiso de
            dos y a los convocados se les avisó. Si necesitas cambiarla,
            escríbele.
          </Alert>
        </div>
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

/**
 * La sesión abierta en directo: el listado detrás, ella encima.
 *
 * Al recargar no hay intercepción, así que sin esto el detalle se comía la
 * pantalla y quien recargaba creía que la aplicación había cambiado de sitio.
 */
export default async function SesionPage(
  props: PageProps<"/empresa/sesiones/[id]">,
) {
  return (
    <PaginaConPanel
      fondo={<ListadoDeSesiones />}
      titulo="Sesión"
      volverA="/empresa/sesiones"
    >
      <ContenidoDeSesion {...props} />
    </PaginaConPanel>
  );
}
