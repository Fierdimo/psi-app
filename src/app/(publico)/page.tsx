import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  TrendingUp,
  UserSearch,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BarraProgreso, Retrato } from "@/components/landing/movimiento";
import { RedDeNodos } from "@/components/landing/red-de-nodos";
import { Brand } from "@/components/marca/brand";
import { buttonVariants } from "@/components/ui/button";

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
 * QUIÉN CREA CUENTA AQUÍ: solo una empresa. Es la regla que ordena la página
 * entera y la que cambió.
 *
 * Antes eran dos mitades con dos puertas: el acompañamiento a personas
 * terminaba en «crear cuenta» y los servicios a empresas se contrataban
 * hablando. Ahora es al revés de lo que parecía — la plataforma es para las
 * evaluaciones que encarga una empresa, y TODO lo demás remata en contacto
 * directo: los servicios de consultoría, que nunca pasaron por aquí, y la
 * atención individual, que dejó de hacerlo.
 *
 * De ahí que solo haya un botón de registro y diga «de empresa». Un «crear mi
 * cuenta» en la franja de atención individual llevaría a alguien a rellenar el
 * nombre de una organización que no tiene.
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
    "Evaluación psicotécnica y pruebas psicométricas para empresas: selección, estudios de confiabilidad y formación. Encargas la evaluación desde tu cuenta y recibes el informe en cuanto la persona termina.",
  robots: { index: true, follow: true },
};

/*
 * El orden de la navegación es el orden de la página, y ese orden ya no es
 * neutral: primero lo que se viene a contratar.
 */
const SECCIONES = [
  { id: "servicios", etiqueta: "Servicios" },
  { id: "como-funciona", etiqueta: "Cómo funciona" },
  { id: "pruebas", etiqueta: "Pruebas" },
  { id: "personas", etiqueta: "Atención individual" },
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

/*
 * Los pasos, contados desde quien contrata.
 *
 * Se reescriben enteros porque describían un producto que ya no existe:
 * cargar un listado de personas identificadas por su documento, proponer día y
 * hora para un grupo, y esperar a que cada informe se revisara antes de
 * publicarlo. Hoy no hay listado, no hay fecha y el informe sale solo.
 *
 * Una landing que promete un procedimiento que no ocurre no es un texto
 * desactualizado: es lo que hace que la primera experiencia con el producto sea
 * un desmentido.
 */
const PASOS_EMPRESA = [
  {
    titulo: "Creas la cuenta de tu empresa",
    cuerpo:
      "Con tu correo de contacto. Por ahí resolvemos el pago antes de que gastes nada.",
  },
  {
    titulo: "Compras usos",
    cuerpo:
      "Un uso es una evaluación. Pides los que necesites y se cargan a tu saldo en cuanto confirmo el pago.",
  },
  {
    titulo: "Encargas una evaluación",
    cuerpo:
      "Un nombre y un correo. A esa persona le llega su enlace con un código QR, y responde cuando pueda.",
  },
  {
    titulo: "Recibes el informe",
    cuerpo:
      "En cuanto termina de responder, sin esperas. Queda además en tu cuenta para consultarlo cuando quieras.",
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

/*
 * Lo que se ofrece a una persona que viene por su cuenta.
 *
 * SE QUEDA COMO SERVICIO Y SALE DE LA PLATAFORMA. La consulta individual
 * existe y quien la busca merece encontrarla, pero ya no hay cuenta que crear
 * ni cita que pedir: se contrata hablando, como los servicios de empresa que
 * tampoco pasan por aquí. Por eso son títulos sueltos y no tarjetas con icono
 * — dejaron de ser un catálogo con puerta propia.
 */
const ATENCION_INDIVIDUAL = [
  "Acompañamiento para el bienestar laboral",
  "Pruebas de personalidad",
  "Orientación vocacional",
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
    /*
     * Se dice qué NO se entrega, que es lo único que distingue una garantía de
     * una declaración de buenas intenciones. «Los resultados son tuyos» no
     * comprometía a nada.
     */
    titulo: "Confidencialidad",
    cuerpo:
      "Recibes el informe completo de cada persona. Lo que no sale de la consulta es su hoja de respuestas: qué marcó en cada pregunta no se entrega a nadie.",
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
/** Antetítulo de sección. Anuncia la banda antes de que empiece a leerse. */
/**
 * Tarjeta de servicio: icono, cuerpo, fichas opcionales y beneficio opcional.
 *
 * `destacado` es jerarquía, no decoración: se reserva para el servicio que es
 * la puerta al producto. Si todo pesa lo mismo, nada pesa.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-line bg-panel/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-6 px-5 py-3.5 sm:px-6 sm:py-4">
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

          {/*
            La puerta de quien YA es cliente, y por eso discreta.
            Compite con lo único que esta página tiene que conseguir —que una
            empresa cree su cuenta— y quien ya la tiene la busca arriba a la
            derecha por costumbre, no porque haga falta gritársela.
          */}
          <Link
            href="/ingresar"
            className="text-text-muted hover:text-accent ease-psi shrink-0 text-sm font-medium transition-colors duration-150"
          >
            Entrar
          </Link>
        </div>
        <BarraProgreso />
      </header>

      <main id="contenido" className="flex-1">
        {/* ================================================================
            Portada

            Le habla a una empresa desde la primera línea. Antes abría con el
            nombre del profesional y una bifurcación «eres una persona / eres
            una empresa»: dos caminos en el primer pantallazo obligan a elegir
            antes de saber qué se ofrece, y en móvil empujaban el contenido
            real dos pantallas hacia abajo.
            ============================================================== */}
        <section className="bg-panel relative overflow-hidden">
          <RedDeNodos />
          <MarcaDeAgua />

          {/*
            En móvil la firma va DEBAJO del retrato, no encima.
            Es una línea de crédito —quién firma, qué es, dónde— y encima de la
            foto quedaba flotando entre el llamado a la acción y una imagen sin
            relación aparente. Debajo se lee como lo que es: el pie de esa
            fotografía. En escritorio se queda en su columna, bajo los botones,
            porque ahí la foto está al lado y no debajo.
          */}
          <div className="relative mx-auto grid w-full max-w-[1120px] gap-x-16 gap-y-8 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
            <div className="entrada order-1 flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
              <h1 className="text-h1 text-balance">
                Evaluación psicotécnica para decidir a quién contratas
              </h1>

              <p className="text-text-body max-w-[54ch] text-lg">
                Selección, pruebas psicométricas y estudios de confiabilidad
                para empresas. Encargas la evaluación desde tu cuenta con un
                nombre y un correo, y el informe te llega en cuanto la persona
                termina de responder.
              </p>

              {/*
                Un solo llamado principal. El segundo es el canal que la gente
                ya usa, así que no se esconde, pero tampoco compite: quien
                prefiere escribir lo encuentra sin buscar.
              */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/registro"
                  className={buttonVariants({ size: "lg" })}
                >
                  Crear cuenta de empresa
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>

                <a
                  href={ENLACE_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Escribir por WhatsApp
                </a>
              </div>
            </div>

            <div className="order-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <Retrato />
            </div>

            <p className="text-text-muted order-3 text-sm lg:col-start-1 lg:row-start-2 lg:-mt-2">
              {PROFESIONAL.nombre} · {PROFESIONAL.titulo} · Cartagena y en línea
            </p>
          </div>
        </section>

        {/* ================================================================
            Credenciales

            Van pegadas a la portada y no en una sección propia: son la razón
            para seguir leyendo, no un apartado que alguien vaya a buscar.
            ============================================================== */}
        <section className="border-line bg-brand-800 border-y">
          <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 gap-x-6 gap-y-7 px-5 py-8 sm:px-6 lg:grid-cols-4 lg:py-10">
            {CREDENCIALES.map(({ dato, etiqueta }) => (
              <div key={etiqueta} className="flex flex-col gap-1">
                <span className="text-surface-0 text-xl font-semibold">
                  {dato}
                </span>
                <span className="text-brand-200 text-sm">{etiqueta}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================================
            Servicios

            Cada servicio trae entre tres y ocho puntos. Desplegados eran
            treinta y dos líneas seguidas —buena parte de las dieciocho
            pantallas de móvil— y nadie las lee: se hojean. Plegados, la
            sección se recorre de un vistazo y el detalle sigue estando a un
            toque para quien compara proveedores.
            ============================================================== */}
        <section id="servicios" className="bg-bg scroll-mt-16">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-14 sm:px-6 sm:py-20">
            <div className="flex max-w-[52ch] flex-col gap-3">
              <h2 className="text-h2 text-balance">
                Lo que resuelvo para tu empresa
              </h2>
              <p className="text-text-body text-lg">
                De la vacante abierta al informe firmado. Cada bloque se
                contrata suelto o completo.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {EMPRESAS.map(({ icono: Icono, titulo, cuerpo, puntos }) => (
                <details
                  key={titulo}
                  className="border-line bg-panel group ease-psi hover:border-accent rounded-xl border p-5 transition-colors duration-150 open:shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-lg">
                      <Icono aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-text-strong block font-semibold">
                        {titulo}
                      </span>
                      <span className="text-text-body mt-1 block text-sm">
                        {cuerpo}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="text-text-muted mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>

                  {puntos ? (
                    <ul className="text-text-body border-line mt-4 flex flex-col gap-1.5 border-t pt-4 pl-13 text-sm">
                      {puntos.map((p) => (
                        <li key={p} className="flex gap-2">
                          <Check
                            aria-hidden="true"
                            className="text-accent mt-0.5 size-4 shrink-0"
                          />
                          {p}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================
            Cómo funciona
            ============================================================== */}
        <section id="como-funciona" className="bg-panel scroll-mt-16">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-14 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
              <div className="flex flex-col gap-3">
                <h2 className="text-h2 text-balance">
                  Cómo funciona en la plataforma
                </h2>
                <p className="text-text-body text-lg">
                  Sin correos de ida y vuelta para saber en qué va cada persona.
                </p>
              </div>

              <ol className="flex flex-col">
                {PASOS_EMPRESA.map(({ titulo, cuerpo }, i) => (
                  <li
                    key={titulo}
                    className="border-line flex gap-4 border-b py-5 first:pt-0 last:border-0 last:pb-0"
                  >
                    <span
                      aria-hidden="true"
                      className="text-accent tabular w-6 shrink-0 text-lg font-semibold"
                    >
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-text-strong font-semibold">
                        {titulo}
                      </h3>
                      <p className="text-text-body text-sm">{cuerpo}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ================================================================
            Pruebas
            ============================================================== */}
        <section id="pruebas" className="bg-bg scroll-mt-16">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-14 sm:px-6 sm:py-20">
            <div className="flex max-w-[52ch] flex-col gap-3">
              <h2 className="text-h2 text-balance">Las pruebas que aplico</h2>
              {/*
                Decía «el informe lo firma él, no un algoritmo», y era la frase
                más vendedora de la página. Dejó de ser cierta: el informe se
                califica y se envía solo al terminar la prueba. Se cambia por lo
                que sí lo es, que además vende otra cosa —rapidez— sin prometer
                una firma que no ocurre.
              */}
              <p className="text-text-body text-lg">
                Instrumentos validados, elegidos e interpretados por un
                psicólogo. El informe te llega en cuanto la persona termina, y
                él puede revisarlo y corregirlo después: si lo hace, ves la
                versión corregida.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {PRUEBAS_EMPRESA.map(({ icono: Icono, titulo, cuerpo }) => (
                <article
                  key={titulo}
                  className="border-line bg-panel flex flex-col gap-3 rounded-xl border p-5"
                >
                  <span className="bg-accent-soft text-accent grid size-10 place-items-center rounded-lg">
                    <Icono aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="text-text-strong font-semibold">{titulo}</h3>
                  <p className="text-text-body text-sm">{cuerpo}</p>
                </article>
              ))}
            </div>

            <ul className="border-line mt-8 grid gap-6 border-t pt-8 md:grid-cols-3">
              {GARANTIAS.map(({ titulo, cuerpo }) => (
                <li key={titulo} className="flex flex-col gap-1">
                  <span className="text-text-strong font-semibold">
                    {titulo}
                  </span>
                  <span className="text-text-body text-sm">{cuerpo}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================================================================
            Clientes
            ============================================================== */}
        <section className="border-line bg-panel border-y">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-6">
            <p className="text-text-muted text-sm">Han trabajado conmigo</p>
            <ul className="mt-5 grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {CLIENTES.map(({ archivo, nombre }) => (
                <li
                  key={nombre}
                  className="border-line bg-bg grid h-16 place-items-center overflow-hidden rounded-lg border p-3"
                >
                  <Image
                    src={archivo}
                    alt={nombre}
                    width={120}
                    height={40}
                    className="h-auto max-h-full w-auto max-w-full object-contain opacity-80"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================================================================
            Atención individual

            Una franja, no un recorrido paralelo, y SIN PUERTA A LA
            PLATAFORMA. La consulta individual sigue existiendo y quien la
            busca la encuentra, pero aquí llevaba un «Crear mi cuenta» que hoy
            desemboca en el alta de una empresa: el peor final posible para
            alguien que viene por sí mismo. Se contrata hablando, como los
            servicios de empresa que tampoco pasan por la plataforma.
            ============================================================== */}
        <section id="personas" className="bg-bg scroll-mt-16">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-14 sm:px-6 sm:py-20">
            <div className="border-line bg-panel flex flex-col gap-6 rounded-2xl border p-6 sm:p-10 lg:flex-row lg:items-center lg:gap-12">
              <div className="flex flex-col gap-3 lg:max-w-[46ch]">
                <h2 className="text-h3 text-balance">
                  ¿Vienes por tu cuenta, no por tu empresa?
                </h2>
                <p className="text-text-body">
                  También atiendo a personas. No se agenda desde aquí: la
                  plataforma es para las evaluaciones que encarga una empresa,
                  así que esto se habla directamente y lo acomodamos a lo que
                  necesites.
                </p>
                <ul className="text-text-body flex flex-col gap-1.5 text-sm">
                  {ATENCION_INDIVIDUAL.map((titulo) => (
                    <li key={titulo} className="flex gap-2">
                      <Check
                        aria-hidden="true"
                        className="text-accent mt-0.5 size-4 shrink-0"
                      />
                      {titulo}
                    </li>
                  ))}
                </ul>
              </div>

              {/*
                Solo el canal directo.

                Aquí había un «Crear mi cuenta» que hoy lleva al alta de una
                EMPRESA: quien viene por sí mismo rellenaría el nombre de una
                organización que no tiene para descubrir al final que no era
                su sitio.
              */}
              <div className="flex shrink-0 flex-col gap-3">
                <a
                  href={ENLACE_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants()}
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Escribir por WhatsApp
                </a>
                <a
                  href={`mailto:${PROFESIONAL.correo}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <Mail aria-hidden="true" className="size-4" />
                  Escribir un correo
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            Contacto
            ============================================================== */}
        <section
          id="contacto"
          className="bg-brand-800 relative scroll-mt-16 overflow-hidden"
        >
          <div className="relative mx-auto w-full max-w-[1120px] px-5 py-14 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div className="flex flex-col gap-4">
                <h2 className="text-h2 text-surface-0 text-balance">
                  Cuéntame qué necesitas evaluar
                </h2>
                <p className="text-brand-200 max-w-[52ch] text-lg">
                  Si ya sabes qué quieres, crea la cuenta y pide tus primeros
                  usos. Si prefieres consultarlo antes, escríbeme y lo hablamos.
                </p>

                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/registro"
                    className={buttonVariants({ size: "lg" })}
                  >
                    Crear cuenta de empresa
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                  <a
                    href={ENLACE_WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-brand-200/40 text-surface-0 hover:bg-brand-900 ease-psi inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 font-medium transition-colors duration-150"
                  >
                    <MessageCircle aria-hidden="true" className="size-4" />
                    WhatsApp
                  </a>
                </div>
              </div>

              <ul className="text-brand-200 flex flex-col gap-3">
                <li>
                  <a
                    href={`tel:${PROFESIONAL.telefono.replace(/\s/g, "")}`}
                    className="hover:text-surface-0 ease-psi flex items-center gap-3 transition-colors duration-150"
                  >
                    <Phone aria-hidden="true" className="size-4 shrink-0" />
                    {PROFESIONAL.telefono}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${PROFESIONAL.correo}`}
                    className="hover:text-surface-0 ease-psi flex items-center gap-3 transition-colors duration-150"
                  >
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    {PROFESIONAL.correo}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  Cartagena, Colombia · y en línea
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line bg-panel border-t">
        <div className="text-text-muted mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/*
            Dos créditos distintos y por eso separados: a la izquierda de quién
            es el contenido, a la derecha quién lo hizo. Juntarlos en la misma
            fila de enlaces confundiría el estudio con una red social suya.
          */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              © {new Date().getFullYear()} {PROFESIONAL.nombre}
            </span>
            <span aria-hidden="true" className="text-line hidden sm:inline">
              ·
            </span>
            <span>
              Desarrollado por{" "}
              <a
                href="https://nexias.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-body hover:text-accent ease-psi font-medium transition-colors duration-150"
              >
                Nexias
              </a>
            </span>
          </span>
          <div className="flex gap-5">
            <a
              href={PROFESIONAL.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent ease-psi transition-colors duration-150"
            >
              LinkedIn
            </a>
            <a
              href={PROFESIONAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent ease-psi transition-colors duration-150"
            >
              Instagram
            </a>
            <Link
              href="/ingresar"
              className="hover:text-accent ease-psi transition-colors duration-150"
            >
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
