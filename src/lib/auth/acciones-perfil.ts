"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esquemaCambioContrasena,
  esquemaCambioCorreo,
  esquemaDatosPersonales,
  esquemaEliminacion,
  esquemaPreferencias,
} from "@/lib/validacion/perfil";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Acciones de «Mis datos» (SPEC.md §7.5).
 *
 * Guardado explícito por sección: cada formulario se envía por su cuenta. El
 * autoguardado en datos de identidad es mala idea — una persona que empieza a
 * corregir su documento y se arrepiente no debería haber escrito ya la mitad.
 */

async function usuarioActual() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  return { supabase, user };
}

export async function guardarDatosPersonales(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaDatosPersonales.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    telefono: formData.get("telefono"),
    fecha_nacimiento: formData.get("fecha_nacimiento"),
    documento: formData.get("documento"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const { supabase, user } = await usuarioActual();

  // RLS limita la fila y los permisos por columna limitan los campos: aunque
  // se colara un `role` en el FormData, la base rechazaría la escritura.
  const { error } = await supabase
    .from("profiles")
    .update(datos.data)
    .eq("id", user.id);

  if (error) {
    return { ok: false, mensaje: "No pudimos guardar los cambios." };
  }

  revalidatePath("/mis-datos");
  return { ok: true, mensaje: "Datos actualizados" };
}

export async function guardarPreferencias(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaPreferencias.safeParse({
    timezone: formData.get("timezone"),
    recordatorios_email: formData.get("recordatorios_email") === "on",
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const { supabase, user } = await usuarioActual();
  const { error } = await supabase
    .from("profiles")
    .update(datos.data)
    .eq("id", user.id);

  if (error) {
    return { ok: false, mensaje: "No pudimos guardar tus preferencias." };
  }

  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Preferencias actualizadas" };
}

export async function cambiarCorreo(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCambioCorreo.safeParse({
    correo: formData.get("correo"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const { supabase } = await usuarioActual();
  const encabezados = await headers();
  const origen =
    encabezados.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { error } = await supabase.auth.updateUser(
    { email: datos.data.correo },
    { emailRedirectTo: `${origen}/auth/callback?siguiente=/mis-datos` },
  );

  if (error) {
    return {
      ok: false,
      mensaje: "No pudimos iniciar el cambio de correo. Inténtalo de nuevo.",
    };
  }

  // El correo NO cambia hasta que se confirma desde ambas direcciones. Decirlo
  // aquí evita que alguien crea que ya puede entrar con el nuevo.
  return {
    ok: true,
    mensaje:
      "Te enviamos un enlace de confirmación a la dirección nueva. Tu correo actual seguirá funcionando hasta que lo confirmes.",
  };
}

export async function cambiarContrasena(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCambioContrasena.safeParse({
    actual: formData.get("actual"),
    nueva: formData.get("nueva"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const { supabase, user } = await usuarioActual();

  /*
   * Supabase permite cambiar la contraseña sin pedir la anterior. No basta:
   * quien encuentre una sesión abierta en un equipo compartido podría cambiarla
   * y quedarse con la cuenta. Se vuelve a autenticar con la contraseña actual
   * antes de aceptar la nueva.
   */
  const { error: errorActual } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: datos.data.actual,
  });

  if (errorActual) {
    return {
      ok: false,
      errores: { actual: "La contraseña actual no coincide" },
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: datos.data.nueva,
  });

  if (error) {
    return { ok: false, mensaje: "No pudimos cambiar la contraseña." };
  }

  return { ok: true, mensaje: "Contraseña actualizada" };
}

export async function solicitarEliminacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaEliminacion.safeParse({
    motivo: formData.get("motivo"),
    confirmacion: formData.get("confirmacion"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const { supabase, user } = await usuarioActual();

  const { error } = await supabase.from("account_deletion_requests").insert({
    user_id: user.id,
    motivo: datos.data.motivo,
    status: "solicitada",
  });

  // 23505: ya hay una solicitud abierta. Pedirlo dos veces no debe parecer un
  // fallo: el resultado que la persona quería —que conste— ya está.
  if (error && error.code !== "23505") {
    return {
      ok: false,
      mensaje: "No pudimos registrar la solicitud. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/mis-datos");
  return {
    ok: true,
    mensaje:
      "Solicitud registrada. Tu profesional la revisará y se pondrá en contacto contigo.",
  };
}
