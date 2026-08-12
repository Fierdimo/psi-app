import "server-only";

import type { Correo } from "./plantillas";

/**
 * Envío de correo transaccional.
 *
 * Dos decisiones deliberadas:
 *
 * 1. **Nunca lanza.** Si el correo falla, la cita ya se confirmó y esa
 *    operación no debe deshacerse ni mostrar un error: el estado en la
 *    plataforma es la fuente de verdad y el paciente lo verá al entrar. Se
 *    registra el fallo y se sigue.
 *
 * 2. **Sin clave configurada, escribe en consola.** En local los correos de
 *    autenticación caen en Mailpit, pero los transaccionales los enviamos
 *    nosotros. Hacer que el flujo falle por no tener una clave de Resend en
 *    desarrollo sería un estorbo constante.
 */

const ENDPOINT = "https://api.resend.com/emails";

type Destinatario = { correo: string; nombre?: string | null };

export async function enviarCorreo(
  destinatario: Destinatario,
  correo: Correo,
): Promise<{ enviado: boolean }> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;

  if (!clave || !remitente) {
    console.info(
      `[correo] sin RESEND_API_KEY — no se envía nada.\n` +
        `  para: ${destinatario.correo}\n  asunto: ${correo.asunto}`,
    );
    return { enviado: false };
  }

  try {
    const respuesta = await fetch(ENDPOINT, {
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
      }),
    });

    if (!respuesta.ok) {
      // Se registra el estado, no el cuerpo: la respuesta puede incluir el
      // destinatario, y un correo de paciente no debe acabar en los registros.
      console.error(`[correo] Resend respondió ${respuesta.status}`);
      return { enviado: false };
    }

    return { enviado: true };
  } catch (error) {
    console.error("[correo] no se pudo contactar con Resend", error);
    return { enviado: false };
  }
}
