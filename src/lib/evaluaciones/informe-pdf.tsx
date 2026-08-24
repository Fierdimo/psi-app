import "server-only";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  COLORES,
  estructuraDelInforme,
  fechaDelInforme,
  momentoDelAcuse,
  type ConsentimientoInforme,
  type EstructuraInforme,
  type EvaluadoInforme,
  type ParametroInforme,
  type ValorInforme,
} from "@/lib/evaluaciones/estructura-informe";

/**
 * El informe como PDF, para adjuntarlo al correo.
 *
 * -------------------------------------------------------------------------
 * POR QUÉ NO SE IMPRIME LA PÁGINA CON UN NAVEGADOR SIN CABEZA
 *
 * Sería la opción de fidelidad perfecta —el PDF sería literalmente la
 * pantalla— y se descartó por dos motivos, en este orden:
 *
 *   1. `PLAN.md §3.3` deja abiertos dos destinos de despliegue: un contenedor
 *      en un VPS y una plataforma gestionada tipo Cloudflare Workers. Un
 *      Chromium en tiempo de ejecución elimina el segundo, y esa decisión no
 *      es de este archivo.
 *   2. Aunque el destino sea el VPS, ahí conviven la aplicación y la base en
 *      4 GB. Levantar un navegador por informe —y salen en tandas, al terminar
 *      varias personas la misma mañana— es la clase de consumo que tumba la
 *      máquina entera por generar un documento de dos folios.
 *
 * El precio de no usarlo es tener el documento escrito DOS VECES. Se paga con
 * `estructura-informe`: qué dice el informe se decide una sola vez, ahí, y
 * aquí solo está cómo se dibuja en un PDF. Añadir un apartado sigue siendo un
 * cambio en un solo sitio.
 * -------------------------------------------------------------------------
 *
 * color-guard-archivo-exento: mismo motivo que en el componente de pantalla,
 * los colores son los del documento entregado.
 */

/*
 * Las imágenes se leen del disco y se cachean en memoria.
 *
 * Son tres archivos fijos de unos dos megas en total. Sin la caché, cada
 * informe de una tanda de cuarenta los volvería a leer y a codificar.
 */
const cacheDeImagenes = new Map<string, string>();

async function imagen(nombre: string): Promise<string | null> {
  const guardada = cacheDeImagenes.get(nombre);
  if (guardada) return guardada;

  try {
    const datos = await readFile(
      path.join(process.cwd(), "public", "informe", nombre),
    );
    const uri = `data:image/png;base64,${datos.toString("base64")}`;
    cacheDeImagenes.set(nombre, uri);
    return uri;
  } catch {
    /*
     * Sin logotipo se sigue.
     *
     * Un informe sin su imagen de cabecera es un informe feo; un informe que
     * no llega porque faltaba un PNG es una persona sin sus resultados.
     */
    return null;
  }
}

const e = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 32,
    fontSize: 8,
    color: COLORES.tinta,
    backgroundColor: COLORES.blanco,
    lineHeight: 1.4,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORES.azul,
    paddingBottom: 8,
    marginBottom: 10,
  },
  banda: {
    backgroundColor: COLORES.azul,
    color: COLORES.blanco,
    textAlign: "center",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    marginTop: 10,
  },
  bandaGris: {
    backgroundColor: COLORES.grisBanda,
    textAlign: "center",
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    paddingVertical: 3,
    marginTop: 10,
  },
  fila: { flexDirection: "row", gap: 8 },
  negrita: { fontFamily: "Helvetica-Bold" },
  cursiva: { fontFamily: "Helvetica-Oblique" },
  leyenda: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    fontSize: 7,
    fontFamily: "Helvetica-Oblique",
    marginTop: 4,
  },
});

/** Uno de los recuadros con cabecera azul. */
function Recuadro({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  return (
    <View style={{ marginBottom: 4 }} wrap={false}>
      <Text
        style={{
          backgroundColor: COLORES.azul,
          color: COLORES.blanco,
          fontFamily: "Helvetica-Bold",
          fontSize: 7,
          paddingVertical: 2,
          paddingHorizontal: 4,
        }}
      >
        {titulo.toUpperCase()}
      </Text>
      <Text
        style={{
          borderWidth: 0.5,
          borderColor: COLORES.grisBanda,
          padding: 4,
          fontSize: 7.5,
        }}
      >
        {cuerpo}
      </Text>
    </View>
  );
}

function Documento({
  datos,
  evaluado,
  notaGlobal,
  consentimiento,
  imagenes,
}: {
  datos: EstructuraInforme;
  evaluado: EvaluadoInforme;
  notaGlobal: string | null;
  consentimiento: ConsentimientoInforme | null;
  imagenes: {
    neurodisc: string | null;
    firma: string | null;
    cerebro: string | null;
  };
}) {
  const nombres = ["Dominante", "Influencia", "Estabilidad", "Conciencia"];

  return (
    <Document
      title={`Informe DISC · ${evaluado.nombre}`}
      author="JBR Psicometrías"
      subject="Perfil DISC y dominancia cerebral"
    >
      <Page size="LETTER" style={e.pagina}>
        <View style={e.cabecera} fixed>
          {imagenes.neurodisc ? (
            <Image src={imagenes.neurodisc} style={{ width: 44, height: 44 }} />
          ) : null}
          {imagenes.firma ? (
            <Image
              src={imagenes.firma}
              style={{ width: 170, height: 45, objectFit: "contain" }}
            />
          ) : null}

          <View style={{ marginLeft: "auto", fontSize: 7.5 }}>
            <Text style={[e.negrita, e.cursiva, { color: COLORES.azul }]}>
              Datos del evaluado
            </Text>
            <Text>
              ID:{" "}
              <Text style={[e.negrita, { color: COLORES.rojo }]}>
                {evaluado.documento ?? "—"}
              </Text>
            </Text>
            <Text>
              Nombre:{" "}
              <Text style={[e.cursiva, e.negrita, { color: COLORES.azul }]}>
                {evaluado.nombre}
              </Text>
            </Text>
            {evaluado.empresa ? (
              <Text>
                Empresa:{" "}
                <Text style={[e.cursiva, e.negrita, { color: COLORES.azul }]}>
                  {evaluado.empresa}
                </Text>
              </Text>
            ) : null}
            {fechaDelInforme(evaluado.fechaISO) ? (
              <Text>
                Fecha de aplicación:{" "}
                <Text style={[e.cursiva, e.negrita, { color: COLORES.azul }]}>
                  {fechaDelInforme(evaluado.fechaISO)}
                </Text>
              </Text>
            ) : null}
          </View>
        </View>

        {notaGlobal ? (
          <Text
            style={{
              borderLeftWidth: 2,
              borderLeftColor: COLORES.azul,
              paddingLeft: 6,
              marginBottom: 8,
            }}
          >
            {notaGlobal}
          </Text>
        ) : null}

        {/* 1 · Resumen del perfil clásico */}
        {datos.hayDisc ? (
          <>
            <Text style={e.banda}>RESUMEN DEL PERFIL CLÁSICO</Text>

            <Text style={[e.negrita, { textAlign: "center", marginTop: 6 }]}>
              Perfil DISC evaluado
            </Text>
            {/* `lineHeight` explícito: con el de la página —1.4— dos líneas
                de 16 puntos seguidas se montan la una sobre la otra. */}
            <Text
              style={[
                e.negrita,
                {
                  textAlign: "center",
                  fontSize: 16,
                  lineHeight: 1.2,
                  color: COLORES.azul,
                },
              ]}
            >
              {datos.patron ?? "Sin patrón determinado"}
            </Text>
            {datos.codigo ? (
              <Text
                style={[
                  e.negrita,
                  {
                    textAlign: "center",
                    fontSize: 16,
                    lineHeight: 1.2,
                    marginTop: 2,
                    color: COLORES.rojo,
                  },
                ]}
              >
                {datos.codigo}
              </Text>
            ) : null}

            <Text style={e.banda}>CARACTERÍSTICAS DEL PERFIL</Text>

            <View style={[e.fila, { marginTop: 6 }]}>
              <Text style={{ flex: 1 }}>
                {datos.resumen ??
                  "Este código de segmentos no corresponde a ninguno de los patrones descritos."}
              </Text>
              <View
                style={{
                  flex: 1,
                  borderWidth: 0.5,
                  borderColor: COLORES.grisBanda,
                  padding: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    height: 110,
                    gap: 8,
                  }}
                >
                  {datos.escalas.map((s) => (
                    <View
                      key={s.clave}
                      style={{ flex: 1, alignItems: "center" }}
                    >
                      <Text style={[e.negrita, { color: s.fuerte }]}>
                        {s.puntaje ?? 0}
                      </Text>
                      <View
                        style={{
                          width: "100%",
                          backgroundColor: s.fuerte,
                          height: Math.max(4, ((s.puntaje ?? 0) / 7) * 90),
                        }}
                      />
                    </View>
                  ))}
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {/* Un rectángulo dibujado y no un carácter «■»: la fuente
                      base del PDF no lo tiene, y salía un hueco. */}
                  {datos.escalas.map((s, i) => (
                    <View
                      key={s.clave}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          backgroundColor: s.fuerte,
                        }}
                      />
                      <Text style={{ fontSize: 6 }}>
                        ({s.clave}) {nombres[i]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              {datos.recuadros.map((r) => (
                <Recuadro key={r.titulo} titulo={r.titulo} cuerpo={r.cuerpo} />
              ))}
            </View>
          </>
        ) : null}

        {/* 2 · Las cuatro escalas */}
        {datos.hayDisc ? (
          <View break>
            <Text style={e.banda}>
              CARACTERÍSTICAS INDIVIDUALES DE PERSONALIDAD
            </Text>
            <View style={e.leyenda}>
              <Text>Puntaje bajo 0-2</Text>
              <Text>Puntaje medio 3-5</Text>
              <Text>Puntaje alto 6-7</Text>
            </View>

            {datos.escalas.map((s) => (
              <View
                key={s.clave}
                wrap={false}
                style={{
                  flexDirection: "row",
                  gap: 6,
                  borderWidth: 1.5,
                  borderColor: s.fuerte,
                  padding: 5,
                  marginTop: 6,
                }}
              >
                <Text
                  style={{
                    width: 30,
                    backgroundColor: s.fuerte,
                    color: COLORES.blanco,
                    fontFamily: "Helvetica-Bold",
                    fontSize: 22,
                    textAlign: "center",
                    paddingTop: 10,
                  }}
                >
                  {s.clave}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text style={[e.negrita, { fontSize: 9 }]}>
                    {s.titulo.toUpperCase()}
                  </Text>
                  {s.descripcion ? (
                    <Text style={{ marginTop: 2 }}>{s.descripcion}</Text>
                  ) : null}
                  {s.claves ? (
                    <Text style={[e.cursiva, { marginTop: 3, fontSize: 7.5 }]}>
                      Características clave: {s.claves}
                    </Text>
                  ) : null}
                  {s.interpretacion ? (
                    <>
                      <Text style={[e.cursiva, { marginTop: 3, fontSize: 7 }]}>
                        Interpretación del puntaje:
                      </Text>
                      <Text
                        style={[
                          e.cursiva,
                          {
                            backgroundColor: COLORES.grisBanda,
                            padding: 3,
                            fontSize: 7.5,
                          },
                        ]}
                      >
                        {s.interpretacion}
                      </Text>
                    </>
                  ) : null}
                </View>

                {s.puntaje !== null ? (
                  <View
                    style={{
                      width: 40,
                      backgroundColor: s.suave,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 6,
                    }}
                  >
                    {/* `lineHeight: 1`: sin él la caja de línea de un número
                        de 20 puntos se come la etiqueta de debajo y salen
                        superpuestos. Se vio en el PDF, no en la pantalla. */}
                    <Text style={[e.negrita, { fontSize: 20, lineHeight: 1 }]}>
                      {s.puntaje}
                    </Text>
                    <Text
                      style={[
                        e.cursiva,
                        e.negrita,
                        { fontSize: 7, lineHeight: 1, marginTop: 3 },
                      ]}
                    >
                      {s.tramo}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* 3 · Dominancia cerebral */}
        {datos.hayCuadrantes ? (
          <View break>
            <Text style={e.banda}>ANÁLISIS DE LA DOMINANCIA CEREBRAL</Text>

            <View style={[e.fila, { marginTop: 6, alignItems: "center" }]}>
              <View style={{ flex: 1, gap: 20 }}>
                <TarjetaPdf bloque={datos.cuadrantes[0]} />
                <TarjetaPdf bloque={datos.cuadrantes[1]} />
              </View>
              {imagenes.cerebro ? (
                <Image
                  src={imagenes.cerebro}
                  style={{ width: 110, height: 118 }}
                />
              ) : null}
              <View style={{ flex: 1, gap: 20 }}>
                <TarjetaPdf bloque={datos.cuadrantes[3]} />
                <TarjetaPdf bloque={datos.cuadrantes[2]} />
              </View>
            </View>

            <View style={e.leyenda}>
              <Text>Rango 80-100 = primario</Text>
              <Text>60-79 = secundario</Text>
              <Text>0-59 = terciario</Text>
            </View>

            <Text style={e.bandaGris}>PERFIL NEUROLATERAL DE PREFERENCIA</Text>

            {datos.cuadrantes.map((c) => (
              <View
                key={c.clave}
                wrap={false}
                style={{
                  borderWidth: 0.5,
                  borderColor: c.fuerte,
                  padding: 5,
                  marginTop: 6,
                }}
              >
                <Text
                  style={{
                    backgroundColor: c.fuerte,
                    color: COLORES.blanco,
                    fontFamily: "Helvetica-Bold",
                    fontSize: 7,
                    paddingVertical: 1,
                    paddingHorizontal: 4,
                    alignSelf: "flex-start",
                  }}
                >
                  {c.titulo.toUpperCase()}
                </Text>

                <View style={[e.fila, { marginTop: 4 }]}>
                  <View style={{ flex: 1 }}>
                    {c.descripcion ? <Text>{c.descripcion}</Text> : null}
                    {c.interpretacion ? (
                      <Text
                        style={[
                          e.cursiva,
                          {
                            borderWidth: 0.5,
                            borderColor: COLORES.grisBanda,
                            padding: 4,
                            marginTop: 3,
                            fontSize: 7.5,
                          },
                        ]}
                      >
                        {c.interpretacion}
                      </Text>
                    ) : null}
                  </View>
                  {c.puntaje !== null ? (
                    <View
                      style={{
                        width: 40,
                        backgroundColor: c.suave,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={[e.negrita, { fontSize: 16, lineHeight: 1 }]}
                      >
                        {c.puntaje}
                      </Text>
                      <Text
                        style={[
                          e.cursiva,
                          e.negrita,
                          { fontSize: 6, lineHeight: 1, marginTop: 3 },
                        ]}
                      >
                        {c.tramo}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}

            {datos.neurolateral ? (
              <View style={{ marginTop: 6 }}>
                <Recuadro
                  titulo={datos.neurolateral.titulo}
                  cuerpo={datos.neurolateral.cuerpo}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {datos.recomendacion ? (
          <View>
            <Text style={e.banda}>RECOMENDACIÓN PROFESIONAL</Text>
            <Text style={{ marginTop: 6 }}>{datos.recomendacion}</Text>
          </View>
        ) : null}

        {/*
          El consentimiento CIERRA el documento.
          
          En el que se entregaba hoy abría, y se movió al final a propósito:
          quien recibe el informe viene a leer un perfil, no un contrato. Va
          detrás como el respaldo de que la persona supo a qué accedía —que es
          para lo que sirve— y en su propia página, para poder separarlo.
        */}
        {consentimiento ? (
          <View break>
            <Text style={e.banda}>CONSENTIMIENTO INFORMADO</Text>

            {consentimiento.secciones ? (
              <View style={{ marginTop: 6 }}>
                {consentimiento.secciones.map((sec) => (
                  <View
                    key={sec.titulo}
                    style={{ marginBottom: 4 }}
                    wrap={false}
                  >
                    <Text style={e.negrita}>{sec.titulo}</Text>
                    {(Array.isArray(sec.cuerpo)
                      ? sec.cuerpo
                      : [sec.cuerpo]
                    ).map((parrafo, n) => (
                      <Text key={n}>{parrafo}</Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ marginTop: 6 }}>
                El texto de la versión {consentimiento.version} está archivado
                con el documento firmado. Aquí consta su aceptación.
              </Text>
            )}

            <View
              style={{
                marginTop: 18,
                marginHorizontal: "auto",
                width: 200,
                borderTopWidth: 0.5,
                borderTopColor: COLORES.tinta,
                paddingTop: 2,
                alignItems: "center",
              }}
            >
              <Text
                style={[
                  e.negrita,
                  e.cursiva,
                  { fontSize: 6.5, color: COLORES.rojo },
                ]}
              >
                ACEPTACIÓN ELECTRÓNICA
              </Text>
              <Text style={[e.negrita, { color: COLORES.azul }]}>
                {consentimiento.nombre}
              </Text>
              {consentimiento.documento ? (
                <Text style={e.negrita}>ID {consentimiento.documento}</Text>
              ) : null}
              <Text style={{ fontSize: 6.5 }}>
                Versión {consentimiento.version}
                {momentoDelAcuse(consentimiento.aceptadoEl)
                  ? ` · ${momentoDelAcuse(consentimiento.aceptadoEl)}`
                  : ""}
              </Text>
            </View>
          </View>
        ) : null}

        <Text
          fixed
          render={({ pageNumber, totalPages }) =>
            `${evaluado.nombre} · página ${pageNumber} de ${totalPages}`
          }
          style={{
            position: "absolute",
            bottom: 16,
            left: 32,
            right: 32,
            textAlign: "center",
            fontSize: 6.5,
            color: COLORES.azul,
          }}
        />
      </Page>
    </Document>
  );
}

/** Uno de los cuatro recuadros que rodean el cerebro. */
function TarjetaPdf({
  bloque,
}: {
  bloque: EstructuraInforme["cuadrantes"][number];
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: bloque.fuerte,
          paddingHorizontal: 3,
          paddingVertical: 1,
        }}
      >
        <Text
          style={{
            color: COLORES.blanco,
            fontFamily: "Helvetica-Bold",
            fontSize: 7,
            flex: 1,
          }}
        >
          {bloque.titulo.toUpperCase()}
        </Text>
        {bloque.puntaje !== null ? (
          <Text
            style={{
              backgroundColor: COLORES.blanco,
              fontFamily: "Helvetica-Bold",
              fontSize: 10,
              paddingHorizontal: 4,
            }}
          >
            {bloque.puntaje}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 5.5, fontFamily: "Helvetica-Oblique" }}>
        {bloque.subtitulo}
      </Text>
      {bloque.descriptores ? (
        <Text style={{ fontSize: 5.5, fontFamily: "Helvetica-Bold" }}>
          {bloque.descriptores.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * El informe de una evaluación, como PDF.
 *
 * Devuelve el archivo en base64, que es como viaja en un adjunto de correo.
 */
export async function informeComoPdf({
  parametros,
  valores,
  textosFijos,
  notaGlobal,
  evaluado,
  consentimiento = null,
}: {
  parametros: ParametroInforme[];
  valores: ValorInforme[];
  textosFijos: Record<string, string>;
  notaGlobal: string | null;
  evaluado: EvaluadoInforme;
  consentimiento?: ConsentimientoInforme | null;
}): Promise<string> {
  const datos = estructuraDelInforme({ parametros, valores, textosFijos });

  const [neurodisc, firma, cerebro] = await Promise.all([
    imagen("neurodisc.png"),
    imagen("jbr-firma.png"),
    imagen("cerebro-cuadrantes.png"),
  ]);

  const blob = await pdf(
    <Documento
      datos={datos}
      evaluado={evaluado}
      notaGlobal={notaGlobal}
      consentimiento={consentimiento}
      imagenes={{ neurodisc, firma, cerebro }}
    />,
  ).toBlob();

  return Buffer.from(await blob.arrayBuffer()).toString("base64");
}

/**
 * El PDF de una evaluación, listo para adjuntar.
 *
 * Lee lo que hace falta con la clave de servicio: lo llama el cierre
 * automático, que corre sin sesión de nadie —quien acaba de responder no tiene
 * cuenta y la empresa no está mirando—.
 *
 * NUNCA LANZA. Si algo falla se devuelve nulo y el correo sale sin adjunto:
 * quedarse sin PDF es un contratiempo, quedarse sin aviso de que hay un
 * informe es perder el circuito entero.
 */
export async function informeAdjunto(
  asignacion: string,
  evaluado: EvaluadoInforme,
): Promise<string | null> {
  try {
    const { crearClienteAdmin } = await import("@/lib/supabase/admin");
    const admin = crearClienteAdmin();

    const { data: cabecera } = await admin
      .from("assignments")
      .select("assessment_id")
      .eq("id", asignacion)
      .maybeSingle();

    if (!cabecera) return null;

    const [
      { data: valores },
      { data: resultado },
      { data: parametros },
      { data: fijos },
    ] = await Promise.all([
      admin
        .from("result_values")
        .select("parameter_key, valor, sugerido, nota")
        .eq("assignment_id", asignacion),
      admin
        .from("results")
        .select("nota_global")
        .eq("assignment_id", asignacion)
        .maybeSingle(),
      admin
        .from("assessment_parameters")
        .select("clave, etiqueta, kind, seccion")
        .eq("assessment_id", cabecera.assessment_id)
        .order("posicion"),
      admin.rpc("textos_fijos_del_instrumento", {
        p_assessment: cabecera.assessment_id,
      }),
    ]);

    if (!valores || valores.length === 0) return null;

    const { consentimientoFirmado } =
      await import("@/lib/evaluaciones/consentimiento-firmado");

    return await informeComoPdf({
      consentimiento: await consentimientoFirmado(admin, asignacion, evaluado),
      valores: valores as ValorInforme[],
      parametros: (parametros ?? []) as ParametroInforme[],
      textosFijos: Object.fromEntries(
        ((fijos ?? []) as { parameter_key: string; cuerpo: string }[]).map(
          (t) => [t.parameter_key, t.cuerpo],
        ),
      ),
      notaGlobal: resultado?.nota_global ?? null,
      evaluado,
    });
  } catch (fallo) {
    console.error(
      "[informe] no se pudo generar el PDF:",
      fallo instanceof Error ? fallo.message : "fallo desconocido",
    );
    return null;
  }
}
