import "server-only";

import nodemailer from "nodemailer";

import type { Correo } from "./plantillas";

/**
 * Envío de correo transaccional.
 *
 * DOS CAMINOS, Y EL SITIO DONDE CORRA DECIDE CUÁL. No es indecisión: cada uno
 * es el correcto en un sitio distinto, y la decisión de dónde alojar esto no
 * debería obligar a reescribir el envío.
 *
 *   · Con `RESEND_API_KEY` se usa la API HTTP. Es lo que conviene en
 *     serverless —Vercel y parecidos—: allí no hay proceso vivo que reutilice
 *     conexiones, así que cada correo por SMTP paga otra vez el saludo, el TLS
 *     y la autenticación. Una tanda de quince invitaciones lo nota.
 *
 *   · Si no, se usa SMTP. Es lo que conviene en un servidor propio, donde el
 *     grupo de conexiones sí se reutiliza, y lo que permite cambiar de
 *     proveedor sin tocar código.
 *
 * En desarrollo gana SMTP porque no hay clave: los correos caen en el Mailpit
 * que levanta `supabase start`, junto a los de registro. Antes solo se
 * escribían en la consola y era imposible ver cómo quedaba una invitación sin
 * desplegarla.
 *
 * Los de AUTENTICACIÓN los envía Supabase por su lado, siempre por SMTP. Con
 * el mismo proveedor y el mismo dominio, sigue habiendo un solo sitio donde
 * mirar cuando algo no llega.
 *
 * Dos decisiones que se conservan:
 *
 * 1. **Nunca lanza.** Si el correo falla, la cita ya se confirmó y esa
 *    operación no debe deshacerse ni mostrar un error: el estado en la
 *    plataforma es la fuente de verdad y la persona lo verá al entrar. Se
 *    registra el fallo y se sigue.
 *
 * 2. **Sin servidor configurado, escribe en consola.** Que un flujo falle por
 *    no tener correo configurado sería un estorbo constante.
 */

type Destinatario = { correo: string; nombre?: string | null };

/**
 * El transporte se crea una vez.
 *
 * `nodemailer` mantiene el grupo de conexiones, así que rehacerlo en cada
 * envío abriría una conexión nueva por correo — y una tanda de invitaciones
 * son quince seguidos.
 */
let transporte: nodemailer.Transporter | null = null;

function obtenerTransporte() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  if (!transporte) {
    const puerto = Number(process.env.SMTP_PORT ?? 587);
    const usuario = process.env.SMTP_USER;
    const clave = process.env.SMTP_PASS;

    transporte = nodemailer.createTransport({
      host,
      port: puerto,
      // 465 es SMTPS directo; 587 y 1025 negocian TLS con STARTTLS si lo hay.
      secure: puerto === 465,
      // Mailpit no pide credenciales: pasarle unas vacías rompe el saludo.
      auth: usuario && clave ? { user: usuario, pass: clave } : undefined,

      /*
       * Tiempos de espera, y no son un adorno.
       *
       * Casi todos los VPS bloquean la salida SMTP para frenar el correo
       * basura. Un puerto bloqueado no RECHAZA la conexión: la deja colgada.
       * Sin estos topes, confirmar una cita se quedaba esperando hasta que la
       * plataforma matara la petición —medio minuto o más— y la persona veía
       * una pantalla pensando, por un correo que además no es crítico.
       *
       * Con ellos falla en cinco segundos, se registra y la operación sigue:
       * la cita ya está confirmada y eso es lo que importa.
       */
      connectionTimeout: 5000,
      greetingTimeout: 5000,

      /*
       * EL DE SOCKET ES OTRA COSA, y tenerlo en 10 s costó los informes.
       *
       * Los dos de arriba son los que protegen del puerto bloqueado: si no hay
       * conexión o no hay saludo en cinco segundos, no lo va a haber. Ese
       * diagnóstico se hace antes de mandar un solo byte.
       *
       * El de socket mide INACTIVIDAD, y con un adjunto grande hay inactividad
       * legítima: el servidor calla mientras digiere lo que le acabas de
       * subir. Medido contra Gmail desde el VPS, con un informe de 2,2 MB
       * —3 MB ya en base64—: 6,4 s de subida y 8,7 s de silencio antes del
       * `250`. Dieciocho segundos en total.
       *
       * En 10 s eso se cortaba siempre. El síntoma era «Timeout» a secas, que
       * apunta a la red y manda a mirar puertos y credenciales: la
       * convocatoria, con su QR de unos kilobytes, salía sin problema, y solo
       * fallaban los correos del informe.
       *
       * Sesenta segundos no reabre lo que los otros dos cierran —un puerto
       * colgado sigue fallando en cinco— y aquí no hay nadie esperando: el
       * informe se envía desde `cerrarYAvisar`, que es dispara y olvida y ya
       * está envuelto en su propio `try`.
       */
      socketTimeout: 60000,
    });

    avisarSiGoogleVaAReescribirElRemitente(host, usuario);
  }

  return transporte;
}

const ENDPOINT_HTTP = "https://api.resend.com/emails";

/** Envío por la API HTTP del proveedor. Una petición, sin conexión que mantener. */
async function enviarPorHttp(
  clave: string,
  remitente: string,
  destinatario: Destinatario,
  correo: Correo,
): Promise<{ enviado: boolean }> {
  try {
    const respuesta = await fetch(ENDPOINT_HTTP, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [destinatario.correo],
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
        /*
         * Los adjuntos en línea, con el nombre que usa este proveedor.
         *
         * `content_id` es lo que permite referenciarlos desde el HTML como
         * `cid:…`. Si el proveedor lo ignorara, el correo sale igual: el QR
         * quedaría como adjunto suelto en vez de embebido, y el botón —que es
         * el camino principal— sigue funcionando. Por eso no se comprueba.
         */
        attachments: correo.adjuntos?.map((a) => ({
          filename: a.nombre,
          content: a.contenido,
          content_type: a.tipo,
          content_id: a.cid,
        })),
      }),
      // Mismo motivo que los topes del SMTP: un envío lento no puede dejar
      // esperando a quien acaba de confirmar una cita.
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      // Se registra el estado, no el cuerpo: la respuesta puede incluir el
      // destinatario, y un correo de paciente no debe acabar en los registros.
      console.error(`[correo] el proveedor respondió ${respuesta.status}`);
      return { enviado: false };
    }

    return { enviado: true };
  } catch (error) {
    console.error(
      "[correo] no se pudo contactar con el proveedor:",
      error instanceof Error ? error.message : "fallo desconocido",
    );
    return { enviado: false };
  }
}

export async function enviarCorreo(
  destinatario: Destinatario,
  correo: Correo,
): Promise<{ enviado: boolean }> {
  const remitenteConfigurado = process.env.CORREO_REMITENTE;
  const claveHttp = process.env.RESEND_API_KEY;

  if (claveHttp && remitenteConfigurado) {
    return enviarPorHttp(claveHttp, remitenteConfigurado, destinatario, correo);
  }

  const transporte = obtenerTransporte();
  const remitente = process.env.CORREO_REMITENTE;

  if (!transporte || !remitente) {
    console.info(
      `[correo] sin RESEND_API_KEY ni SMTP_HOST — no se envía nada.\n` +
        `  para: ${destinatario.correo}\n  asunto: ${correo.asunto}` +
        (correo.adjuntos?.length
          ? `\n  adjuntos: ${correo.adjuntos.map((a) => a.nombre).join(", ")}`
          : ""),
    );
    return { enviado: false };
  }

  try {
    await transporte.sendMail({
      from: remitente,
      to: destinatario.nombre
        ? { name: destinatario.nombre, address: destinatario.correo }
        : destinatario.correo,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
      attachments: correo.adjuntos?.map((a) => ({
        filename: a.nombre,
        content: Buffer.from(a.contenido, "base64"),
        contentType: a.tipo,
        cid: a.cid,
      })),
    });

    return { enviado: true };
  } catch (error) {
    /*
     * Se registra el mensaje, no el error entero.
     *
     * La excepción de SMTP incluye la conversación con el servidor, y ahí van
     * las direcciones de destino: un correo de paciente no debe acabar en los
     * registros.
     */
    console.error(
      "[correo] no se pudo enviar:",
      error instanceof Error ? error.message : "fallo desconocido",
    );
    return { enviado: false };
  }
}

/**
 * Gmail no deja mentir sobre quién envía.
 *
 * Si el `From` no es la cuenta autenticada —ni un alias verificado en «Enviar
 * como»— Google lo REESCRIBE en silencio: el correo sale igual, pero quien lo
 * recibe ve la dirección de la cuenta, no la de la marca. No hay error, no hay
 * rebote, y se descubre cuando un paciente responde a una dirección que no era.
 *
 * Se avisa al crear el transporte, una sola vez, porque es la clase de fallo
 * que nadie va a buscar en los registros: todo parece funcionar.
 */
function avisarSiGoogleVaAReescribirElRemitente(
  host: string,
  usuario: string | undefined,
) {
  if (!/gmail\.com|google\.com/i.test(host) || !usuario) return;

  const remitente = process.env.CORREO_REMITENTE ?? "";
  // El remitente puede venir como «Nombre <correo@dominio>» o pelado.
  const direccion = (remitente.match(/<([^>]+)>/)?.[1] ?? remitente).trim();

  if (direccion && direccion.toLowerCase() !== usuario.toLowerCase()) {
    console.warn(
      `[correo] CORREO_REMITENTE (${direccion}) no coincide con SMTP_USER ` +
        `(${usuario}). Google reescribirá el remitente y quien reciba verá ` +
        `${usuario}. Usa esa misma dirección, o verifícala en «Enviar como».`,
    );
  }
}
