"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toBuffer as qrComoPng } from "qrcode";
import { z } from "zod";

import { exigirEmpresa } from "@/lib/auth/perfil";
import { enviarCorreo } from "@/lib/correo/enviar";
import { convocatoriaEvaluacion } from "@/lib/correo/plantillas";
import { origenDeLaPeticion } from "@/lib/http/origen";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Acciones de usos y evaluaciones encargadas.
 *
 * Como el resto de la aplicación, son fachadas sobre funciones de Postgres.
 * `exigirEmpresa()` sirve para redirigir a quien no debería estar viendo la
 * pantalla, no como control de acceso: si alguien saltara esta capa,
 * `solicitar_evaluacion` seguiría negándose y el saldo seguiría intacto.
 */

/** Limpia el prefijo que PostgREST antepone y le pega su pista. */
function mensajeDeError(error: { message: string; hint?: string | null }) {
  const limpio = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${limpio} ${error.hint}` : limpio;
}

function refrescar() {
  revalidatePath("/empresa");
  revalidatePath("/empresa/usos");
  revalidatePath("/empresa/evaluaciones");
  // La solicitud entra en la bandeja del profesional.
  revalidatePath("/profesional/solicitudes");
  revalidatePath("/profesional/empresas");
}

// =============================================================================
// Comprar usos
// =============================================================================

const esquemaUsos = z.object({
  cantidad: z.coerce
    .number()
    .int("Pide un número entero de usos")
    .min(1, "Pide al menos un uso")
    .max(1000, "Son demasiados para una sola solicitud"),
  nota: z
    .string()
    .trim()
    .max(500, "La nota no puede pasar de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function solicitarUsos(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirEmpresa();

  const datos = esquemaUsos.safeParse({
    cantidad: formData.get("cantidad"),
    nota: formData.get("nota"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("solicitar_usos", {
    p_cantidad: datos.data.cantidad,
    p_nota: datos.data.nota,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  refrescar();
  return {
    ok: true,
    mensaje:
      "Solicitud enviada. El profesional la autorizará en cuanto confirme el pago, y entonces verás el saldo aquí.",
  };
}

// =============================================================================
// Encargar una evaluación
// =============================================================================

const esquemaEvaluacion = z.object({
  prueba: z.string().trim().min(1, "Elige una prueba"),
  nombre: z.string().trim().min(2, "Falta el nombre"),
  apellidos: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  email: z.email("Correo no válido"),
  /*
   * El documento es opcional y NO se valida contra nada.
   *
   * Dejó de ser identidad cuando dejaron de existir las cuentas: hoy es una
   * etiqueta que la empresa se pone a sí misma para distinguir dos homónimos
   * en una tanda de cuarenta. Exigir un formato o una longitud mínima sería
   * inventarle un requisito a un dato que no gobierna nada.
   */
  documento: z
    .string()
    .trim()
    .max(30, "El documento es demasiado largo")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function pedirEvaluacion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const perfil = await exigirEmpresa();

  const datos = esquemaEvaluacion.safeParse({
    prueba: formData.get("prueba"),
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    email: formData.get("email"),
    documento: formData.get("documento"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();

  /*
   * Una sola llamada, y dentro una sola transacción.
   *
   * Comprueba el saldo, guarda los datos de quien responde, crea la
   * evaluación, descuenta el uso y emite el pase. Si algo falla, no queda
   * nada: ni ficha suelta, ni saldo perdido, ni un pase que no abre nada.
   */
  const { data, error } = await supabase.rpc("solicitar_evaluacion", {
    p_assessment_clave: datos.data.prueba,
    p_nombre: datos.data.nombre,
    p_email: datos.data.email,
    p_apellidos: datos.data.apellidos,
    p_documento: datos.data.documento,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  const creada = (data ?? [])[0] as
    { assignment_id: string; token: string; vence_at: string } | undefined;

  if (!creada) {
    return {
      ok: false,
      mensaje: "No pudimos crear la evaluación. Inténtalo de nuevo.",
    };
  }

  const { enviado } = await enviarConvocatoria(
    creada.assignment_id,
    creada.token,
    creada.vence_at,
    perfil.timezone,
  );

  refrescar();

  /*
   * Se va a la ficha de la evaluación, SIEMPRE, salga o no el correo.
   *
   * El uso ya se gastó y el enlace ya existe: dejar a la empresa en el
   * formulario con un mensaje de error la haría pensar que no se creó nada, y
   * el gesto natural sería volver a enviarlo — gastando otro uso por la misma
   * persona. En la ficha están el enlace y el QR para repartirlos a mano.
   */
  redirect(
    `/empresa/evaluaciones/${creada.assignment_id}?nueva=1${enviado ? "" : "&correo=fallo"}`,
  );
}

/** Vuelve a mandar el mismo pase. No emite uno nuevo ni gasta otro uso. */
export async function reenviarPase(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const perfil = await exigirEmpresa();

  const evaluacion = String(formData.get("evaluacion") ?? "");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("pase_de_evaluacion", {
    p_assignment: evaluacion,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  const pase = (data ?? [])[0] as
    { token: string | null; vence_at: string | null } | undefined;

  if (!pase?.token || !pase.vence_at) {
    return {
      ok: false,
      mensaje:
        "Esta evaluación ya no tiene un enlace vivo. Si venció, hará falta encargarla de nuevo.",
    };
  }

  const { enviado } = await enviarConvocatoria(
    evaluacion,
    pase.token,
    pase.vence_at,
    perfil.timezone,
  );

  return enviado
    ? { ok: true, mensaje: "Enviado otra vez al mismo correo." }
    : {
        ok: false,
        mensaje:
          "No pudimos enviar el correo. El enlace de abajo sigue siendo válido: cópialo y hazlo llegar por otra vía.",
      };
}

// =============================================================================
// El correo de convocatoria
// =============================================================================

/**
 * Compone y manda la convocatoria de una evaluación.
 *
 * Se lee con la clave de servicio a propósito. No es un atajo de permisos —lo
 * que se va a leer ya lo puede ver esta empresa— sino que necesita juntar
 * cuatro tablas para armar un correo, y hacerlo con el cliente de sesión
 * significaría cuatro consultas sujetas a políticas para pintar un asunto.
 *
 * NUNCA LANZA. El uso ya se gastó y la evaluación ya existe; que el correo no
 * salga es un contratiempo, no un motivo para deshacer nada.
 */
async function enviarConvocatoria(
  asignacion: string,
  token: string,
  /** Lo que la base estampó, no lo que el servidor crea recordar. */
  venceISO: string,
  /** La de la empresa: la de quien responde no se conoce. */
  zona: string,
): Promise<{ enviado: boolean }> {
  try {
    const admin = crearClienteAdmin();

    const { data } = await admin
      .from("assignments")
      .select(
        "assessment:assessments(nombre), persona:organization_people(nombre, apellidos, email), organizacion:organizations(nombre)",
      )
      .eq("id", asignacion)
      .maybeSingle();

    if (!data) return { enviado: false };

    /*
     * PostgREST devuelve las relaciones como objeto o como lista de uno según
     * cómo deduzca la cardinalidad, y esa deducción cambia entre versiones.
     * Se normaliza aquí en vez de confiar en la forma de hoy.
     */
    const uno = <T>(v: unknown): T | null =>
      Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

    const prueba = uno<{ nombre: string }>(data.assessment);
    const persona = uno<{
      nombre: string;
      apellidos: string | null;
      email: string;
    }>(data.persona);
    const empresa = uno<{ nombre: string }>(data.organizacion);

    if (!persona?.email || !empresa?.nombre) return { enviado: false };

    const origen = await origenDeLaPeticion();
    const enlace = `${origen}/prueba/${token}`;

    /*
     * El QR se genera aquí y no en el navegador.
     *
     * En la pantalla se dibuja en el cliente porque ahí se puede; en un correo
     * no hay JavaScript que valga. Fondo blanco explícito: un QR sobre fondo
     * oscuro no lo lee ningún teléfono, y algunos clientes de correo pintan
     * fondo oscuro por su cuenta.
     */
    const qr = await qrComoPng(enlace, {
      width: 320,
      margin: 1,
      /*
       * Los mismos valores que el QR de pantalla, y por el mismo motivo que
       * allí: el contraste máximo es un requisito del formato, no una
       * decisión de diseño. Un QR con los colores de la marca no lo lee la
       * mitad de los lectores, y este además puede acabar impreso.
       */
      // color-guard-ignore
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((b) => b.toString("base64"))
      .catch(() => null);

    return await enviarCorreo(
      { correo: persona.email, nombre: persona.nombre },
      convocatoriaEvaluacion({
        nombre: persona.nombre,
        empresa: empresa.nombre,
        instrumento: prueba?.nombre ?? "Evaluación",
        enlace,
        qr,
        venceISO,
        zona,
      }),
    );
  } catch (fallo) {
    console.error(
      "[convocatoria] no se pudo componer el correo:",
      fallo instanceof Error ? fallo.message : "fallo desconocido",
    );
    return { enviado: false };
  }
}
