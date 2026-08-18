import "server-only";

import nodemailer from "nodemailer";

import type { Correo } from "./plantillas";

/**
 * Envío de correo transaccional, por SMTP.
 *
 * EL MISMO CAMINO QUE LOS CORREOS DE AUTENTICACIÓN. Antes esto hablaba con la
 * API de Resend mientras Supabase enviaba los suyos por SMTP: dos proveedores
 * que configurar, dos sitios donde mirar cuando algo no llega, y dos formas de
 * fallar. Con SMTP hay una sola credencial y un solo camino, y además funciona
 * con cualquier proveedor en vez de atarnos a uno.
 *
 * Lo que se gana en desarrollo es lo que más se nota: los correos ya no se
 * escriben en la consola, sino que CAEN EN MAILPIT junto a los de
 * autenticación. Antes era imposible ver cómo quedaba una invitación sin
 * desplegarla.
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
    });
  }

  return transporte;
}

export async function enviarCorreo(
  destinatario: Destinatario,
  correo: Correo,
): Promise<{ enviado: boolean }> {
  const transporte = obtenerTransporte();
  const remitente = process.env.CORREO_REMITENTE;

  if (!transporte || !remitente) {
    console.info(
      `[correo] sin SMTP_HOST o CORREO_REMITENTE — no se envía nada.\n` +
        `  para: ${destinatario.correo}\n  asunto: ${correo.asunto}`,
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
