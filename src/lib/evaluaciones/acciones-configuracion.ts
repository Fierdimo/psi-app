"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * La configuración de los instrumentos.
 *
 * Hoy tiene un solo ajuste —la ventana para responder— y vive en su propio
 * archivo igualmente: es de las evaluaciones, no de la agenda, y meterlo en
 * `acciones-horario` lo habría atado a un módulo que se retira.
 */

const esquema = z.object({
  clave: z.string().trim().min(1, "Instrumento no válido"),
  /*
   * Vacío significa «sin límite», no «cero».
   *
   * Un campo numérico vacío llega como cadena vacía, y `z.coerce.number()` la
   * convierte en 0 sin rechistar: sin este paso previo, dejar el campo en
   * blanco pediría una ventana de cero minutos y la base la rechazaría con un
   * mensaje sobre el mínimo, que no es lo que pasó.
   */
  minutos: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine(
      (v) => v === null || Number.isInteger(v),
      "Escribe un número entero",
    )
    .refine(
      (v) => v === null || (v >= 5 && v <= 1440),
      "Entre 5 minutos y 24 horas (1440), o vacío para no poner límite",
    ),
});

export async function actualizarVentana(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const datos = esquema.safeParse({
    clave: formData.get("clave"),
    minutos: formData.get("minutos"),
  });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("actualizar_ventana", {
    p_clave: datos.data.clave,
    p_minutos: datos.data.minutos,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    return {
      ok: false,
      mensaje: error.hint ? `${limpio} ${error.hint}` : limpio,
    };
  }

  revalidatePath("/profesional/consulta");

  return {
    ok: true,
    mensaje:
      datos.data.minutos === null
        ? "Guardado. Esta prueba deja de tener tiempo límite."
        : `Guardado. Quien empiece tendrá ${datos.data.minutos} minutos para terminar.`,
  };
}

/* ============================================================================
   El plazo para empezar

   Va en los ajustes de la consulta y no en el instrumento, y no por descuido:
   cuánto tarda una empresa en conseguir que su gente se siente delante de una
   pantalla no depende de qué prueba sea. La ventana para TERMINAR sí, y por
   eso vive en el catálogo.
   ========================================================================== */

const esquemaPlazo = z.object({
  dias: z.coerce
    .number()
    .int("Escribe un número entero de días")
    .min(
      1,
      "Al menos un día: una empresa que convoca por la tarde necesita que el enlace aguante la noche",
    )
    .max(365, "Como mucho un año"),
});

export async function actualizarPlazoParaEmpezar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const datos = esquemaPlazo.safeParse({ dias: formData.get("dias") });

  if (!datos.success) {
    return { ok: false, errores: erroresDeZod(datos.error) };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("actualizar_plazo_para_empezar", {
    p_dias: datos.data.dias,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    return {
      ok: false,
      mensaje: error.hint ? `${limpio} ${error.hint}` : limpio,
    };
  }

  revalidatePath("/profesional/consulta");

  return {
    ok: true,
    /*
     * Se dice a qué NO afecta.
     *
     * Es la pregunta inmediata de quien acaba de acortar el plazo: «¿acabo de
     * cerrarle el enlace a los cuarenta que convocamos ayer?». No: la fecha se
     * estampa al crear cada evaluación.
     */
    mensaje: `Guardado. Los enlaces que se envíen a partir de ahora durarán ${datos.data.dias} días. Los ya enviados conservan la fecha que se les prometió.`,
  };
}
