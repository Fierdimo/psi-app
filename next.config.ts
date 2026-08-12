import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad (PLAN.md §6.3).
 *
 * Aplican a todo el sitio. Las razones, una por una:
 */
const CABECERAS = [
  {
    // Nadie debe poder empotrar el portal en un iframe. Es la defensa contra
    // el «clickjacking»: una página que superpone controles invisibles sobre
    // los nuestros para que alguien cancele su cita creyendo que pulsa otra
    // cosa.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Impide que el navegador adivine el tipo de un archivo y lo ejecute como
    // algo distinto de lo declarado.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Al salir hacia un enlace externo no se envía la ruta de origen. Sin
    // esto, un clic desde `/calendario/<id>` filtraría el identificador de una
    // cita al sitio de destino.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // No usamos cámara, micrófono ni ubicación. Declararlo cierra la puerta
    // por si algún día se cuela un script de terceros.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Obliga a HTTPS durante un año. Solo tiene efecto sobre HTTPS, así que en
    // local es inocuo.
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Oculta la versión del framework: no ayuda a nadie salvo a quien busca
  // vulnerabilidades conocidas.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: CABECERAS }];
  },
};

export default nextConfig;
