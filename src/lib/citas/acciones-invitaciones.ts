"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import { exigirProfesional, obtenerPerfil } from "@/lib/auth/perfil";
import { enviarCorreo } from "@/lib/correo/enviar";
import { invitacionEvaluacion } from "@/lib/correo/plantillas";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { origenDeLaPeticion } from "@/lib/http/origen";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Emisión de invitaciones a una sesión de evaluación.
 *
 * Es el TERCER acto del profesional sobre una sesión, y deliberadamente
 * separado de los otros dos (SPEC §9.2): confirmar dice «acepto la sesión»;
 * esto dice «ya pueden crear su cuenta». Entre uno y otro suele estar el pago,
 * y aceptar una fecha no puede hacer que a nadie le llegue un correo.
 *
 * Manda el MISMO enlace que ya está a la vista en los pases de la sesión, así
 * que volver a pulsar reenvía en vez de crear otro acceso. Antes cada
 * pulsación fabricaba un testigo nuevo —y la segunda no mandaba nada, porque
 * la persona ya tenía una invitación viva— que es exactamente lo que hacía
 * falta cuando alguien decía «no me llegó el correo».
 */
export async function emitirInvitaciones(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const cita = String(formData.get("cita") ?? "");
  if (!cita) return { ok: false, mensaje: "Sesión no válida." };

  const supabase = await crearClienteServidor();

  const { data: emitidas, error } = await supabase.rpc("emitir_invitaciones", {
    p_appointment_id: cita,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    return { ok: false, mensaje: limpio };
  }

  const lista = (emitidas ?? []) as {
    person_id: string;
    nombre: string | null;
    email: string;
    token: string;
  }[];

  if (lista.length === 0) {
    return {
      ok: true,
      mensaje:
        "No hay a quién escribir: todos los convocados ya tienen cuenta, o los que faltan no tienen correo cargado. Sus pases siguen aquí para entregarlos a mano.",
    };
  }

  // Los datos de la sesión y de la empresa se leen con privilegios de servidor
  // porque hacen falta para redactar el correo, no para mostrárselos a nadie.
  const admin = crearClienteAdmin();
  const { data: sesion } = await admin
    .from("appointments")
    .select(
      "starts_at, ends_at, modality, location, organizacion:organizations(nombre)",
    )
    .eq("id", cita)
    .maybeSingle();

  const origen = await origenDeLaPeticion();

  /*
   * PostgREST devuelve la relación embebida como arreglo aunque sea de uno.
   * Se normaliza aquí en vez de forzar el tipo: forzarlo compilaba y luego
   * daba `undefined` en tiempo de ejecución, que es peor que un error.
   */
  const embebida = sesion?.organizacion as
    { nombre: string } | { nombre: string }[] | null | undefined;

  const empresa =
    (Array.isArray(embebida) ? embebida[0]?.nombre : embebida?.nombre) ??
    "Una empresa";

  let enviados = 0;

  for (const persona of lista) {
    const { enviado } = await enviarCorreo(
      { correo: persona.email, nombre: persona.nombre },
      invitacionEvaluacion(
        {
          inicioISO: sesion?.starts_at ?? "",
          finISO: sesion?.ends_at ?? "",
          modalidad: sesion?.modality ?? "presencial",
          lugar: sesion?.location ?? null,
          // La hora se escribe en la zona de la consulta: es donde ocurre la
          // sesión presencial, y es la que la persona necesita para llegar.
          zona: "America/Bogota",
        },
        {
          nombre: persona.nombre,
          empresa,
          /*
           * El pase lleva DIRECTO a la prueba, no al registro.
           *
           * Antes iba a `/invitacion/…`, que pedía crear cuenta antes de dejar hacer
           * nada. Para un candidato de selección eso eran tres pantallas —correo,
           * contraseña, confirmar el correo— para algo que usa una sola vez, y cada una
           * pierde gente en un proceso que la empresa quiere cerrar hoy.
           */
          enlace: `${origen}/prueba/${persona.token}`,
        },
      ),
    );

    if (enviado) enviados += 1;
  }

  revalidatePath(`/profesional/citas/${cita}`);
  revalidatePath("/profesional/agenda");

  const una = lista.length === 1;
  const cuantas = una ? "1 invitación" : `${lista.length} invitaciones`;

  /*
   * Emitido y enviado no son lo mismo, y se dicen por separado.
   *
   * Sin clave de correo configurada no sale ninguno, pero los accesos siguen
   * existiendo y están a la vista en la misma pantalla: se pueden repartir a
   * mano. Decir «se enviaron 3» cuando no salió ninguno haría esperar en vano.
   */
  return {
    ok: true,
    mensaje:
      enviados === lista.length
        ? `${cuantas} ${una ? "enviada" : "enviadas"} por correo.`
        : `${enviados} de ${lista.length} ${lista.length === 1 ? "enviada" : "enviadas"} por correo. ` +
          `Las que no salieron no se pierden: sus pases están aquí arriba para entregarlos a mano.`,
  };
}

/**
 * Aceptación de una invitación por la persona convocada.
 *
 * Aquí se decide si su historial sigue siendo uno solo. La función de la base
 * enlaza la ficha de la empresa con SU cuenta —la que ya tenía si otra empresa
 * la evaluó antes— en vez de crear una segunda.
 */
export async function aceptarInvitacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  /*
   * Basta con tener sesión. NO se usa `exigirSesion()`, que además exige el
   * consentimiento clínico y mandaba a la persona a firmarlo antes de poder
   * hacer lo único que se le había pedido.
   *
   * Es el mismo error de categoría de dos capas más arriba, movido un paso
   * adentro: activar el acceso a una evaluación que encargó una empresa no
   * requiere consentir un tratamiento psicológico. Ese consentimiento existe,
   * es otro, y se firma en la sesión.
   */
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");

  const token = String(formData.get("token") ?? "");
  if (!token) return { ok: false, mensaje: "Enlace no válido." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("aceptar_invitacion", {
    p_token: token,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    const pista = (error as { hint?: string | null }).hint;
    return { ok: false, mensaje: pista ? `${limpio} ${pista}` : limpio };
  }

  /*
   * Se vuelve a la propia invitación, no al panel.
   *
   * El panel es el espacio de atención y exige el consentimiento clínico, que
   * es de tratamiento y no de evaluación. Mandar allí a alguien que acaba de
   * activar su acceso lo estrellaría contra un documento que no le toca
   * firmar todavía.
   */
  revalidatePath(`/invitacion/${token}`);
  redirect(`/invitacion/${token}?aceptada=1`);
}
