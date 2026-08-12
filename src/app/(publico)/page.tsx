import { CalendarCheck, Lock, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import { buttonVariants } from "@/components/ui/button";

/**
 * Landing pública (SPEC.md §7.1).
 *
 * Objetivo único: que alguien que llega por recomendación entienda quién es el
 * profesional y cree una cuenta.
 *
 * Deliberadamente ausentes:
 *  - Testimonios de pacientes. Además de éticamente delicado en psicología,
 *    resta credibilidad en lugar de darla.
 *  - Precios. Fuera del alcance del v1.
 *  - Cualquier cosa que suene a landing de startup. Esto es una consulta.
 *
 * TEXTO PROVISIONAL: nombre, especialidad y áreas están a la espera de los
 * datos reales del profesional.
 */
export const metadata: Metadata = {
  title: "Consulta de psicología",
  description:
    "Espacio privado para consultar tus citas y gestionar tus datos con tu profesional de la psicología.",
  robots: { index: true, follow: true },
};

const AREAS = [
  {
    titulo: "Ansiedad y estrés",
    cuerpo:
      "Acompañamiento en cuadros de ansiedad, estrés sostenido y dificultades de sueño.",
  },
  {
    titulo: "Estado de ánimo",
    cuerpo:
      "Trabajo sobre episodios depresivos, desmotivación y procesos de duelo.",
  },
  {
    titulo: "Procesos vitales",
    cuerpo:
      "Cambios de etapa, decisiones difíciles, relaciones y construcción de hábitos.",
  },
  {
    titulo: "Evaluación psicológica",
    cuerpo:
      "Aplicación e interpretación de instrumentos de evaluación cuando el proceso lo requiere.",
  },
];

const PASOS = [
  {
    icono: UserPlus,
    titulo: "Crea tu cuenta",
    cuerpo:
      "Con tu correo. Confirmas la dirección y aceptas el consentimiento informado, que explica qué datos se guardan y quién puede verlos.",
  },
  {
    icono: CalendarCheck,
    titulo: "Solicita tu cita",
    cuerpo:
      "Propones día y hora. El profesional la confirma y recibes un correo. Verás siempre el estado real: pendiente hasta que se confirme.",
  },
  {
    icono: Lock,
    titulo: "Consulta cuando quieras",
    cuerpo:
      "Tu calendario, tus datos y el material que tu profesional comparta contigo, en un espacio al que solo accedes tú.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line border-b">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-6 py-4">
          <Brand size="md" />
          <Link
            href="/ingresar"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Entrar
          </Link>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {/* Presentación */}
        <section className="mx-auto w-full max-w-[1120px] px-6 py-16 sm:py-24">
          <div className="flex max-w-[62ch] flex-col gap-6">
            <p className="text-accent text-micro font-semibold tracking-[0.1em] uppercase">
              Psicología clínica
            </p>
            <h1 className="text-display leading-[1.08] tracking-[-0.03em]">
              Dra. Elena Herrera
            </h1>
            <p className="text-text-body text-lg">
              Atención psicológica para adultos, presencial y en línea. Un
              espacio para entender lo que te pasa y decidir qué hacer con ello,
              sin prisa y sin juicio.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/registro" className={buttonVariants({ size: "lg" })}>
                Crear cuenta
              </Link>
              <Link
                href="/ingresar"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>

        {/* Áreas de trabajo */}
        <section className="border-line bg-panel border-y">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-16">
            <h2 className="text-h2 mb-8">En qué trabajo</h2>
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {AREAS.map((area) => (
                <div key={area.titulo} className="flex flex-col gap-1.5">
                  <h3 className="text-h4">{area.titulo}</h3>
                  <p className="text-text-body max-w-[46ch]">{area.cuerpo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto w-full max-w-[1120px] px-6 py-16">
          <h2 className="text-h2 mb-8">Cómo funciona la plataforma</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {PASOS.map(({ icono: Icono, titulo, cuerpo }, i) => (
              <li key={titulo} className="flex flex-col gap-3">
                <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-lg">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-h4">
                    <span className="text-text-muted tabular mr-2 text-sm font-normal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {titulo}
                  </h3>
                  <p className="text-text-body">{cuerpo}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Confidencialidad — sección propia, no letra pequeña */}
        <section className="bg-brand-800">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-6 py-16">
            <h2 className="text-surface-0 text-h2 max-w-[24ch]">
              Tu información es tuya
            </h2>
            <div className="text-brand-200 grid max-w-[80ch] gap-4 text-lg sm:grid-cols-2">
              <p>
                Lo que ocurre en consulta está protegido por el secreto
                profesional y no se guarda en esta plataforma. Aquí solo viven
                tus datos de contacto y tus citas.
              </p>
              <p>
                Ningún otro paciente puede ver tu información, y eso no depende
                de la buena voluntad de nadie: está implementado en la base de
                datos misma. Los correos que te enviamos nunca mencionan el
                motivo de tu consulta.
              </p>
            </div>
            <p className="pt-2">
              <Link
                href="/privacidad"
                className="text-surface-0 font-medium underline underline-offset-4"
              >
                Leer la política de privacidad
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-line border-t">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <Brand size="sm" />
          <nav className="text-text-muted flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/privacidad" className="hover:text-accent">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-accent">
              Términos
            </Link>
            <Link
              href="/consentimiento-informado"
              className="hover:text-accent"
            >
              Consentimiento informado
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
