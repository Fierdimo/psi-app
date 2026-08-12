import {
  BatteryLow,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Compass,
  FileSearch,
  GraduationCap,
  Lock,
  type LucideIcon,
  Mail,
  MessageCircle,
  MessagesSquare,
  Scale,
  ShieldAlert,
  TrendingUp,
  UserRound,
  UserSearch,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  BarraProgreso,
  EntradaHero,
  Retrato,
  Revelar,
} from "@/components/landing/movimiento";
import { RedDeNodos } from "@/components/landing/red-de-nodos";
import { Brand } from "@/components/marca/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Landing pública (SPEC.md §7.1).
 *
 * Objetivo único: que alguien que llega por recomendación entienda quién es el
 * profesional y cree una cuenta.
 *
 * Es una sola página. Todo el catálogo de la consulta vive aquí y se navega
 * por anclas: no hay más rutas públicas que las legales, así que la landing no
 * enlaza a nada que no exista.
 *
 * La consulta tiene dos mitades y solo una pasa por esta plataforma. El
 * acompañamiento a personas termina en «crear cuenta»; los servicios a
 * empresas se contratan por WhatsApp o correo y no generan paciente ni cita,
 * así que sus bloques rematan en contacto directo, nunca en registro. Esa
 * bifurcación se declara en el hero, antes que ningún catálogo: quien llega
 * buscando una consultoría no debería tener que leer sobre citas para
 * descubrir que se equivocó de puerta.
 *
 * Deliberadamente ausentes:
 *  - Testimonios de pacientes. Además de éticamente delicado en psicología,
 *    resta credibilidad en lugar de darla.
 *  - Precios. Los del catálogo de empresa cambian por volumen y se negocian;
 *    publicarlos aquí obligaría a mantener dos fuentes de verdad.
 *  - Los diplomas escaneados del sitio anterior. Las titulaciones se dicen con
 *    palabras; publicar el documento expone datos que no hacen falta.
 */

const PROFESIONAL = {
  nombre: "Jesús Banquez Ramírez",
  titulo: "Psicología organizacional",
  telefono: "+57 300 216 3389",
  // Formato E.164 sin signos: es lo que espera wa.me.
  whatsapp: "573002163389",
  correo: "psicologojbr@gmail.com",
  linkedin: "https://www.linkedin.com/in/psic-jbr/",
  instagram: "https://www.instagram.com/psic_jesusbanquez/",
} as const;

const ENLACE_WHATSAPP = `https://wa.me/${PROFESIONAL.whatsapp}`;

export const metadata: Metadata = {
  // `absolute` evita que la plantilla del layout añada la marca: en la landing
  // el nombre del profesional ya es la marca.
  title: { absolute: `${PROFESIONAL.nombre} · ${PROFESIONAL.titulo}` },
  description:
    "Acompañamiento psicológico para el bienestar laboral, selección y evaluación psicotécnica, y pruebas psicométricas. Espacio privado para consultar tus citas y gestionar tus datos.",
  robots: { index: true, follow: true },
};

const SECCIONES = [
  { id: "sobre-mi", etiqueta: "Sobre mí" },
  { id: "personas", etiqueta: "Personas" },
  { id: "empresas", etiqueta: "Empresas" },
  { id: "pruebas", etiqueta: "Pruebas" },
  { id: "contacto", etiqueta: "Contacto" },
];

/**
 * Clientes del sitio anterior.
 *
 * Vienen de su página «Mis Clientes», así que son los que él mismo publica.
 * Cada logo llega con su propio fondo y su propia proporción —uno es una
 * marca sobre azul marino, otro un monograma casi cuadrado—, y por eso se
 * presentan en tarjetas iguales con la imagen contenida: es lo único que
 * evita que una fila de logos ajenos parezca un recorte de periódico.
 */
const CLIENTES = [
  { archivo: "/clientes/gesycobro.jpg", nombre: "Gesycobro S.A.S" },
  {
    archivo: "/clientes/distribuciones-universal.png",
    nombre: "Distribuciones Universal",
  },
  { archivo: "/clientes/hotel-almirante.png", nombre: "Hotel Almirante" },
  { archivo: "/clientes/meravi.png", nombre: "Meravi" },
  { archivo: "/clientes/sv.jpeg", nombre: "SV" },
];

/** Datos verificables, no cifras de escaparate. */
const CREDENCIALES = [
  { dato: "9 años", etiqueta: "De ejercicio profesional" },
  { dato: "Talento humano", etiqueta: "Especialista en gerencia" },
  { dato: "SST", etiqueta: "Especialista en seguridad y salud en el trabajo" },
  { dato: "En línea", etiqueta: "Consulta y pruebas a distancia" },
];

type Servicio = {
  icono: LucideIcon;
  titulo: string;
  cuerpo: string;
  puntos?: readonly string[];
  beneficio?: string;
};

const PERSONAS: readonly Servicio[] = [
  {
    icono: MessagesSquare,
    titulo: "Acompañamiento psicológico",
    cuerpo:
      "Te acompaño en la orientación de tu motivo de consulta. Siéntete en confianza en mi secreto profesional para abordar el proceso a tratar.",
    puntos: [
      "Estrés y ansiedad laboral",
      "Counseling y habilidades sociales",
      "Manejo de las emociones",
      "Salud mental laboral",
    ],
  },
  {
    icono: ShieldAlert,
    titulo: "Factores de riesgo psicosocial",
    cuerpo:
      "Te ayudo a reconocer las situaciones laborales que generan estrés, ansiedad y malestar: la sobrecarga, la falta de control, las malas relaciones con jefes o colegas. Una vez identificadas, desarrollamos estrategias personalizadas para gestionarlas.",
    beneficio:
      "Mayor autoconocimiento, capacidad para establecer límites sanos y un plan de acción para mitigar los efectos negativos del entorno laboral.",
  },
  {
    icono: Scale,
    titulo: "Asesoría para acoso y conflicto",
    cuerpo:
      "Un espacio seguro para hablar sobre experiencias de acoso o conflictos. Apoyo emocional y herramientas para proteger tu bienestar mental y tomar decisiones informadas sobre cómo actuar.",
    beneficio:
      "Recuperación del control personal, fortalecimiento de la autoestima y desarrollo de la comunicación asertiva.",
  },
  {
    icono: BatteryLow,
    titulo: "Prevención y recuperación del burnout",
    cuerpo:
      "Si sientes un agotamiento extremo, este servicio te ayuda a redefinir tus prioridades, restaurar tu energía y encontrar un nuevo equilibrio en tu vida profesional y personal.",
    beneficio:
      "Restauración de la energía y herramientas para prevenir futuras recaídas.",
  },
  {
    icono: TrendingUp,
    titulo: "Coaching y desarrollo profesional",
    cuerpo:
      "Si te sientes estancado o insatisfecho, trabajamos para clarificar tus metas, identificar tus fortalezas y diseñar un camino profesional que te apasione.",
    puntos: [
      "Hoja de vida y perfil profesional",
      "Orientación y transición profesional",
      "Liderazgo personal",
      "Equilibrio entre vida y trabajo",
    ],
  },
];

const PASOS = [
  {
    icono: UserRound,
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

const EMPRESAS: readonly Servicio[] = [
  {
    icono: UserSearch,
    titulo: "Procesos de selección",
    cuerpo:
      "Le apoyo en el reclutamiento y la selección del mejor talento para su empresa, cumpliendo con sus expectativas.",
    puntos: [
      "Perfilamiento operativo, administrativo y gerencial",
      "Publicación de la oferta",
      "Perfilamiento de hojas de vida",
      "Reclutamiento de candidatos",
      "Entrevista preliminar",
      "Entrevista por competencias",
      "Assessment center",
      "Terna de candidatos potenciales",
    ],
  },
  {
    icono: ClipboardCheck,
    titulo: "Evaluación psicotécnica",
    cuerpo:
      "Le ayudo en el perfilamiento de su candidato: rasgos asociados a la personalidad, competencias, habilidades e indicadores relevantes en su proceso de selección.",
    puntos: [
      "Entrevista y evaluación psicológica",
      "Prueba de personalidad",
      "Test de inteligencia para el cargo",
      "Medición de competencias",
      "Perfil comercial",
      "Motivación para el trabajo",
      "Trabajo seguro en alturas",
    ],
  },
  {
    icono: FileSearch,
    titulo: "Estudios de confiabilidad",
    cuerpo:
      "Le apoyo en su proceso complementario de selección verificando cuidadosamente el perfil de su candidato.",
    puntos: [
      "Verificación de antecedentes",
      "Visitas domiciliarias",
      "Informes de diagnóstico",
    ],
  },
  {
    icono: GraduationCap,
    titulo: "Formación y desarrollo",
    cuerpo:
      "Le acompaño en el desarrollo de su equipo de trabajo: habilidades blandas, fortalecimiento del ser y valores corporativos.",
    puntos: [
      "Clima laboral",
      "Evaluación de competencias",
      "Resolución de conflictos",
      "Coaching de equipos",
      "Coaching en liderazgo",
      "Coaching ejecutivo",
      "Planes de capacitación",
    ],
  },
];

const PRUEBAS_EMPRESA: readonly Servicio[] = [
  {
    icono: TrendingUp,
    titulo: "Evaluación del desempeño",
    cuerpo:
      "Medir de forma objetiva las habilidades, competencias y el rendimiento de sus colaboradores, para identificar talentos clave, áreas de oportunidad y planes de desarrollo.",
  },
  {
    icono: Users,
    titulo: "Clima organizacional",
    cuerpo:
      "Encuestas especializadas para identificar puntos de conflicto y fortalezas culturales del equipo.",
  },
  {
    icono: ClipboardCheck,
    titulo: "Batería de pruebas de selección",
    cuerpo:
      "Personalidad —incluido el DISC—, habilidades cognitivas e idoneidad cultural de los candidatos frente al puesto.",
  },
];

const PRUEBAS_PERSONA: readonly Servicio[] = [
  {
    icono: UserRound,
    titulo: "Pruebas de personalidad",
    cuerpo:
      "Tus fortalezas, tus debilidades y tu estilo de comunicación: por qué reaccionas de cierta manera y cómo mejorar tus relaciones.",
  },
  {
    icono: Compass,
    titulo: "Orientación vocacional",
    cuerpo:
      "Identificar intereses, habilidades y valores para elegir una carrera que te apasione.",
  },
  {
    icono: ShieldAlert,
    titulo: "Evaluaciones clínicas",
    cuerpo:
      "Herramientas de autoevaluación, siempre con la guía de un profesional, para entender mejor tu estado emocional y de bienestar.",
  },
];

const GARANTIAS = [
  {
    titulo: "Precisión y confiabilidad",
    cuerpo: "Pruebas validadas y desarrolladas por psicólogos expertos.",
  },
  {
    titulo: "Informes personalizados",
    cuerpo:
      "Más allá del resultado: informes detallados con recomendaciones prácticas para el siguiente paso.",
  },
  {
    titulo: "Confidencialidad",
    cuerpo:
      "Los resultados son tuyos y se entregan solo a quien deben entregarse.",
  },
];

/**
 * Marca de agua para las bandas azul oscuro. Es la marca real de la consulta
 * ampliada y muy bajada de opacidad: da profundidad a un rectángulo que si no
 * queda plano. Decorativa, así que sale del árbol de accesibilidad.
 */
function MarcaDeAgua() {
  return (
    <Image
      src="/marca/jbr-marca.png"
      alt=""
      aria-hidden="true"
      width={300}
      height={300}
      className="pointer-events-none absolute -top-16 -right-12 w-72 opacity-10 brightness-0 invert select-none"
    />
  );
}

/**
 * Imagen de apoyo de una sección.
 *
 * PROVISIONAL: son fotos CC0 de StockSnap mientras llega la fotografía propia
 * del profesional. Ver `public/stock/PROCEDENCIA.md`.
 *
 * El duotono no es un capricho: una foto de stock a todo color, en una página
 * construida sobre una sola familia de azules, se lee como un cuerpo extraño y
 * delata el préstamo. Pasada a grises y teñida con `--brand-800` en
 * `mix-blend-color`, pesa como textura y no como protagonista, que es el papel
 * que le toca mientras sea prestada. Cuando haya foto propia, se le quita.
 */
function ImagenSeccion({
  archivo,
  alt,
  className,
}: {
  archivo: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line relative overflow-hidden rounded-xl border",
        className,
      )}
    >
      <Image
        src={archivo}
        alt={alt}
        width={960}
        height={640}
        sizes="(max-width: 1024px) 100vw, 460px"
        className="h-full w-full object-cover grayscale"
      />
      <div
        aria-hidden="true"
        className="bg-brand-800 absolute inset-0 opacity-75 mix-blend-color"
      />
    </div>
  );
}

/** Antetítulo de sección. Anuncia la banda antes de que empiece a leerse. */
function Antetitulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-accent text-micro font-semibold tracking-[0.1em] uppercase">
      {children}
    </p>
  );
}

/**
 * Tarjeta de servicio: icono, cuerpo, fichas opcionales y beneficio opcional.
 *
 * `destacado` es jerarquía, no decoración: se reserva para el servicio que es
 * la puerta al producto. Si todo pesa lo mismo, nada pesa.
 */
function TarjetaServicio({
  icono: Icono,
  titulo,
  cuerpo,
  puntos,
  beneficio,
  destacado = false,
  accion,
}: Servicio & { destacado?: boolean; accion?: React.ReactNode }) {
  return (
    <article
      className={cn(
        "border-line hover:border-accent-soft-border ease-psi flex h-full flex-col gap-3 rounded-lg border p-6 shadow-xs transition-[box-shadow,border-color,translate] duration-150 hover:-translate-y-0.5 hover:shadow-md",
        destacado ? "bg-accent-soft border-accent-soft-border" : "bg-panel",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-md",
          destacado
            ? "bg-panel text-accent"
            : "bg-accent-soft text-accent border-accent-soft-border border",
        )}
      >
        <Icono aria-hidden="true" className="size-5" />
      </span>
      <h3 className={destacado ? "text-h3" : "text-h4"}>{titulo}</h3>
      <p className="text-text-body">{cuerpo}</p>
      {puntos ? (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {puntos.map((punto) => (
            <li
              key={punto}
              className="border-accent-soft-border bg-accent-soft text-accent-on-soft rounded-sm border px-2.5 py-1 text-sm"
            >
              {punto}
            </li>
          ))}
        </ul>
      ) : null}
      {beneficio ? (
        <p className="text-text-muted border-line border-t pt-3 text-sm">
          <span className="text-text-body font-medium">Beneficios: </span>
          {beneficio}
        </p>
      ) : null}
      {accion ? <div className="mt-auto pt-3">{accion}</div> : null}
    </article>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line bg-panel/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-6 px-6 py-4">
          <Brand size="md" />
          <nav
            aria-label="Secciones"
            className="text-text-muted hidden gap-5 text-sm lg:flex"
          >
            {SECCIONES.map(({ id, etiqueta }) => (
              <a
                key={id}
                href={`#${id}`}
                className="hover:text-accent ease-psi transition-colors duration-150"
              >
                {etiqueta}
              </a>
            ))}
          </nav>
          <Link
            href="/ingresar"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Entrar
          </Link>
        </div>
        <BarraProgreso />
      </header>

      <main id="contenido" className="flex-1">
        {/* Presentación */}
        <section className="bg-panel relative overflow-hidden">
          {/* La red vive detrás de todo y se desvanece hacia los bordes para
              que nunca compita con el nombre ni con el retrato. */}
          <RedDeNodos className="[mask-image:radial-gradient(ellipse_at_center,white_45%,transparent_92%)]" />
          <div className="relative mx-auto grid w-full max-w-[1120px] gap-10 px-6 py-16 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-8">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <EntradaHero>
                <Antetitulo>
                  Psicología organizacional · Talento humano · Riesgo
                  psicosocial
                </Antetitulo>
              </EntradaHero>
              <EntradaHero retraso={0.06}>
                <h1 className="text-display leading-[1.08] tracking-[-0.03em] text-balance">
                  {PROFESIONAL.nombre}
                </h1>
              </EntradaHero>
              <EntradaHero retraso={0.12}>
                <p className="text-text-body max-w-[56ch] text-lg">
                  Psicólogo con nueve años de experiencia como consultor en
                  salud mental, procesos de recursos humanos y talento humano,
                  intervención de equipos y liderazgo. Especialista en Gerencia
                  del Talento Humano y en Seguridad y Salud en el Trabajo.
                </p>
              </EntradaHero>

              {/* La bifurcación, antes que el catálogo */}
              <EntradaHero retraso={0.18}>
                <div className="border-line bg-bg grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
                  <div className="bg-panel flex flex-col gap-2 p-5">
                    <span className="bg-accent-soft text-accent grid size-9 place-items-center rounded-md">
                      <UserRound aria-hidden="true" className="size-5" />
                    </span>
                    <h2 className="text-h4">Eres una persona</h2>
                    <p className="text-text-body text-sm">
                      Acompañamiento individual. Tus citas se piden y se
                      consultan desde esta plataforma.
                    </p>
                    <Link
                      href="/registro"
                      className={buttonVariants({ size: "sm", block: true })}
                    >
                      Crear cuenta
                    </Link>
                  </div>
                  <div className="bg-panel flex flex-col gap-2 p-5">
                    <span className="bg-accent-soft text-accent grid size-9 place-items-center rounded-md">
                      <Building2 aria-hidden="true" className="size-5" />
                    </span>
                    <h2 className="text-h4">Eres una empresa</h2>
                    <p className="text-text-body text-sm">
                      Selección, evaluación psicotécnica y formación. Se acuerda
                      directamente, sin cuenta.
                    </p>
                    <a
                      href={ENLACE_WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                        block: true,
                      })}
                    >
                      <MessageCircle aria-hidden="true" className="size-4" />
                      Escribir por WhatsApp
                    </a>
                  </div>
                </div>
              </EntradaHero>
            </div>

            <div className="lg:col-span-5">
              <Retrato />
            </div>
          </div>
        </section>

        {/* Credenciales */}
        <section className="border-line bg-brand-800 relative overflow-hidden border-y">
          <MarcaDeAgua />
          <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {CREDENCIALES.map(({ dato, etiqueta }, i) => (
              <Revelar key={dato} retraso={i * 0.06}>
                <p className="text-surface-0 text-h4 font-semibold">{dato}</p>
                <p className="text-brand-200 text-sm">{etiqueta}</p>
              </Revelar>
            ))}
          </div>
        </section>

        {/* Sobre mí — aquí manda su voz, no la nuestra */}
        <section id="sobre-mi" className="bg-bg scroll-mt-20">
          <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-6 py-20 lg:grid-cols-12 lg:gap-12">
            <Revelar className="flex flex-col gap-5 lg:col-span-5">
              <Antetitulo>Quién te atiende</Antetitulo>
              <h2 className="text-h2">Sobre mí</h2>
              {/* Su propia frase, elevada a titular: es lo que él eligió decir
                  primero de sí mismo en su sitio anterior. */}
              <blockquote className="border-accent text-text-strong border-l-2 pl-5 text-2xl leading-snug font-medium text-balance">
                Me destaco por hacer las cosas de manera diferente.
              </blockquote>
              <p className="text-text-muted">
                Jesús Banquez Ramírez, psicólogo consultor
              </p>
            </Revelar>
            <Revelar retraso={0.08} className="lg:col-span-7">
              <div className="text-text-body grid gap-6 text-lg">
                <p>
                  Soy un profesional experto en salud mental. Mi pasión por mi
                  profesión se refleja en mi marca, siempre enfocado en el
                  bienestar de mis clientes. Tengo el compromiso de formarme
                  constantemente en salud mental, talento y gestión del
                  desarrollo humano, lo que me permite brindar experiencias
                  enriquecedoras y un servicio de calidad y calidez a quienes
                  confían en mí.
                </p>
                <p>
                  Diseño e implemento soluciones que van desde la selección y el
                  desarrollo del talento, con un profundo entendimiento
                  psicológico, hasta la optimización de los sistemas de gestión
                  de talento humano y de seguridad y salud en el trabajo, y la
                  gestión del riesgo psicosocial. Mi visión se extiende al
                  desarrollo individual: coaching y estrategias para el
                  bienestar psicosocial de cada profesional.
                </p>
              </div>
            </Revelar>
          </div>
        </section>

        {/* Servicio a personas */}
        <section id="personas" className="bg-panel scroll-mt-20">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-20">
            <div className="mb-10 grid items-center gap-8 lg:grid-cols-12">
              <Revelar className="flex flex-col gap-3 lg:col-span-7">
                <Antetitulo>Para personas</Antetitulo>
                <h2 className="text-h2">
                  Entender lo que te pasa en el trabajo
                </h2>
                <p className="text-text-body max-w-[52ch] text-lg">
                  Acompañamiento individual, en línea. Esta es la parte que se
                  gestiona desde la plataforma: aquí pides tus citas y consultas
                  tu calendario.
                </p>
              </Revelar>
              <Revelar retraso={0.08} className="lg:col-span-5">
                <ImagenSeccion
                  archivo="/stock/personas.jpg"
                  alt=""
                  className="aspect-[5/3]"
                />
              </Revelar>
            </div>
            {/* El primer servicio ocupa el doble: es el que desemboca en la
                plataforma y el que trae a la mayoría. Los otros cuatro son
                especializaciones de ese mismo acompañamiento. */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {PERSONAS.map((servicio, i) => (
                <Revelar
                  key={servicio.titulo}
                  retraso={(i % 3) * 0.06}
                  className={i === 0 ? "lg:col-span-2" : undefined}
                >
                  <TarjetaServicio
                    {...servicio}
                    destacado={i === 0}
                    accion={
                      i === 0 ? (
                        <Link
                          href="/registro"
                          className={buttonVariants({ size: "md" })}
                        >
                          Crear cuenta y pedir cita
                        </Link>
                      ) : undefined
                    }
                  />
                </Revelar>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="border-line bg-accent-soft border-y">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-20">
            <Revelar className="mb-10 flex flex-col gap-3">
              <Antetitulo>La plataforma</Antetitulo>
              <h2 className="text-h2">Cómo funciona</h2>
            </Revelar>
            {/* Es una secuencia, y tiene que verse como tal: tres columnas
                sueltas no comunican orden. El tramo de riel se dibuja dentro
                de cada paso menos el último, así que se ajusta solo a
                cualquier ancho en vez de depender de porcentajes calculados a
                mano que se descuadran al cambiar el número de pasos. */}
            <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
              {PASOS.map(({ icono: Icono, titulo, cuerpo }, i) => (
                <li key={titulo}>
                  <Revelar retraso={i * 0.08} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-panel text-accent border-accent-soft-border grid size-12 shrink-0 place-items-center rounded-full border-2">
                        <Icono aria-hidden="true" className="size-5" />
                      </span>
                      <span className="text-accent tabular text-h3 font-semibold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {i < PASOS.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="bg-accent-soft-border hidden h-px flex-1 sm:block"
                        />
                      ) : null}
                    </div>
                    <h3 className="text-h4">{titulo}</h3>
                    <p className="text-text-body">{cuerpo}</p>
                  </Revelar>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Confidencialidad — sección propia, no letra pequeña */}
        <section className="bg-brand-800 relative overflow-hidden">
          <MarcaDeAgua />
          <div className="mx-auto w-full max-w-[1120px] px-6 py-20">
            <Revelar className="flex flex-col gap-4">
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
                  Ningún otro paciente puede ver tu información, y eso no
                  depende de la buena voluntad de nadie: está implementado en la
                  base de datos misma. Los correos que te enviamos nunca
                  mencionan el motivo de tu consulta.
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
            </Revelar>
          </div>
        </section>

        {/* Empresas — no pasa por el portal: se contrata hablando */}
        <section id="empresas" className="bg-panel scroll-mt-20">
          <div className="mx-auto w-full max-w-[1120px] px-6 py-20">
            {/* Imagen a la izquierda: alterna con la de «personas» para que
                las dos bandas de catálogo no se lean como la misma pantalla
                repetida. */}
            <div className="mb-10 grid items-center gap-8 lg:grid-cols-12">
              <Revelar className="lg:order-1 lg:col-span-5">
                <ImagenSeccion
                  archivo="/stock/empresas.jpg"
                  alt=""
                  className="aspect-[5/3]"
                />
              </Revelar>
              <Revelar
                retraso={0.08}
                className="flex flex-col gap-3 lg:order-2 lg:col-span-7"
              >
                <Antetitulo>Para empresas</Antetitulo>
                <h2 className="text-h2">Talento humano y riesgo psicosocial</h2>
                <p className="text-text-body max-w-[52ch] text-lg">
                  Procesos de selección, evaluación y desarrollo para
                  organizaciones. Se acuerdan directamente y no requieren cuenta
                  en la plataforma.
                </p>
              </Revelar>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {EMPRESAS.map((servicio, i) => (
                <Revelar key={servicio.titulo} retraso={(i % 2) * 0.06}>
                  <TarjetaServicio {...servicio} />
                </Revelar>
              ))}
            </div>
            <Revelar retraso={0.1}>
              <div className="border-line bg-bg mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6">
                <p className="text-text-body max-w-[62ch]">
                  También gestiono <strong>ofertas de empleo</strong>: si su
                  empresa quiere publicar una vacante, o si usted quiere
                  registrar su candidatura, escríbame y la incorporo al proceso.
                </p>
                <a
                  href={ENLACE_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Hablemos
                </a>
              </div>
            </Revelar>

            {/* La prueba, pegada a la afirmación que sostiene. Un muro de
                texto sobre servicios de empresa se cree menos que cinco
                logos de empresas que ya lo contrataron. */}
            <Revelar retraso={0.15} className="mt-14">
              <h3 className="text-micro text-text-muted mb-6 font-semibold tracking-[0.1em] uppercase">
                Empresas que han confiado en mí
              </h3>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {CLIENTES.map(({ archivo, nombre }) => (
                  <li
                    key={nombre}
                    // Fondo blanco a propósito: varios logos traen su propio
                    // blanco incrustado y sobre un gris se recortarían como
                    // rectángulos sueltos.
                    className="border-line bg-panel grid h-24 place-items-center rounded-lg border px-5"
                  >
                    <Image
                      src={archivo}
                      alt={nombre}
                      width={200}
                      height={80}
                      className="max-h-14 w-auto object-contain"
                    />
                  </li>
                ))}
              </ul>
            </Revelar>
          </div>
        </section>

        {/* Pruebas psicométricas */}
        <section
          id="pruebas"
          className="border-line bg-bg scroll-mt-20 border-y"
        >
          <div className="mx-auto w-full max-w-[1120px] px-6 py-20">
            <div className="mb-10 grid items-center gap-8 lg:grid-cols-12">
              <Revelar className="flex flex-col gap-3 lg:col-span-7">
                <Antetitulo>Pruebas y evaluaciones</Antetitulo>
                <h2 className="text-h2">Medir para decidir mejor</h2>
                <p className="text-text-body max-w-[52ch] text-lg">
                  Una suite de pruebas psicométricas en línea, tanto para la
                  gestión de una organización como para la propia carrera.
                </p>
              </Revelar>
              <Revelar retraso={0.08} className="lg:col-span-5">
                <ImagenSeccion
                  archivo="/stock/pruebas.jpg"
                  alt=""
                  className="aspect-[5/3]"
                />
              </Revelar>
            </div>

            <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Revelar>
                  <h3 className="text-micro text-text-muted border-line border-b pb-3 font-semibold tracking-[0.1em] uppercase">
                    Para empresas y organizaciones
                  </h3>
                </Revelar>
                {PRUEBAS_EMPRESA.map((prueba, i) => (
                  <Revelar key={prueba.titulo} retraso={i * 0.06}>
                    <TarjetaServicio {...prueba} />
                  </Revelar>
                ))}
              </div>
              <div className="flex flex-col gap-4">
                <Revelar>
                  <h3 className="text-micro text-text-muted border-line border-b pb-3 font-semibold tracking-[0.1em] uppercase">
                    Para el crecimiento personal
                  </h3>
                </Revelar>
                {PRUEBAS_PERSONA.map((prueba, i) => (
                  <Revelar key={prueba.titulo} retraso={i * 0.06}>
                    <TarjetaServicio {...prueba} />
                  </Revelar>
                ))}
              </div>
            </div>

            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {GARANTIAS.map((garantia, i) => (
                <Revelar key={garantia.titulo} retraso={i * 0.06}>
                  <div className="flex flex-col gap-2">
                    <span className="bg-accent-soft text-accent grid size-9 place-items-center rounded-md">
                      <ClipboardCheck aria-hidden="true" className="size-5" />
                    </span>
                    <h3 className="text-h4">{garantia.titulo}</h3>
                    <p className="text-text-body">{garantia.cuerpo}</p>
                  </div>
                </Revelar>
              ))}
            </div>
          </div>
        </section>

        {/* Contacto — el cierre de la página.
            Antes terminaba con tres botones alineados a la izquierda sobre
            blanco: la página no acababa, se apagaba. Aquí vuelven las dos
            puertas del hero, ya con todo leído, y el fondo oscuro le da un
            final. */}
        <section
          id="contacto"
          className="bg-brand-800 relative scroll-mt-20 overflow-hidden"
        >
          <MarcaDeAgua />
          <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-6 py-20 lg:grid-cols-12 lg:gap-12">
            <Revelar className="flex flex-col gap-4 lg:col-span-5">
              <p className="text-brand-200 text-micro font-semibold tracking-[0.1em] uppercase">
                Contacto
              </p>
              <h2 className="text-surface-0 text-h1 text-balance">
                Hablemos de lo que necesitas
              </h2>
              <p className="text-brand-200 text-lg">
                Dos caminos, según quién seas. Ninguno de los dos empieza con un
                formulario largo.
              </p>
            </Revelar>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              <Revelar>
                <div className="border-brand-700 bg-brand-900 flex h-full flex-col gap-3 rounded-lg border p-6">
                  <span className="bg-brand-800 text-brand-200 grid size-10 place-items-center rounded-md">
                    <UserRound aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="text-surface-0 text-h4">Eres una persona</h3>
                  <p className="text-brand-200 text-sm">
                    Crea tu cuenta y pide tu primera cita. El calendario y tus
                    datos quedan en tu espacio privado.
                  </p>
                  {/* Misma estructura que la tarjeta de empresa —botón y un
                      renglón debajo— para que los dos botones caigan a la
                      misma altura. Con `mt-auto` solo en el botón, el correo
                      de la otra tarjeta lo empujaba hacia arriba y la fila
                      quedaba descuadrada. */}
                  <div className="mt-auto flex flex-col gap-2">
                    <Link
                      href="/registro"
                      className={buttonVariants({
                        variant: "secondary",
                        block: true,
                      })}
                    >
                      Crear cuenta
                    </Link>
                    <Link
                      href="/ingresar"
                      className="text-brand-200 hover:text-surface-0 ease-psi inline-flex items-center justify-center gap-2 text-sm transition-colors duration-150"
                    >
                      Ya tengo cuenta
                    </Link>
                  </div>
                </div>
              </Revelar>

              <Revelar retraso={0.08}>
                <div className="border-brand-700 bg-brand-900 flex h-full flex-col gap-3 rounded-lg border p-6">
                  <span className="bg-brand-800 text-brand-200 grid size-10 place-items-center rounded-md">
                    <Building2 aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="text-surface-0 text-h4">Eres una empresa</h3>
                  <p className="text-brand-200 text-sm">
                    Servicios de talento humano, pruebas psicométricas o una
                    demostración. Se acuerda hablando.
                  </p>
                  <div className="mt-auto flex flex-col gap-2">
                    <a
                      href={ENLACE_WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: "secondary",
                        block: true,
                      })}
                    >
                      <MessageCircle aria-hidden="true" className="size-4" />
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:${PROFESIONAL.correo}`}
                      className="text-brand-200 hover:text-surface-0 ease-psi inline-flex items-center justify-center gap-2 text-sm transition-colors duration-150"
                    >
                      <Mail aria-hidden="true" className="size-4" />
                      {PROFESIONAL.correo}
                    </a>
                  </div>
                </div>
              </Revelar>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line bg-bg border-t">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
          <div className="text-text-muted flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a
              href={ENLACE_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              WhatsApp <span className="tabular">{PROFESIONAL.telefono}</span>
            </a>
            <a
              href={`mailto:${PROFESIONAL.correo}`}
              className="hover:text-accent"
            >
              {PROFESIONAL.correo}
            </a>
            <a
              href={PROFESIONAL.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              LinkedIn
            </a>
            <a
              href={PROFESIONAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
