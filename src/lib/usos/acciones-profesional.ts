"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirProfesional } from "@/lib/auth/perfil";
import { enviarCorreo } from "@/lib/correo/enviar";
import { usosResueltos } from "@/lib/correo/plantillas";
import { origenDeLaPeticion } from "@/lib/http/origen";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Resolver una compra de usos.
 *
 * Es lo único que el profesional decide en el circuito nuevo: la empresa
 * encarga sus evaluaciones sola contra el saldo, y el informe sale sin firma.
 * Autorizar es, literalmente, la única forma de que entre saldo al sistema.
 */

function mensajeDeError(error: { message: string; hint?: string | null }) {
  const limpio = error.message.replace(/^.*?:\s*/, "");
  return error.hint ? `${limpio} ${error.hint}` : limpio;
}

function refrescar() {
  revalidatePath("/profesional/solicitudes");
  revalidatePath("/profesional/empresas");
  revalidatePath("/empresa");
  revalidatePath("/empresa/usos");
}

const esquemaAutorizar = z.object({
  orden: z.guid("Solicitud no válida"),
  referencia: z
    .string()
    .trim()
    .max(120, "La referencia es demasiado larga")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

const esquemaRechazar = z.object({
  orden: z.guid("Solicitud no válida"),
  motivo: z
    .string()
    .trim()
    .min(4, "Dile a la empresa por qué, aunque sea en una línea")
    .max(500, "El motivo no puede pasar de 500 caracteres"),
});

export async function autorizarUsos(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const datos = esquemaAutorizar.safeParse({
    orden: formData.get("orden"),
    referencia: formData.get("referencia"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("autorizar_usos", {
    p_order: datos.data.orden,
    p_referencia: datos.data.referencia,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  await avisarDeLaResolucion(datos.data.orden);
  refrescar();

  return { ok: true, mensaje: "Autorizado. El saldo ya está en su cuenta." };
}

export async function rechazarUsos(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const datos = esquemaRechazar.safeParse({
    orden: formData.get("orden"),
    motivo: formData.get("motivo"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("rechazar_usos", {
    p_order: datos.data.orden,
    p_motivo: datos.data.motivo,
  });

  if (error) return { ok: false, mensaje: mensajeDeError(error) };

  await avisarDeLaResolucion(datos.data.orden);
  refrescar();

  return { ok: true, mensaje: "Rechazado. La empresa recibe el motivo." };
}

/**
 * El aviso a la empresa, en los dos sentidos.
 *
 * NUNCA LANZA, como el resto del correo de esta aplicación: la decisión ya
 * está tomada y escrita, y deshacerla porque un servidor de correo no
 * respondió sería castigar a quien no tuvo nada que ver.
 *
 * Se lee con la clave de servicio porque hace falta el correo de contacto de
 * la organización, y ese dato no lo devuelve la orden.
 */
async function avisarDeLaResolucion(orden: string): Promise<void> {
  try {
    const admin = crearClienteAdmin();

    const { data } = await admin
      .from("ticket_orders")
      .select(
        "cantidad, status, motivo, organizacion:organizations(nombre, contacto_nombre, contacto_email)",
      )
      .eq("id", orden)
      .maybeSingle();

    if (!data) return;

    const uno = <T>(v: unknown): T | null =>
      Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

    const empresa = uno<{
      nombre: string;
      contacto_nombre: string | null;
      contacto_email: string | null;
    }>(data.organizacion);

    // Sin correo de contacto no hay a quién escribir. `registrar_empresa`
    // exige un canal, pero puede ser el teléfono.
    if (!empresa?.contacto_email) return;

    const origen = await origenDeLaPeticion();

    await enviarCorreo(
      { correo: empresa.contacto_email, nombre: empresa.contacto_nombre },
      usosResueltos({
        cantidad: data.cantidad,
        autorizada: data.status === "autorizada",
        motivo: data.motivo,
        enlace: `${origen}/empresa/usos`,
      }),
    );
  } catch (fallo) {
    console.error(
      "[usos] no se pudo avisar de la resolución:",
      fallo instanceof Error ? fallo.message : "fallo desconocido",
    );
  }
}
