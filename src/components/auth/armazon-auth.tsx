import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Brand } from "@/components/marca/brand";

/**
 * Armazón de las pantallas de entrada (SPEC.md §7.2).
 *
 * Dos columnas desde 1024 px: a la izquierda un panel azul rey oscuro con la
 * marca y una nota de confidencialidad; a la derecha el formulario sobre
 * blanco, máximo 400 px. Por debajo, solo el formulario.
 *
 * El panel de la izquierda no es decoración. Es lo primero que ve alguien que
 * llega a un portal clínico, y su trabajo es responder «¿esto es serio?» antes
 * de que la persona escriba su correo.
 */
type ArmazonAuthProps = {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  /** Enlaces bajo el formulario (registro, recuperación, etc.). */
  pie?: React.ReactNode;
  /** El texto del panel cambia según a quién se dirige la pantalla. */
  variante?: "empresa" | "profesional";
};

/*
 * Las dos únicas puertas que existen.
 *
 * La variante por defecto se llamaba `paciente` y hablaba de citas, de cuando
 * cada persona traía su cuenta. Hoy quien responde una evaluación NO entra por
 * aquí —le llega un enlace y no crea nada—, así que este formulario solo lo
 * ven dos figuras: la empresa que encarga las evaluaciones y el profesional.
 *
 * Importa que el panel lo diga: prometerle a alguien «tus citas» en la
 * pantalla donde escribe su contraseña es la forma más barata de que crea que
 * se equivocó de sitio.
 */
const PANEL = {
  empresa: {
    titulo: "El espacio de tu empresa",
    cuerpo:
      "Aquí pides evaluaciones, sigues su avance y consultas los informes de tu organización. Solo tu empresa y el profesional pueden verlos.",
  },
  profesional: {
    titulo: "Acceso profesional",
    cuerpo:
      "Estás entrando a un área con los informes de las personas evaluadas. Cierra la sesión cuando termines si compartes el equipo.",
  },
} as const;

export function ArmazonAuth({
  titulo,
  descripcion,
  children,
  pie,
  variante = "empresa",
}: ArmazonAuthProps) {
  const panel = PANEL[variante];

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* Panel de marca */}
      <aside className="bg-brand-800 flex flex-col justify-between gap-10 px-6 py-8 lg:w-[45%] lg:px-12 lg:py-14">
        <Link href="/" className="w-fit rounded-md">
          <Brand tone="dark" size="md" />
        </Link>

        <div className="hidden max-w-[38ch] flex-col gap-6 lg:flex">
          <div className="flex flex-col gap-4">
            <h2 className="text-surface-0 text-h2">{panel.titulo}</h2>
            <p className="text-brand-200 text-lg">{panel.cuerpo}</p>
          </div>

          {/*
            La firma, debajo de la promesa.

            El comentario de arriba dice que el trabajo de este panel es
            responder «¿esto es serio?» antes de que nadie escriba su correo, y
            una firma manuscrita hace eso mejor que otro párrafo. Es la misma
            que encabeza los informes, así que quien ya recibió uno la
            reconoce.

            Solo desde `lg`, con el resto del panel: en móvil este bloque no se
            enseña y la firma suelta sería un adorno sin contexto.
          */}
          <Image
            src="/marca/firma_digital-removebg-preview.png"
            alt=""
            aria-hidden="true"
            width={810}
            height={308}
            className="h-auto w-full max-w-[280px] opacity-90"
          />
        </div>

        <p className="text-brand-200 hidden items-center gap-2.5 text-sm lg:flex">
          <Lock aria-hidden="true" className="size-4 shrink-0" />
          Conexión cifrada de extremo a extremo
        </p>
      </aside>

      {/* Formulario */}
      <main
        id="contenido"
        className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12"
      >
        <div className="flex w-full max-w-[400px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h1 className="text-h2">{titulo}</h1>
            {descripcion && <p className="text-text-body">{descripcion}</p>}
          </div>

          {children}

          {pie && (
            <div className="text-text-muted flex flex-col gap-2 text-sm">
              {pie}
            </div>
          )}

          <p className="text-text-muted border-line text-micro border-t pt-5">
            Al continuar aceptas nuestra{" "}
            <Link href="/privacidad" className="text-accent underline">
              política de privacidad
            </Link>{" "}
            y los{" "}
            <Link href="/terminos" className="text-accent underline">
              términos de uso
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
