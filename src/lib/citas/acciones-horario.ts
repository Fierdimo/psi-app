"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresDeZod, type EstadoFormulario } from "@/lib/validacion/auth";

/**
 * La jornada de la consulta.
 *
 * Hasta ahora la duración de una cita la elegía quien la pedía, así que la
 * agenda del profesional la componían terceros. Con esto la declara él una vez
 * y de ahí salen las franjas: es la única forma de responder a «¿a cuánta
 * gente puedo atender el jueves?».
 */
const esquema = z
  .object({
    inicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
    fin: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
    duracion: z.coerce
      .number()
      .int()
      .min(5, "Un bloque de menos de cinco minutos no sirve para nada")
      .max(480, "Un bloque no puede pasar de ocho horas"),
    pausaInicio: z.string().optional(),
    pausaFin: z.string().optional(),
    dias: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, "Elige al menos un día"),
  })
  .refine((v) => v.fin > v.inicio, {
    message: "La hora de salida tiene que ser posterior a la de entrada",
    path: ["fin"],
  })
  .refine((v) => !v.pausaInicio === !v.pausaFin, {
    // Media pausa deja franjas fantasma: se exige el par completo o ninguno.
    message: "Indica el principio y el final de la pausa, o ninguno de los dos",
    path: ["pausaFin"],
  })
  .refine((v) => !v.pausaInicio || !v.pausaFin || v.pausaFin > v.pausaInicio, {
    message: "La pausa tiene que terminar después de empezar",
    path: ["pausaFin"],
  });

export async function actualizarHorario(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirProfesional();

  const analisis = esquema.safeParse({
    inicio: formData.get("inicio"),
    fin: formData.get("fin"),
    duracion: formData.get("duracion"),
    pausaInicio: String(formData.get("pausaInicio") ?? "") || undefined,
    pausaFin: String(formData.get("pausaFin") ?? "") || undefined,
    dias: formData.getAll("dias"),
  });

  if (!analisis.success) {
    return { ok: false, errores: erroresDeZod(analisis.error) };
  }

  const datos = analisis.data;
  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("actualizar_horario", {
    p_inicio: datos.inicio,
    p_fin: datos.fin,
    p_duracion: datos.duracion,
    p_pausa_inicio: datos.pausaInicio ?? null,
    p_pausa_fin: datos.pausaFin ?? null,
    p_dias: datos.dias,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    return { ok: false, mensaje: limpio };
  }

  revalidatePath("/profesional/consulta");
  revalidatePath("/profesional/agenda");

  /*
   * Se dice cuántas franjas salen, no «guardado».
   *
   * «Guardado» no responde a la pregunta con la que se entra aquí, que es
   * cuánta gente cabe en un día. El número lo dice de una vez y delata al
   * instante una pausa mal puesta o un bloque demasiado largo.
   */
  const minutos =
    Number(datos.fin.slice(0, 2)) * 60 +
    Number(datos.fin.slice(3)) -
    (Number(datos.inicio.slice(0, 2)) * 60 + Number(datos.inicio.slice(3)));

  const pausa =
    datos.pausaInicio && datos.pausaFin
      ? Number(datos.pausaFin.slice(0, 2)) * 60 +
        Number(datos.pausaFin.slice(3)) -
        (Number(datos.pausaInicio.slice(0, 2)) * 60 +
          Number(datos.pausaInicio.slice(3)))
      : 0;

  const franjas = Math.floor((minutos - pausa) / datos.duracion);

  return {
    ok: true,
    mensaje: `Horario guardado: ${franjas} ${franjas === 1 ? "cita" : "citas"} por día de atención.`,
  };
}
