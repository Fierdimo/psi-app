"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Completar el alta de una cuenta que se quedó sin empresa.
 *
 * El camino normal no pasa por aquí: desde la migración 0058 la organización
 * nace con la cuenta, en el mismo disparador y en la misma transacción. Esto
 * cubre lo que queda fuera de ese camino —una cuenta creada por la API de
 * administración, un registro sin datos de empresa— y sin ello esas cuentas
 * quedarían en un bucle: el área de empresa las rebota por no tener
 * organización, y las rebota hacia el área de empresa.
 */
const esquema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la empresa")
    .max(160, "El nombre es demasiado largo"),
  nit: z
    .string()
    .trim()
    .max(40, "El NIT es demasiado largo")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  telefono: z
    .string()
    .trim()
    .max(40, "El teléfono es demasiado largo")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function completarAltaDeEmpresa(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquema.safeParse({
    nombre: formData.get("nombre"),
    nit: formData.get("nit"),
    telefono: formData.get("telefono"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingresar");

  const { error } = await supabase.rpc("registrar_empresa", {
    p_nombre: datos.data.nombre,
    p_nit: datos.data.nit,
    p_contacto_nombre: null,
    // El correo de la cuenta es el canal de contacto, igual que en el alta
    // normal: el pago se resuelve fuera y sin canal la solicitud se queda
    // muerta en la bandeja.
    p_contacto_email: user.email,
    p_contacto_telefono: datos.data.telefono,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    return {
      ok: false,
      mensaje: error.hint ? `${limpio} ${error.hint}` : limpio,
    };
  }

  // El layout se resolvió hace un instante como «esta cuenta no tiene empresa».
  revalidatePath("/", "layout");
  redirect("/empresa");
}
