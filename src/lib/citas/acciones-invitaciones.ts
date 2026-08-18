"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import { exigirProfesional, obtenerPerfil } from "@/lib/auth/perfil";
import { enviarCorreo } from "@/lib/correo/enviar";
import { invitacionEvaluacion } from "@/lib/correo/plantillas";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Emisión de invitaciones a una sesión de evaluación.
 *
 * Es el TERCER acto del profesional sobre una sesión, y deliberadamente
 * separado de los otros dos (SPEC §9.2): confirmar dice «acepto la sesión»;
 * esto dice «ya pueden crear su cuenta». Entre uno y otro suele estar el pago,
 * y aceptar una fecha no puede hacer que a nadie le llegue un correo.
 *
 * Los testigos existen en claro SOLO aquí, el rato que tarda el envío. En la
 * base queda su hash, así que esta función es la única oportunidad de ponerlos
 * en un correo: si el envío falla, hay que emitir de nuevo.
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
        "No había nadie a quien invitar: todos los convocados ya tienen cuenta o su invitación sigue vigente.",
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

  const encabezados = await headers();
  const origen =
    encabezados.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

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
  const enlaces: { nombre: string; correo: string; enlace: string }[] = [];

  for (const persona of lista) {
    enlaces.push({
      nombre: persona.nombre ?? persona.email,
      correo: persona.email,
      enlace: `${origen}/invitacion/${persona.token}`,
    });

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
          enlace: `${origen}/invitacion/${persona.token}`,
        },
      ),
    );

    if (enviado) enviados += 1;
  }

  revalidatePath(`/profesional/citas/${cita}`);
  revalidatePath("/profesional/agenda");

  /*
   * Se distingue emitido de enviado, y no es un matiz.
   *
   * En local no hay clave de Resend, así que no sale ningún correo pero las
   * invitaciones SÍ quedan creadas y sus enlaces son válidos. Decir «se
   * enviaron 3» cuando no salió ninguno haría esperar en vano; decir que
   * fallaron, cuando las invitaciones existen, invitaría a reemitir y a que
   * llegaran dos correos el día que sí haya clave.
   */
  const una = lista.length === 1;
  const cuantas = una ? "1 invitación" : `${lista.length} invitaciones`;

  /*
   * Los enlaces se devuelven SIEMPRE, salgan o no los correos.
   *
   * El testigo solo existe en claro este instante: en la base queda su hash y
   * de ahí no se vuelve. Si el correo no llega —dirección vieja, carpeta de
   * spam, o sencillamente no hay servicio de correo contratado— esta es la
   * única oportunidad de entregar el acceso, y la sesión es presencial: se
   * puede pasar por el canal que ya se use, o enseñarlo el día de la prueba.
   *
   * Reemitir crea testigos nuevos, así que perder estos no deja a nadie fuera:
   * cuesta otro clic, no una persona sin evaluar.
   */
  return {
    ok: true,
    enlaces,
    mensaje:
      enviados === lista.length
        ? `${cuantas} ${una ? "enviada" : "enviadas"} por correo.`
        : `${cuantas} ${una ? "creada" : "creadas"}, ${enviados} ${enviados === 1 ? "enviada" : "enviadas"} por correo. ` +
          `Las que no salieron siguen siendo válidas: entrégalas tú desde aquí.`,
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
