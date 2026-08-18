import { headers } from "next/headers";

import { EnlacesDeAcceso } from "@/components/citas/enlaces-de-acceso";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EnlaceDeAcceso } from "@/lib/validacion/auth";

/**
 * Los pases de una sesión, sin botón que los pida.
 *
 * Antes había un «Generar pases» porque el testigo solo existía en claro el
 * instante de emitirlo. Eso obligaba a acordarse de pulsarlo, creaba una
 * invitación nueva por pulsación, y hacía que el enlace del correo y el del QR
 * fueran distintos. Ahora los accesos nacen con la sesión confirmada y esto
 * solo los lee: entrar dos veces a la pantalla no cambia nada.
 *
 * Se lee en el servidor, con la sesión de quien mira. Quién puede verlos lo
 * decide `pases_de_acceso`: el profesional o la empresa dueña.
 */
export async function PasesDeSesion({
  citaId,
  titulo,
  nota,
}: {
  citaId: string;
  titulo?: string;
  nota?: string;
}) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("pases_de_acceso", {
    p_appointment_id: citaId,
  });

  /*
   * Un fallo aquí no rompe la pantalla.
   *
   * Los pases son una parte de la vista de una sesión, no la vista entera: si
   * la consulta falla —una sesión que acaba de cancelarse, por ejemplo— el
   * resto sigue siendo útil y quien mira no se queda con un error en blanco.
   */
  if (error || !data || data.length === 0) return null;

  const encabezados = await headers();
  const origen =
    encabezados.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const enlaces: EnlaceDeAcceso[] = (
    data as {
      nombre: string | null;
      apellidos: string | null;
      documento: string | null;
      email: string | null;
      tiene_cuenta: boolean;
      token: string | null;
    }[]
  ).map((f) => ({
    nombre:
      [f.nombre, f.apellidos].filter(Boolean).join(" ") ||
      f.email ||
      (f.documento ?? "Sin nombre"),
    /*
     * El documento como respaldo del correo.
     *
     * Quien reparte necesita saber a quién le da cada pase, y en una lista de
     * cincuenta operarios hay nombres repetidos. El correo puede faltar —una
     * ficha se carga con documento, no siempre con dirección—; el documento no.
     */
    correo: f.email ?? (f.documento ? `Doc. ${f.documento}` : ""),
    /*
     * Quien ya tiene cuenta no lleva testigo: su evaluación le espera dentro y
     * un enlace directo le pediría la contraseña igual. Lo que necesita saber
     * es que entre con su correo.
     */
    enlace: f.token ? `${origen}/invitacion/${f.token}` : `${origen}/ingresar`,
    yaTieneCuenta: f.tiene_cuenta,
    // Ni cuenta ni testigo. No debería ocurrir —se preparan al confirmar— pero
    // callarlo dejaría a esa persona sin pase y sin explicación.
    sinPase: !f.tiene_cuenta && !f.token,
  }));

  return <EnlacesDeAcceso enlaces={enlaces} titulo={titulo} nota={nota} />;
}
