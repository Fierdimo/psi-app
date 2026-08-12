import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter, familia única del sistema (SPEC.md §2.3).
 *
 * `next/font/google` descarga los archivos en tiempo de compilación y los
 * sirve desde nuestro propio dominio: el navegador del paciente NUNCA hace
 * una petición a Google. Eso es lo que exige el spec — una petición a un CDN
 * de fuentes filtraría la IP del usuario en el momento exacto en que consulta
 * información clínica.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "JBR Psicometrías";

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} · Portal del paciente`,
    template: `%s · ${BRAND_NAME}`,
  },
  description:
    "Portal privado para consultar tus citas y gestionar tus datos con tu profesional de la psicología.",
  robots: {
    // El portal no debe indexarse. Solo la landing lo permitirá explícitamente.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  // color-guard-ignore: la meta `theme-color` la lee el navegador antes de
  // aplicar CSS, así que no puede resolver una variable. Es el único literal
  // de color permitido fuera de tokens.css. Debe coincidir con --color-brand-600.
  themeColor: "#2f49d4",
  // Sin maximumScale ni userScalable:false — bloquear el zoom rompe WCAG 1.4.4
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
