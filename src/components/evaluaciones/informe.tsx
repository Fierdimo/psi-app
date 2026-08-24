/* eslint-disable @next/next/no-img-element */

/**
 * El informe, reproduciendo el documento que la consulta entrega.
 *
 * No es una interpretación del contenido en el sistema de diseño de la
 * aplicación: es EL MISMO DOCUMENTO. Los logotipos, el cerebro de los
 * cuadrantes, las bandas azul marino y el código de color del DISC vienen de
 * la hoja de cálculo que se lleva años exportando a PDF, y quien recibe el
 * informe digital tiene que reconocerlo como lo que ya conoce. Lo único que
 * cambia entre un informe y otro son los datos del evaluado y sus resultados.
 *
 * Por eso se dibuja como una HOJA BLANCA y no se adapta al tema oscuro: es el
 * papel en que se va a imprimir. La aplicación alrededor sí sigue el tema; el
 * documento, no, igual que un PDF adjunto no cambia de color con el visor.
 *
 * color-guard-archivo-exento: los colores son los del documento entregado y no
 * los del sistema de diseño. Aproximarlos con los tokens de estado —rojo de
 * error para Dominancia, verde de éxito para Serenidad— daría un documento
 * PARECIDO, que en un entregable es peor que uno distinto: nadie sabría si el
 * que tiene delante es el bueno. La prohibición del negro puro sigue vigente.
 *
 * TODO EL TEXTO VIENE DE LA BASE. Aquí no hay una sola frase del informe
 * escrita a mano: las descripciones fijas de cada escala salen de
 * `assessment_texts` y las interpretaciones de cada puntaje viajan dentro del
 * resultado. Es lo que permite corregir una redacción sin desplegar.
 */

export interface ParametroInforme {
  clave: string;
  etiqueta: string;
  kind: string;
  seccion: string | null;
}

export interface ValorInforme {
  parameter_key: string;
  valor: unknown;
  sugerido: string | null;
  nota: string | null;
}

/** Los datos que encabezan el documento. */
export interface EvaluadoInforme {
  nombre: string;
  documento: string | null;
  empresa: string | null;
  fechaISO: string | null;
}

/* Los colores del documento, muestreados del PDF que se entrega. */
const AZUL = "#1C4587";
const GRIS_BANDA = "#D9D9D9";

const ESCALAS = [
  { clave: "D", fuerte: "#EA4335", suave: "#F4CCCC" },
  { clave: "I", fuerte: "#FBBC04", suave: "#FCE5CD" },
  { clave: "S", fuerte: "#34A853", suave: "#D9EAD3" },
  { clave: "C", fuerte: "#4285F4", suave: "#C9DAF8" },
] as const;

/*
 * Los cuadrantes cerebrales, con el color que les toca EN LA IMAGEN.
 *
 * No coincide con el del DISC y no es un error: en el dibujo el cuadrante A es
 * el rojo (superior izquierdo), el B el azul (inferior izquierdo), el C el
 * amarillo (inferior derecho) y el D el verde (superior derecho). Cambiarlos
 * dejaría los recuadros sin relación con el cerebro que tienen al lado.
 */
const CUADRANTES = [
  { clave: "cuadrante_a", letra: "A", fuerte: "#EA4335", suave: "#F4CCCC" },
  { clave: "cuadrante_b", letra: "B", fuerte: "#4285F4", suave: "#C9DAF8" },
  { clave: "cuadrante_c", letra: "C", fuerte: "#FBBC04", suave: "#FCE5CD" },
  { clave: "cuadrante_d", letra: "D", fuerte: "#34A853", suave: "#D9EAD3" },
] as const;

/** Los nueve recuadros del perfil clásico, en el orden en que se leen. */
const APARTADOS = [
  "emociones",
  "meta",
  "juzga",
  "influye",
  "teme",
  "valor",
  "mas_efectivo",
  "abusa",
  "bajo_presion",
] as const;

const tramoDisc = (n: number) => (n <= 2 ? "Bajo" : n <= 5 ? "Medio" : "Alto");

const tramoCuadrante = (n: number) =>
  n >= 80 ? "Primario" : n >= 60 ? "Secundario" : "Terciario";

export function Informe({
  parametros,
  valores,
  notaGlobal,
  evaluado,
  /**
   * Las descripciones fijas de cada escala, por clave.
   *
   * Llegan de `textos_fijos_del_instrumento`. Sin ellas el informe se dibuja
   * igual y solo pierde el párrafo de «qué mide esto», que es una degradación
   * aceptable: los puntajes y sus interpretaciones son lo que no puede faltar.
   */
  textosFijos = {},
}: {
  parametros: ParametroInforme[];
  valores: ValorInforme[];
  notaGlobal: string | null;
  evaluado?: EvaluadoInforme;
  textosFijos?: Record<string, string>;
}) {
  const porClave = new Map(valores.map((v) => [v.parameter_key, v]));

  /* Manda lo que escribió el profesional: la redacción del instrumento es su
     borrador, y si la corrigió, la corregida es la buena. */
  const cuerpo = (c: string) => {
    const v = porClave.get(c);
    return v?.nota ?? v?.sugerido ?? null;
  };

  const crudo = (c: string) => {
    const v = porClave.get(c)?.valor;
    return v === null || v === undefined
      ? null
      : String(v).replace(/^"|"$/g, "");
  };

  const numero = (c: string) => {
    const t = crudo(c);
    const n = t === null ? NaN : Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const etiqueta = (c: string) =>
    parametros.find((p) => p.clave === c)?.etiqueta ?? c;

  const patron = crudo("patron");
  const codigo = crudo("segmentos");
  const hayDisc = ESCALAS.some((e) => numero(e.clave) !== null);
  const hayCuadrantes = CUADRANTES.some((c) => numero(c.clave) !== null);

  return (
    <article
      className="mx-auto w-full max-w-[860px] px-6 py-6 text-[13px] leading-snug print:max-w-none print:px-0 print:py-0"
      style={{ background: "#FFFFFF", color: "#16233A" }}
    >
      {/* ==================================================================
          Cabecera: los dos logotipos y los datos del evaluado
          ================================================================== */}
      <header
        className="flex flex-wrap items-center gap-4 border-b pb-4"
        style={{ borderColor: AZUL }}
      >
        {/*
          `img` y no `next/image`, para las tres imágenes del documento.

          Dos motivos, y el segundo es el que manda: `next/image` envuelve la
          imagen en su propia caja y en esta cabecera flexible el logotipo
          acababa con ancho cero —sin error, sin hueco, simplemente ausente—;
          y sobre todo CARGA EN DIFERIDO por defecto, que en un documento que
          se imprime deja el papel con el hueco en blanco.

          Son tres archivos fijos de peso conocido: no hay nada que optimizar
          en tiempo de ejecución.
        */}
        <img
          src="/informe/neurodisc.png"
          alt="NeuroDisc Test"
          width={64}
          height={64}
          loading="eager"
        />
        <img
          src="/informe/jbr-firma.png"
          alt="JBR Psicometrías · Dr. Jesús Banquez R."
          width={300}
          height={80}
          loading="eager"
          className="flex-1 object-contain"
          style={{ maxWidth: 300 }}
        />

        {evaluado ? (
          <dl className="min-w-[240px] text-[12px]">
            <p className="mb-1 font-bold italic" style={{ color: AZUL }}>
              Datos del evaluado
            </p>
            <Dato titulo="ID" valor={evaluado.documento ?? "—"} destacado />
            <Dato titulo="Nombre" valor={evaluado.nombre} />
            {evaluado.empresa ? (
              <Dato titulo="Empresa" valor={evaluado.empresa} />
            ) : null}
            {evaluado.fechaISO ? (
              <Dato
                titulo="Fecha de aplicación"
                valor={new Date(evaluado.fechaISO).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              />
            ) : null}
          </dl>
        ) : null}
      </header>

      {notaGlobal ? (
        <p className="mt-4 border-l-4 pl-3" style={{ borderColor: AZUL }}>
          {notaGlobal}
        </p>
      ) : null}

      {/* ==================================================================
          1 · Resumen del perfil clásico
          ================================================================== */}
      {hayDisc ? (
        <section className="mt-6">
          <Banda>Resumen del perfil clásico</Banda>

          <p className="mt-3 text-center font-semibold">Perfil DISC evaluado</p>
          <p className="text-center text-2xl font-bold" style={{ color: AZUL }}>
            {patron ? enTitulo(patron) : "Sin patrón determinado"}
          </p>
          {codigo ? (
            <p
              className="tabular text-center text-2xl font-bold"
              style={{ color: "#EA4335" }}
            >
              {codigo}
            </p>
          ) : null}

          <div className="mt-4">
            <Banda>Características del perfil</Banda>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <p className="whitespace-pre-line">
              {cuerpo("resumen") ??
                "Este código de segmentos no corresponde a ninguno de los patrones descritos. El profesional puede redactar el resumen."}
            </p>
            <GraficoDisc valores={ESCALAS.map((e) => numero(e.clave) ?? 0)} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {APARTADOS.map((clave) =>
              cuerpo(clave) ? (
                <Recuadro
                  key={clave}
                  titulo={etiqueta(clave)}
                  cuerpo={cuerpo(clave)!}
                />
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {/* ==================================================================
          2 · Las cuatro escalas, una por una
          ================================================================== */}
      {hayDisc ? (
        <section className="mt-8 break-before-page">
          <Banda>Características individuales de personalidad</Banda>

          <p className="mt-2 flex flex-wrap justify-center gap-6 text-[11px] font-semibold italic">
            <span>Puntaje bajo 0-2</span>
            <span>Puntaje medio 3-5</span>
            <span>Puntaje alto 6-7</span>
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {ESCALAS.map(({ clave, fuerte, suave }) => {
              const n = numero(clave);

              return (
                <article
                  key={clave}
                  className="flex break-inside-avoid gap-3 rounded border-2 p-2"
                  style={{ borderColor: fuerte }}
                >
                  <span
                    aria-hidden="true"
                    className="grid w-12 shrink-0 place-items-center rounded text-4xl font-bold"
                    style={{ background: fuerte, color: "#FFFFFF" }}
                  >
                    {clave}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-bold uppercase">
                      {etiqueta(clave)}
                    </h3>

                    {textosFijos[clave] ? (
                      <p className="mt-1">{textosFijos[clave]}</p>
                    ) : null}

                    {textosFijos[`claves_${clave}`] ? (
                      <p className="mt-2 text-[12px] italic">
                        <strong>Características clave:</strong>{" "}
                        {textosFijos[`claves_${clave}`]}
                      </p>
                    ) : null}

                    {cuerpo(clave) ? (
                      <>
                        <p className="mt-2 text-[11px] italic">
                          Interpretación del puntaje:
                        </p>
                        <p
                          className="p-1.5 text-[12px] italic"
                          style={{ background: GRIS_BANDA }}
                        >
                          {cuerpo(clave)}
                        </p>
                      </>
                    ) : null}
                  </div>

                  {n !== null ? (
                    <div
                      className="flex w-16 shrink-0 flex-col items-center justify-center rounded"
                      style={{ background: suave }}
                    >
                      <span className="text-3xl font-bold">{n}</span>
                      <span className="text-[11px] font-semibold italic">
                        {tramoDisc(n)}
                      </span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ==================================================================
          3 · Dominancia cerebral
          ================================================================== */}
      {hayCuadrantes ? (
        <section className="mt-8 break-before-page">
          <Banda>Análisis de la dominancia cerebral</Banda>

          {/* Los cuatro recuadros alrededor del cerebro, como en el documento:
              A y D arriba, B y C abajo, con el dibujo en el centro. */}
          <div className="mt-3 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <TarjetaCuadrante
              cuadrante={CUADRANTES[0]}
              titulo="Cuadrante A"
              subtitulo="Superior izquierdo cerebral"
              descriptores={textosFijos["descriptores_cuadrante_a"]}
              puntaje={numero("cuadrante_a")}
            />
            <img
              src="/informe/cerebro-cuadrantes.png"
              alt=""
              aria-hidden="true"
              width={160}
              height={171}
              loading="eager"
              className="row-span-2 mx-auto"
            />
            <TarjetaCuadrante
              cuadrante={CUADRANTES[3]}
              titulo="Cuadrante D"
              subtitulo="Derecho superior cerebral"
              descriptores={textosFijos["descriptores_cuadrante_d"]}
              puntaje={numero("cuadrante_d")}
              alDerecho
            />
            <TarjetaCuadrante
              cuadrante={CUADRANTES[1]}
              titulo="Cuadrante B"
              subtitulo="Inferior izquierdo límbico"
              descriptores={textosFijos["descriptores_cuadrante_b"]}
              puntaje={numero("cuadrante_b")}
            />
            <TarjetaCuadrante
              cuadrante={CUADRANTES[2]}
              titulo="Cuadrante C"
              subtitulo="Derecho inferior límbico"
              descriptores={textosFijos["descriptores_cuadrante_c"]}
              puntaje={numero("cuadrante_c")}
              alDerecho
            />
          </div>

          <p className="mt-3 flex flex-wrap justify-center gap-6 text-[11px] font-semibold italic">
            <span>Rango 80-100 = primario</span>
            <span>60-79 = secundario</span>
            <span>0-59 = terciario</span>
          </p>

          <p
            className="mt-4 py-1 text-center text-[13px] font-bold italic"
            style={{ background: GRIS_BANDA }}
          >
            Perfil neurolateral de preferencia
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {CUADRANTES.map((c) => {
              const n = numero(c.clave);

              return (
                <article
                  key={c.clave}
                  className="break-inside-avoid rounded border p-2"
                  style={{ borderColor: c.fuerte }}
                >
                  <p
                    className="mb-2 inline-block px-2 py-0.5 text-[11px] font-bold uppercase"
                    style={{ background: c.fuerte, color: "#FFFFFF" }}
                  >
                    Cuadrante {c.letra}
                  </p>

                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {textosFijos[c.clave] ? (
                        <p>{textosFijos[c.clave]}</p>
                      ) : null}
                      {cuerpo(c.clave) ? (
                        <p className="mt-2 border p-2 text-[12px] italic">
                          {cuerpo(c.clave)}
                        </p>
                      ) : null}
                    </div>

                    {n !== null ? (
                      <div
                        className="flex w-16 shrink-0 flex-col items-center justify-center self-stretch rounded"
                        style={{ background: c.suave }}
                      >
                        <span className="text-2xl font-bold">{n}</span>
                        <span className="text-[10px] font-semibold italic">
                          {tramoCuadrante(n)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {cuerpo("neurolateral") ? (
            <div className="mt-3">
              <Recuadro
                titulo={etiqueta("neurolateral")}
                cuerpo={cuerpo("neurolateral")!}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {cuerpo("recomendacion") ? (
        <section className="mt-8">
          <Banda>Recomendación profesional</Banda>
          <p className="mt-3 whitespace-pre-line">{cuerpo("recomendacion")}</p>
        </section>
      ) : null}
    </article>
  );
}

/** Una línea de «Datos del evaluado». */
function Dato({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0">{titulo}:</dt>
      <dd
        className={destacado ? "font-bold" : "font-semibold italic"}
        style={{ color: destacado ? "#EA4335" : AZUL }}
      >
        {valor}
      </dd>
    </div>
  );
}

/**
 * La banda azul que encabeza cada bloque.
 *
 * Es lo que más reconoce quien ya ha visto uno de estos informes: antes de leer
 * el título, la banda dice de qué documento se trata.
 */
function Banda({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="py-1 text-center text-[13px] font-bold uppercase"
      style={{ background: AZUL, color: "#FFFFFF" }}
    >
      {children}
    </h2>
  );
}

/** Uno de los recuadros con cabecera azul y una línea de contenido. */
function Recuadro({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  return (
    <div className="break-inside-avoid">
      <p
        className="px-2 py-0.5 text-[11px] font-bold uppercase"
        style={{ background: AZUL, color: "#FFFFFF" }}
      >
        {titulo}
      </p>
      <p className="border p-2 text-[12px]">{cuerpo}</p>
    </div>
  );
}

/** Uno de los cuatro recuadros que rodean el cerebro. */
function TarjetaCuadrante({
  cuadrante,
  titulo,
  subtitulo,
  descriptores,
  puntaje,
  alDerecho,
}: {
  cuadrante: (typeof CUADRANTES)[number];
  titulo: string;
  subtitulo: string;
  descriptores?: string;
  puntaje: number | null;
  alDerecho?: boolean;
}) {
  return (
    <div className={alDerecho ? "text-right" : ""}>
      <div
        className={`flex items-center gap-2 px-2 py-0.5 ${alDerecho ? "flex-row-reverse" : ""}`}
        style={{ background: cuadrante.fuerte, color: "#FFFFFF" }}
      >
        <span className="text-[11px] font-bold uppercase">{titulo}</span>
        <span className="flex-1 text-[9px] italic">{subtitulo}</span>
        {puntaje !== null ? (
          <span
            className="tabular px-2 text-[15px] font-bold"
            style={{ background: "#FFFFFF", color: "#16233A" }}
          >
            {puntaje}
          </span>
        ) : null}
      </div>
      {descriptores ? (
        <p className="mt-0.5 text-[9px] font-bold uppercase">{descriptores}</p>
      ) : null}
    </div>
  );
}

/**
 * Las cuatro barras del perfil.
 *
 * Dibujadas con `div`s y no con una biblioteca de gráficos: son cuatro barras
 * de altura proporcional sobre una escala de siete, y una dependencia para eso
 * pesaría más que el informe entero. Además así se imprimen sin depender de
 * que el navegador ejecute nada.
 */
function GraficoDisc({ valores }: { valores: number[] }) {
  return (
    <figure className="border p-2">
      <div className="flex h-40 items-end justify-around gap-3">
        {valores.map((v, i) => (
          <div
            key={ESCALAS[i].clave}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span
              className="text-sm font-bold"
              style={{ color: ESCALAS[i].fuerte }}
            >
              {v}
            </span>
            {/* Mínimo del 4 % para que un cero siga siendo una barra visible y
                no un hueco que se lea como «falta el dato». */}
            <div
              className="w-full"
              style={{
                background: ESCALAS[i].fuerte,
                height: `${Math.max(4, (v / 7) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] font-semibold">
        {ESCALAS.map((e, i) => (
          <span key={e.clave} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block size-2"
              style={{ background: e.fuerte }}
            />
            ({e.clave}){" "}
            {["Dominante", "Influencia", "Estabilidad", "Conciencia"][i]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** «PATRON DEL ESPECIALISTA» se lee mejor como «Patrón del Especialista». */
function enTitulo(texto: string) {
  return texto
    .toLocaleLowerCase("es")
    .replace(/(^|\s)(\p{L})/gu, (_, s, l) => s + l.toLocaleUpperCase("es"))
    .replace(/^Patron\b/, "Patrón")
    .replace(/\bDel\b/g, "del");
}
