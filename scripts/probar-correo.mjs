/**
 * Comprueba que este servidor puede enviar correo.
 *
 * Pensado para ejecutarse EN EL VPS, que es donde falla lo que en local
 * funciona: casi todos los proveedores bloquean la salida SMTP para frenar el
 * correo basura, y un puerto bloqueado no rechaza la conexión —la deja
 * colgada—, así que el síntoma es «no llega nada» sin ningún error a la vista.
 *
 *   node scripts/probar-correo.mjs alguien@ejemplo.com
 *
 * Dice qué falla y qué hacer, en vez de volcar una excepción de red.
 */
import nodemailer from "nodemailer";

const destino = process.argv[2];

if (!destino) {
  console.error("Uso: node scripts/probar-correo.mjs <correo-de-destino>");
  process.exit(1);
}

const host = process.env.SMTP_HOST;
const puerto = Number(process.env.SMTP_PORT ?? 587);
const usuario = process.env.SMTP_USER;
const clave = process.env.SMTP_PASS;
const remitente = process.env.CORREO_REMITENTE;

if (!host || !remitente) {
  console.error(
    "Faltan variables: SMTP_HOST y CORREO_REMITENTE son obligatorias.\n" +
      "Ver docs/DESPLIEGUE.md.",
  );
  process.exit(1);
}

console.log(`Servidor: ${host}:${puerto}`);
console.log(`Remitente: ${remitente}`);
console.log(`Destino:  ${destino}\n`);

/*
 * La trampa de Gmail, comprobada antes de enviar.
 *
 * Si el remitente no es la cuenta autenticada, Google lo reescribe sin avisar:
 * el correo llega, pero con otra dirección. Se detecta aquí porque el envío de
 * prueba «funcionaría» igual y no habría nada que mirar.
 */
const esGoogle = /gmail\.com|google\.com/i.test(host);
const direccionRemitente = (
  remitente.match(/<([^>]+)>/)?.[1] ?? remitente
).trim();

if (
  esGoogle &&
  usuario &&
  direccionRemitente.toLowerCase() !== usuario.toLowerCase()
) {
  console.warn(
    `⚠ CORREO_REMITENTE (${direccionRemitente}) no es la cuenta autenticada\n` +
      `  (${usuario}). Google reescribirá el remitente y quien lo reciba verá\n` +
      `  ${usuario}. Usa esa misma dirección, o verifícala en Gmail →\n` +
      `  Configuración → Cuentas → «Enviar como».\n`,
  );
}

const transporte = nodemailer.createTransport({
  host,
  port: puerto,
  secure: puerto === 465,
  auth: usuario && clave ? { user: usuario, pass: clave } : undefined,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 15000,
});

try {
  await transporte.verify();
  /*
   * Sin credenciales, `verify()` solo comprueba que hay alguien al otro lado.
   * Decir «y las credenciales» ahí era mentira, y de la peor clase: la que
   * tranquiliza. El envío fallaba tres líneas después con un error de
   * autenticación que ya no encajaba con lo que la pantalla acababa de afirmar.
   */
  console.log(
    usuario && clave
      ? "✓ El servidor acepta la conexión y las credenciales."
      : "✓ El servidor acepta la conexión. SIN credenciales: no se ha " +
          "comprobado el acceso.",
  );
} catch (error) {
  console.error("✗ No se pudo conectar:", error.message);
  console.error(
    esGoogle
      ? "\nCon Google, en este orden:\n" +
          "  1. La clave NO es la de la cuenta. Hay que crear una contraseña de\n" +
          "     aplicación (16 caracteres), y eso exige tener la verificación en\n" +
          "     dos pasos activada. Sin ella, Google rechaza el acceso.\n" +
          "  2. El proveedor del VPS bloquea la salida por ese puerto. Prueba 587,\n" +
          "     y si tampoco, 465.\n" +
          "  3. El cortafuegos del propio servidor."
      : "\nLo más probable, en este orden:\n" +
          "  1. El proveedor del VPS bloquea la salida por ese puerto. Prueba 587,\n" +
          "     y si tampoco, 2525: casi todos los relés lo ofrecen justo por esto.\n" +
          "  2. Usuario o clave equivocados.\n" +
          "  3. El cortafuegos del propio servidor.",
  );
  process.exit(1);
}

try {
  const info = await transporte.sendMail({
    from: remitente,
    to: destino,
    subject: "Prueba de envío · JBR Psicometrías",
    text:
      "Si lees esto, este servidor puede enviar correo.\n\n" +
      "Comprueba también que NO haya caído en la carpeta de spam: si cayó, " +
      "falta verificar el dominio (SPF y DKIM).",
  });
  console.log(`✓ Enviado. Identificador: ${info.messageId}`);
  console.log(
    "\nAhora mira el buzón de destino. Si llegó a spam, el envío funciona\n" +
      "pero falta verificar el dominio en el proveedor.",
  );
} catch (error) {
  console.error("✗ Conectó pero no pudo enviar:", error.message);
  console.error(
    "\nSuele ser el remitente: muchos relés solo aceptan direcciones de un\n" +
      "dominio verificado. Revisa CORREO_REMITENTE.",
  );
  process.exit(1);
}
