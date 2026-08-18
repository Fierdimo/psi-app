"use server";

import { headers } from "next/headers";

import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EnlaceDeAcceso, EstadoFormulario } from "@/lib/validacion/auth";

/**
 * Pases de acceso para repartir a mano.
 *
 * El correo es el eslabón que más se rompe —direcciones viejas, filtros de
 * spam corporativos, o sencillamente no haber contratado servicio de correo— y
 * cuando se rompe la persona llega el día de su sesión y no puede entrar.
 *
 * Esto abre la otra vía: la empresa, que ya tiene su propio canal con su gente,
 * reparte un pase por convocado. No sustituye al correo; es lo que queda
 * cuando el correo no está.
 *
 * Quién puede pedirlos lo decide la base (`pases_de_acceso`): el profesional o
 * la empresa dueña de la sesión, y solo si está confirmada. Aquí no se repite
 * esa comprobación —duplicarla es tener dos sitios que pueden discrepar— pero
 * sí se exige sesión, para no llamar a la base como anónimo.
 */
export async function generarPases(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const perfil = await obtenerPerfil();
  if (!perfil) return { ok: false, mensaje: "Necesitas haber entrado." };

  const cita = String(formData.get("cita") ?? "");
  if (!cita) return { ok: false, mensaje: "Sesión no válida." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("pases_de_acceso", {
    p_appointment_id: cita,
  });

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, "");
    const pista = (error as { hint?: string | null }).hint;
    return { ok: false, mensaje: pista ? `${limpio} ${pista}` : limpio };
  }

  const filas = (data ?? []) as {
    person_id: string;
    nombre: string | null;
    apellidos: string | null;
    documento: string | null;
    email: string | null;
    tiene_cuenta: boolean;
    token: string | null;
  }[];

  if (filas.length === 0) {
    return {
      ok: true,
      mensaje: "Esta sesión no tiene a nadie convocado todavía.",
    };
  }

  const encabezados = await headers();
  const origen =
    encabezados.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const enlaces: EnlaceDeAcceso[] = filas.map((f) => ({
    nombre:
      [f.nombre, f.apellidos].filter(Boolean).join(" ") ||
      f.email ||
      (f.documento ?? "Sin nombre"),
    /*
     * El documento como respaldo del correo.
     *
     * Quien reparte los pases necesita saber a quién le da cada uno, y en una
     * lista de cincuenta operarios hay nombres repetidos. El correo puede
     * faltar —una ficha se carga con documento, no siempre con dirección—; el
     * documento nunca.
     */
    correo: f.email ?? (f.documento ? `Doc. ${f.documento}` : ""),
    /*
     * Sin testigo, el pase es la puerta de entrada normal.
     *
     * A quien ya tiene cuenta no se le puede dar un enlace directo a su
     * evaluación: se le pediría la contraseña igual, y el enlace no le ahorra
     * un solo paso. Lo que necesita saber es que entre con su correo.
     */
    enlace: f.token ? `${origen}/invitacion/${f.token}` : `${origen}/ingresar`,
    yaTieneCuenta: f.tiene_cuenta,
  }));

  const nuevos = filas.filter((f) => !f.tiene_cuenta).length;
  const conCuenta = filas.length - nuevos;

  const partes = [
    nuevos > 0
      ? `${nuevos} ${nuevos === 1 ? "invitación" : "invitaciones"} para crear cuenta`
      : null,
    conCuenta > 0
      ? `${conCuenta} ${conCuenta === 1 ? "persona ya tiene" : "personas ya tienen"} cuenta`
      : null,
  ].filter(Boolean);

  return {
    ok: true,
    enlaces,
    mensaje: `${partes.join(" · ")}. Los enlaces con invitación solo se ven ahora: si cierras esta pantalla hay que generarlos de nuevo.`,
  };
}
