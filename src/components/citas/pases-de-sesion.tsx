import { EnlacesDeAcceso } from "@/components/citas/enlaces-de-acceso";
import { crearClienteServidor } from "@/lib/supabase/server";
import { origenDeLaPeticion } from "@/lib/http/origen";
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
  zona,
  titulo,
  nota,
}: {
  citaId: string;
  /** La de la consulta. Ver la nota en `EnlacesDeAcceso`. */
  zona: string;
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

  const origen = await origenDeLaPeticion();

  const enlaces: EnlaceDeAcceso[] = (
    data as {
      nombre: string | null;
      apellidos: string | null;
      documento: string | null;
      email: string | null;
      starts_at: string | null;
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
     * El pase lleva DIRECTO a la prueba, y lo lleva todo el mundo.
     *
     * Aquí ya no se sabe quién tiene cuenta y quién no, a propósito: la
     * empresa no debe enterarse de eso por esta pantalla. Sin testigo no hay
     * enlace que dar, y eso es lo que `sinPase` dice.
     */
    enlace: f.token ? `${origen}/prueba/${f.token}` : "",
    // Ni cuenta ni testigo. No debería ocurrir —se preparan al confirmar— pero
    // callarlo dejaría a esa persona sin pase y sin explicación.
    hora: f.starts_at,
    sinPase: !f.token,
  }));

  return (
    <EnlacesDeAcceso
      enlaces={enlaces}
      zona={zona}
      titulo={titulo}
      nota={nota}
    />
  );
}
