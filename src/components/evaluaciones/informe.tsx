/* eslint-disable @next/next/no-img-element */

/**
 * El informe en pantalla, reproduciendo el documento que la consulta entrega.
 *
 * No es una interpretación del contenido en el sistema de diseño de la
 * aplicación: es EL MISMO DOCUMENTO. Los logotipos, el cerebro de los
 * cuadrantes, las bandas azul marino y el código de color del DISC vienen de la
 * hoja de cálculo que se lleva años exportando a PDF, y quien lo recibe tiene
 * que reconocerlo. Lo único que cambia entre un informe y otro son los datos
 * del evaluado y sus resultados.
 *
 * Se dibuja como una HOJA BLANCA y no sigue el tema oscuro: es el papel en que
 * se va a imprimir, igual que un PDF adjunto no cambia de color con el visor.
 *
 * QUÉ DICE EL INFORME NO SE DECIDE AQUÍ. Eso vive en `estructura-informe`,
 * compartido con el generador de PDF, para que las dos versiones del documento
 * no puedan separarse. Aquí solo está cómo se ve en un navegador.
 *
 * color-guard-archivo-exento: los colores son los del documento entregado y no
 * los del sistema de diseño. Aproximarlos con los tokens de estado —rojo de
 * error para Dominancia, verde de éxito para Serenidad— daría un documento
 * PARECIDO, que en un entregable es peor que uno distinto: nadie sabría si el
 * que tiene delante es el bueno. La prohibición del negro puro sigue vigente.
 */

import {
  COLORES,
  estructuraDelInforme,
  fechaDelInforme,
  momentoDelAcuse,
  type ConsentimientoInforme,
  type EvaluadoInforme,
  type ParametroInforme,
  type ValorInforme,
} from "@/lib/evaluaciones/estructura-informe";

export type {
  ConsentimientoInforme,
  EvaluadoInforme,
  ParametroInforme,
  ValorInforme,
};

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
  consentimiento,
}: {
  parametros: ParametroInforme[];
  valores: ValorInforme[];
  notaGlobal: string | null;
  evaluado?: EvaluadoInforme;
  textosFijos?: Record<string, string>;
  /** El consentimiento que firmó esta persona, si consta. */
  consentimiento?: ConsentimientoInforme | null;
}) {
  const d = estructuraDelInforme({ parametros, valores, textosFijos });

  return (
    <article
      className="mx-auto w-full max-w-[860px] px-6 py-6 text-[13px] leading-snug print:max-w-none print:px-0 print:py-0"
      style={{ background: COLORES.blanco, color: COLORES.tinta }}
    >
      {/* ==================================================================
          Cabecera: los dos logotipos y los datos del evaluado
          ================================================================== */}
      <header
        className="flex flex-wrap items-center gap-4 border-b pb-4"
        style={{ borderColor: COLORES.azul }}
      >
        {/*
          `img` y no `next/image`, para las tres imágenes del documento.

          Dos motivos, y el segundo es el que manda: `next/image` envuelve la
          imagen en su propia caja y en esta cabecera flexible el logotipo
          acababa con ancho cero —sin error, sin hueco, simplemente ausente—; y
          sobre todo CARGA EN DIFERIDO por defecto, que en un documento que se
          imprime deja el papel con el hueco en blanco.
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
            <p
              className="mb-1 font-bold italic"
              style={{ color: COLORES.azul }}
            >
              Datos del evaluado
            </p>
            <Dato titulo="ID" valor={evaluado.documento ?? "—"} destacado />
            <Dato titulo="Nombre" valor={evaluado.nombre} />
            {evaluado.empresa ? (
              <Dato titulo="Empresa" valor={evaluado.empresa} />
            ) : null}
            {fechaDelInforme(evaluado.fechaISO) ? (
              <Dato
                titulo="Fecha de aplicación"
                valor={fechaDelInforme(evaluado.fechaISO)!}
              />
            ) : null}
          </dl>
        ) : null}
      </header>

      {notaGlobal ? (
        <p
          className="mt-4 border-l-4 pl-3"
          style={{ borderColor: COLORES.azul }}
        >
          {notaGlobal}
        </p>
      ) : null}

      {/* ==================================================================
          1 · Resumen del perfil clásico
          ================================================================== */}
      {d.hayDisc ? (
        <section className="mt-6">
          <Banda>Resumen del perfil clásico</Banda>

          <p className="mt-3 text-center font-semibold">Perfil DISC evaluado</p>
          <p
            className="text-center text-2xl font-bold"
            style={{ color: COLORES.azul }}
          >
            {d.patron ?? "Sin patrón determinado"}
          </p>
          {d.codigo ? (
            <p
              className="tabular text-center text-2xl font-bold"
              style={{ color: COLORES.rojo }}
            >
              {d.codigo}
            </p>
          ) : null}

          <div className="mt-4">
            <Banda>Características del perfil</Banda>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <p className="whitespace-pre-line">
              {d.resumen ??
                "Este código de segmentos no corresponde a ninguno de los patrones descritos. El profesional puede redactar el resumen."}
            </p>
            <GraficoDisc escalas={d.escalas} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {d.recuadros.map((r) => (
              <Recuadro key={r.titulo} titulo={r.titulo} cuerpo={r.cuerpo} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ==================================================================
          2 · Las cuatro escalas, una por una
          ================================================================== */}
      {d.hayDisc ? (
        <section className="mt-8 break-before-page">
          <Banda>Características individuales de personalidad</Banda>

          <p className="mt-2 flex flex-wrap justify-center gap-6 text-[11px] font-semibold italic">
            <span>Puntaje bajo 0-2</span>
            <span>Puntaje medio 3-5</span>
            <span>Puntaje alto 6-7</span>
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {d.escalas.map((e) => (
              <article
                key={e.clave}
                className="flex break-inside-avoid gap-3 rounded border-2 p-2"
                style={{ borderColor: e.fuerte }}
              >
                <span
                  aria-hidden="true"
                  className="grid w-12 shrink-0 place-items-center rounded text-4xl font-bold"
                  style={{ background: e.fuerte, color: COLORES.blanco }}
                >
                  {e.clave}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold uppercase">
                    {e.titulo}
                  </h3>

                  {e.descripcion ? (
                    <p className="mt-1">{e.descripcion}</p>
                  ) : null}

                  {e.claves ? (
                    <p className="mt-2 text-[12px] italic">
                      <strong>Características clave:</strong> {e.claves}
                    </p>
                  ) : null}

                  {e.interpretacion ? (
                    <>
                      <p className="mt-2 text-[11px] italic">
                        Interpretación del puntaje:
                      </p>
                      <p
                        className="p-1.5 text-[12px] italic"
                        style={{ background: COLORES.grisBanda }}
                      >
                        {e.interpretacion}
                      </p>
                    </>
                  ) : null}
                </div>

                {e.puntaje !== null ? (
                  <div
                    className="flex w-16 shrink-0 flex-col items-center justify-center rounded"
                    style={{ background: e.suave }}
                  >
                    <span className="text-3xl font-bold">{e.puntaje}</span>
                    <span className="text-[11px] font-semibold italic">
                      {e.tramo}
                    </span>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ==================================================================
          3 · Dominancia cerebral
          ================================================================== */}
      {d.hayCuadrantes ? (
        <section className="mt-8 break-before-page">
          <Banda>Análisis de la dominancia cerebral</Banda>

          {/* Los cuatro recuadros alrededor del cerebro, como en el documento:
              A y D arriba, B y C abajo, con el dibujo en el centro. */}
          <div className="mt-3 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <TarjetaCuadrante bloque={d.cuadrantes[0]} />
            <img
              src="/informe/cerebro-cuadrantes.png"
              alt=""
              aria-hidden="true"
              width={160}
              height={171}
              loading="eager"
              className="row-span-2 mx-auto"
            />
            <TarjetaCuadrante bloque={d.cuadrantes[3]} alDerecho />
            <TarjetaCuadrante bloque={d.cuadrantes[1]} />
            <TarjetaCuadrante bloque={d.cuadrantes[2]} alDerecho />
          </div>

          <p className="mt-3 flex flex-wrap justify-center gap-6 text-[11px] font-semibold italic">
            <span>Rango 80-100 = primario</span>
            <span>60-79 = secundario</span>
            <span>0-59 = terciario</span>
          </p>

          <p
            className="mt-4 py-1 text-center text-[13px] font-bold italic"
            style={{ background: COLORES.grisBanda }}
          >
            Perfil neurolateral de preferencia
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {d.cuadrantes.map((c) => (
              <article
                key={c.clave}
                className="break-inside-avoid rounded border p-2"
                style={{ borderColor: c.fuerte }}
              >
                <p
                  className="mb-2 inline-block px-2 py-0.5 text-[11px] font-bold uppercase"
                  style={{ background: c.fuerte, color: COLORES.blanco }}
                >
                  {c.titulo}
                </p>

                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {c.descripcion ? <p>{c.descripcion}</p> : null}
                    {c.interpretacion ? (
                      <p className="mt-2 border p-2 text-[12px] italic">
                        {c.interpretacion}
                      </p>
                    ) : null}
                  </div>

                  {c.puntaje !== null ? (
                    <div
                      className="flex w-16 shrink-0 flex-col items-center justify-center self-stretch rounded"
                      style={{ background: c.suave }}
                    >
                      <span className="text-2xl font-bold">{c.puntaje}</span>
                      <span className="text-[10px] font-semibold italic">
                        {c.tramo}
                      </span>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {d.neurolateral ? (
            <div className="mt-3">
              <Recuadro
                titulo={d.neurolateral.titulo}
                cuerpo={d.neurolateral.cuerpo}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {d.recomendacion ? (
        <section className="mt-8">
          <Banda>Recomendación profesional</Banda>
          <p className="mt-3 whitespace-pre-line">{d.recomendacion}</p>
        </section>
      ) : null}

      {/* ==================================================================
          El consentimiento CIERRA el informe.

          En el documento que se entregaba hoy abría, y se movió al final a
          propósito: quien lo recibe viene a leer un perfil, no un contrato. Va
          detrás como el respaldo de que la persona supo a qué accedía.
          ================================================================== */}
      {consentimiento ? (
        <section className="mt-8 break-before-page">
          <Banda>Consentimiento informado</Banda>

          {consentimiento.secciones ? (
            <div className="mt-3 flex flex-col gap-2">
              {consentimiento.secciones.map((sec) => (
                <div key={sec.titulo}>
                  <p className="font-bold">{sec.titulo}</p>
                  {(Array.isArray(sec.cuerpo) ? sec.cuerpo : [sec.cuerpo]).map(
                    (parrafo, n) => (
                      <p key={n}>{parrafo}</p>
                    ),
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3">
              El texto de la versión {consentimiento.version} está archivado con
              el documento firmado. Aquí consta su aceptación.
            </p>
          )}

          {/* El acuse, centrado y bajo una línea, como en el documento. */}
          <div className="mx-auto mt-6 max-w-[320px] border-t pt-1 text-center">
            <p
              className="text-[10px] font-bold uppercase italic"
              style={{ color: COLORES.rojo }}
            >
              Aceptación electrónica
            </p>
            <p className="font-semibold" style={{ color: COLORES.azul }}>
              {consentimiento.nombre}
            </p>
            {consentimiento.documento ? (
              <p className="font-bold">ID {consentimiento.documento}</p>
            ) : null}
            <p className="text-[10px]">
              Versión {consentimiento.version}
              {momentoDelAcuse(consentimiento.aceptadoEl)
                ? ` · ${momentoDelAcuse(consentimiento.aceptadoEl)}`
                : ""}
            </p>
          </div>
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
        style={{ color: destacado ? COLORES.rojo : COLORES.azul }}
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
      style={{ background: COLORES.azul, color: COLORES.blanco }}
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
        style={{ background: COLORES.azul, color: COLORES.blanco }}
      >
        {titulo}
      </p>
      <p className="border p-2 text-[12px]">{cuerpo}</p>
    </div>
  );
}

/** Uno de los cuatro recuadros que rodean el cerebro. */
function TarjetaCuadrante({
  bloque,
  alDerecho,
}: {
  bloque: ReturnType<typeof estructuraDelInforme>["cuadrantes"][number];
  alDerecho?: boolean;
}) {
  return (
    <div className={alDerecho ? "text-right" : ""}>
      <div
        className={`flex items-center gap-2 px-2 py-0.5 ${alDerecho ? "flex-row-reverse" : ""}`}
        style={{ background: bloque.fuerte, color: COLORES.blanco }}
      >
        <span className="text-[11px] font-bold uppercase">{bloque.titulo}</span>
        <span className="flex-1 text-[9px] italic">{bloque.subtitulo}</span>
        {bloque.puntaje !== null ? (
          <span
            className="tabular px-2 text-[15px] font-bold"
            style={{ background: COLORES.blanco, color: COLORES.tinta }}
          >
            {bloque.puntaje}
          </span>
        ) : null}
      </div>
      {bloque.descriptores ? (
        <p className="mt-0.5 text-[9px] font-bold uppercase">
          {bloque.descriptores}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Las cuatro barras del perfil.
 *
 * Dibujadas con `div`s y no con una biblioteca de gráficos: son cuatro barras
 * de altura proporcional sobre una escala de siete, y una dependencia para eso
 * pesaría más que el informe entero. Además así se imprimen sin depender de que
 * el navegador ejecute nada.
 */
function GraficoDisc({
  escalas,
}: {
  escalas: ReturnType<typeof estructuraDelInforme>["escalas"];
}) {
  const nombres = ["Dominante", "Influencia", "Estabilidad", "Conciencia"];

  return (
    <figure className="border p-2">
      <div className="flex h-40 items-end justify-around gap-3">
        {escalas.map((e) => (
          <div
            key={e.clave}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-sm font-bold" style={{ color: e.fuerte }}>
              {e.puntaje ?? 0}
            </span>
            {/* Mínimo del 4 % para que un cero siga siendo una barra visible y
                no un hueco que se lea como «falta el dato». */}
            <div
              className="w-full"
              style={{
                background: e.fuerte,
                height: `${Math.max(4, ((e.puntaje ?? 0) / 7) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] font-semibold">
        {escalas.map((e, i) => (
          <span key={e.clave} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block size-2"
              style={{ background: e.fuerte }}
            />
            ({e.clave}) {nombres[i]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
