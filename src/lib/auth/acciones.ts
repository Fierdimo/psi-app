"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CONSENTIMIENTO } from "@/lib/consentimiento";
import { origenDeLaPeticion } from "@/lib/http/origen";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  erroresDeZod,
  esquemaIngreso,
  esquemaNuevaContrasena,
  esquemaRecuperar,
  esquemaRegistro,
  type EstadoFormulario,
} from "@/lib/validacion/auth";

import { inicioSegunRol, tieneConsentimientoVigente, type Rol } from "./perfil";

/**
 * Mensaje único para cualquier fallo de credenciales.
 *
 * Nunca «ese correo no existe» ni «contraseña incorrecta»: la diferencia entre
 * ambos mensajes permite averiguar qué correos tienen cuenta en una plataforma
 * de atención psicológica, que ya es información sensible por sí sola.
 */
const CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos";

/**
 * ¿Ese destino es el espacio de atención del paciente?
 *
 * Es donde vive la relación clínica, y por tanto lo único que el
 * consentimiento informado cubre. Una invitación a una evaluación no lo es.
 */
function esAreaDeAtencion(destino: string) {
  return [
    "/panel",
    "/calendario",
    "/mis-datos",
    "/resultados",
    "/sesiones",
    "/recursos",
    "/documentos",
  ].some((r) => destino === r || destino.startsWith(`${r}/`));
}

/** Solo se acepta un destino interno, para no convertir el ingreso en un redirector abierto. */
function destinoSeguro(siguiente: string | null, rol: Rol) {
  if (siguiente?.startsWith("/") && !siguiente.startsWith("//")) {
    const esDeProfesional = siguiente.startsWith("/profesional/");
    if (esDeProfesional === (rol === "profesional")) return siguiente;
  }
  return inicioSegunRol(rol);
}

export async function ingresar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaIngreso.safeParse({
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: datos.data.correo,
    password: datos.data.contrasena,
  });

  if (error || !data.user) {
    return { ok: false, mensaje: CREDENCIALES_INVALIDAS };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const rol = (perfil?.role ?? "paciente") as Rol;
  const siguiente = formData.get("siguiente");

  // La sesión cambió: hay que descartar lo que el cliente tenga en caché de
  // cuando no había sesión, o los layouts privados se resolverían con datos
  // de otro momento.
  revalidatePath("/", "layout");

  /*
   * El destino se calcula AQUÍ, en un solo salto.
   *
   * La tentación es redirigir al panel y dejar que la puerta del
   * consentimiento actúe después. No funciona: tras la redirección de una
   * acción de servidor, las redirecciones posteriores del proxy o de un layout
   * cambian lo que se renderiza pero no siempre la URL del navegador, y la
   * persona acaba leyendo un documento legal mientras la barra de direcciones
   * dice «/panel». Decidir el destino de una vez evita toda esa clase de
   * incoherencias.
   */
  // Entrar por la puerta equivocada NO falla: redirige. Ver SPEC.md §5.1.
  const destino = destinoSeguro(
    typeof siguiente === "string" ? siguiente : null,
    rol,
  );

  /*
   * El consentimiento se exige por lo que se va a hacer, no por quién eres.
   *
   * Solo al paciente —el profesional lo recibe, no lo otorga— y solo si va a
   * entrar a su espacio de atención. Quien llega desde una invitación va a
   * ACTIVAR SU ACCESO a una evaluación que encargó una empresa, y pedirle ahí
   * un consentimiento de tratamiento psicológico es un error de categoría:
   * consiente otra cosa, en otro momento y ante otro destinatario.
   *
   * Sin esta distinción, el enlace de la invitación desembocaba en un
   * documento clínico y la persona no podía completar lo único que se le
   * había pedido.
   */
  const exigeConsentimiento = rol === "paciente" && esAreaDeAtencion(destino);

  if (
    exigeConsentimiento &&
    !(await tieneConsentimientoVigente(data.user.id))
  ) {
    redirect("/consentimiento");
  }

  redirect(destino);
}

export async function registrar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaRegistro.safeParse({
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    documento: formData.get("documento"),
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const origen = await origenDeLaPeticion();

  // El destino viaja dentro del enlace de verificación para que quien se
  // registra desde una invitación vuelva a ella y no a su panel.
  const siguiente = formData.get("siguiente");
  const retorno =
    typeof siguiente === "string" &&
    siguiente.startsWith("/") &&
    !siguiente.startsWith("//")
      ? `?siguiente=${encodeURIComponent(siguiente)}`
      : "";

  const { error } = await supabase.auth.signUp({
    email: datos.data.correo,
    password: datos.data.contrasena,
    options: {
      emailRedirectTo: `${origen}/auth/callback${retorno}`,
      data: {
        nombre: datos.data.nombre,
        apellidos: datos.data.apellidos,
        documento: datos.data.documento,
      },
    },
  });

  if (error) {
    /*
     * Un solo mensaje, y no por pereza: por dos razones que se refuerzan.
     *
     * La primera es de privacidad. El documento es único en toda la
     * plataforma, pero un choque NO se confirma. Las cédulas son enumerables,
     * así que decir «ya existe una cuenta con ese documento» convertiría el
     * registro en un detector de pacientes de una consulta de psicología. Es
     * la misma razón por la que el ingreso da un único mensaje ante un correo
     * inexistente y ante una contraseña equivocada.
     *
     * La segunda es que NO SE PUEDE distinguir aunque se quisiera. El servidor
     * de autenticación traga el error de Postgres y devuelve siempre
     * «Database error saving new user», sin el nombre de la restricción — se
     * comprobó registrando una cédula repetida y leyendo lo que llega. Una
     * cédula duplicada y una base caída son indistinguibles desde aquí.
     *
     * De ahí el texto: cubre los dos casos y, sobre todo, no deja a nadie en
     * un callejón sin salida.
     */
    return {
      ok: false,
      mensaje:
        "No pudimos crear la cuenta con esos datos. Si ya tienes una, entra o recupera tu contraseña; si no, inténtalo de nuevo en un momento.",
    };
  }

  // Con verificación de correo activada, Supabase responde igual exista o no
  // la cuenta. Ese comportamiento se mantiene a propósito: la pantalla de
  // «revisa tu correo» no revela si el correo ya estaba registrado.
  redirect("/verificar-correo");
}

export async function solicitarRecuperacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaRecuperar.safeParse({ correo: formData.get("correo") });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const origen = await origenDeLaPeticion();

  await supabase.auth.resetPasswordForEmail(datos.data.correo, {
    redirectTo: `${origen}/auth/callback?siguiente=/recuperar/nueva`,
  });

  // Respuesta idéntica exista o no la cuenta, y se ignora deliberadamente
  // cualquier error: informar de que «ese correo no está registrado» permite
  // enumerar pacientes de la consulta.
  return {
    ok: true,
    mensaje:
      "Si ese correo tiene una cuenta, te enviamos un enlace para restablecer la contraseña. Revisa también la carpeta de no deseados.",
  };
}

export async function establecerNuevaContrasena(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaNuevaContrasena.safeParse({
    contrasena: formData.get("contrasena"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({
    password: datos.data.contrasena,
  });

  if (error) {
    return {
      ok: false,
      mensaje:
        "El enlace de recuperación caducó o ya se usó. Solicita uno nuevo.",
    };
  }

  redirect("/panel");
}

/**
 * Registra la aceptación del consentimiento informado.
 *
 * Escribe con la clave de servicio a propósito: la IP y el agente deben venir
 * de la petición real. Si el registro lo hiciera el cliente, esos campos serían
 * lo que el navegador quisiera declarar y no servirían como evidencia.
 */
export async function aceptarConsentimiento(): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const encabezados = await headers();
  const ip =
    encabezados.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    encabezados.get("x-real-ip");

  const admin = crearClienteAdmin();
  const { error } = await admin.from("consents").insert({
    user_id: user.id,
    document_key: CONSENTIMIENTO.clave,
    version: CONSENTIMIENTO.version,
    ip: ip || null,
    user_agent: encabezados.get("user-agent"),
  });

  // Aceptar dos veces no es un error: la restricción única lo impide y el
  // resultado deseado —que conste la aceptación— ya se cumplió.
  if (error && error.code !== "23505") {
    return {
      ok: false,
      mensaje: "No pudimos registrar tu aceptación. Inténtalo de nuevo.",
    };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Imprescindible. El cliente guarda en caché las respuestas de los layouts,
  // y el layout privado se resolvió hace un instante como «redirige al
  // consentimiento». Sin invalidarla, la persona acepta, aterriza en su área
  // y vuelve a ver la pantalla de consentimiento servida desde esa caché.
  revalidatePath("/", "layout");

  redirect(inicioSegunRol((perfil?.role ?? "paciente") as Rol));
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();

  // Por el mismo motivo: sin invalidar, las pantallas privadas ya renderizadas
  // pueden seguir viéndose desde la caché del cliente después de salir.
  revalidatePath("/", "layout");

  redirect("/ingresar");
}
