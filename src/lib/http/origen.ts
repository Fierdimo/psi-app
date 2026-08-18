import "server-only";

import { headers } from "next/headers";

/**
 * La dirección base de esta instalación, vista desde el navegador.
 *
 * Existe porque `origin` NO SIRVE SOLO. Ese encabezado lo manda el navegador
 * en los envíos de formulario y en las llamadas cruzadas, pero no al pedir una
 * página: al pintar una pantalla no hay ninguno. El síntoma fue un enlace de
 * invitación sin host —«/invitacion/abc…»— y un QR que no llevaba a ninguna
 * parte, porque un QR con una ruta relativa no significa nada fuera de esta
 * pestaña.
 *
 * El orden de preferencia no es caprichoso:
 *
 *   1. `NEXT_PUBLIC_SITE_URL`, si está. Es la única fuente que no depende de
 *      cómo llegó la petición, y la única correcta cuando el enlace se manda
 *      por correo: quien lo abra puede estar en otra red.
 *   2. Los encabezados de reenvío (`x-forwarded-*`), que es lo que ponen los
 *      proxys y las plataformas de despliegue.
 *   3. `host`, para el servidor local.
 *   4. `origin`, que en un envío de formulario sí llega.
 *
 * Devuelve sin barra final, para poder concatenar rutas que empiezan por ella.
 */
export async function origenDeLaPeticion(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurado) return configurado.replace(/\/+$/, "");

  const encabezados = await headers();

  const anfitrion =
    encabezados.get("x-forwarded-host") ?? encabezados.get("host");

  if (anfitrion) {
    /*
     * En local se sirve por HTTP; fuera, por HTTPS.
     *
     * Fijar «https» sin mirar rompería el enlace en desarrollo, y fijar
     * «http» mandaría a la gente a una dirección que el navegador bloquea.
     */
    const protocolo =
      encabezados.get("x-forwarded-proto") ??
      (anfitrion.startsWith("localhost") || anfitrion.startsWith("127.0.0.1")
        ? "http"
        : "https");

    return `${protocolo}://${anfitrion}`;
  }

  return (encabezados.get("origin") ?? "").replace(/\/+$/, "");
}
