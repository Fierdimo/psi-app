import { Download } from "lucide-react";
import { notFound } from "next/navigation";

import { EnlacesDeAcceso } from "@/components/citas/enlaces-de-acceso";
import { ReenviarPase } from "@/components/empresa/reenviar-pase";
import {
  Informe,
  type ParametroInforme,
  type ValorInforme,
} from "@/components/evaluaciones/informe";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { consentimientoFirmado } from "@/lib/evaluaciones/consentimiento-firmado";
import { estadoParaLaEmpresa } from "@/lib/evaluaciones/estados-empresa";
import { fechaLarga } from "@/lib/fechas/formato";
import { origenDeLaPeticion } from "@/lib/http/origen";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Una evaluación encargada, entera.
 *
 * Es lo que antes estaban en dos pantallas: la ficha con el enlace de acceso y
 * el informe publicado. Aquí es una sola cosa que cambia de contenido según el
 * punto en que esté, porque eso es lo que es.
 *
 * Se dibuja igual dentro del modal y en su página propia. Duplicarla dejaría
 * dos versiones del informe que se separan al primer arreglo que se aplique
 * solo a una — y la persona evaluada tiene derecho a que lo que se dijo de
 * ella sea una sola cosa.
 */
export async function FichaDeEvaluacion({
  id,
  avisos,
}: {
  id: string;
  /**
   * Lo que llega por la dirección al acabar de encargarla.
   *
   * Solo existe en la ruta directa: se llega aquí por una redirección del
   * servidor, no navegando, así que el modal interceptado nunca los ve — y no
   * debe, porque abrir una evaluación de la semana pasada no es «recién
   * encargada».
   */
  avisos?: { nueva?: string; correo?: string };
}) {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const { data: evaluacion } = await supabase
    .from("assignments")
    .select(
      "id, status, assessment_id, assigned_at, persona:organization_people(nombre, apellidos, email, documento), prueba:assessments(nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  // La política de RLS ya filtró por organización: si no aparece, o no existe
  // o no es suya, y las dos respuestas correctas son la misma.
  if (!evaluacion) notFound();

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const persona = uno<{
    nombre: string;
    apellidos: string | null;
    email: string;
    documento: string | null;
  }>(evaluacion.persona);
  const prueba = uno<{ nombre: string }>(evaluacion.prueba);

  const etiqueta = estadoParaLaEmpresa(evaluacion.status);
  const publicada = evaluacion.status === "publicada";
  const zona = perfil.timezone;

  const nombre =
    [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") ||
    persona?.email ||
    "Sin nombre";

  /*
   * El informe y el pase NO se piden los dos.
   *
   * Una evaluación publicada no tiene pase —se apaga al enseñarle su informe a
   * quien respondió (migración 0055)— y una sin publicar no tiene informe. Dos
   * consultas de las que una siempre sale vacía son dos viajes a la base por
   * pantalla, para siempre.
   */
  const informe = publicada
    ? await leerInforme(
        id,
        evaluacion.assessment_id,
        perfil.organization_id,
        nombre,
        persona?.documento ?? null,
      )
    : null;
  const pase = publicada ? null : await leerPase(id);

  return (
    <div className="flex flex-col gap-6">
      {/*
        El acuse de recibo, y el aviso si el correo no salió.

        Van arriba del todo y no junto al enlace: quien acaba de gastar un uso
        necesita saber ANTES que nada si le llegó a la persona, porque de eso
        depende lo siguiente que haga —esperar, o copiar el enlace y mandarlo
        por otra vía—.
      */}
      {avisos?.correo === "fallo" ? (
        <Alert tone="warning" title="La evaluación se creó, el correo no salió">
          El uso ya se descontó y el enlace de abajo es válido. Cópialo o
          enséñale el QR, y prueba a reenviar el correo cuando quieras.
        </Alert>
      ) : avisos?.nueva === "1" ? (
        <Alert tone="success" title="Evaluación encargada">
          Le enviamos su enlace a {persona?.email}. Aquí lo tienes también, por
          si prefieres dárselo en persona.
        </Alert>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
          <span className="text-text-body text-sm">{etiqueta.explicacion}</span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-4">
          <Dato titulo="Persona" valor={nombre} />
          <Dato titulo="Correo" valor={persona?.email ?? "—"} />
          <Dato
            titulo="Documento"
            valor={persona?.documento ?? "Sin documento"}
          />
          <Dato
            titulo="Encargada"
            valor={fechaLarga(evaluacion.assigned_at, zona)}
          />
        </dl>
      </header>

      <div className="border-line border-t pt-6">
        {publicada ? (
          informe ? (
            <div className="flex flex-col gap-4">
              {/*
                Descargar, no imprimir.

                Da EXACTAMENTE el mismo archivo que salió por correo —lo genera
                la misma función— así que quien lo archive aquí y quien lo
                archive desde el correo tienen el mismo documento. Imprimir
                sigue estando y sirve para papel; esto es para guardar.
              */}
              <div className="flex justify-end print:hidden">
                <a
                  href={`/api/informe/${id}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  <Download aria-hidden="true" className="size-4" />
                  Descargar el PDF
                </a>
              </div>

              <Informe
                parametros={informe.parametros}
                valores={informe.valores}
                notaGlobal={informe.notaGlobal}
                textosFijos={informe.textosFijos}
                evaluado={{
                  nombre,
                  documento: persona?.documento ?? null,
                  empresa: informe.empresa,
                  fechaISO: evaluacion.assigned_at,
                }}
                consentimiento={informe.consentimiento}
              />
            </div>
          ) : (
            /* Publicada y sin valores: no debería pasar, pero callarlo dejaría
               una pantalla en blanco sin explicación. */
            <Alert tone="warning" title="El informe no se pudo cargar">
              La evaluación figura como publicada pero sus resultados no están
              disponibles. Escríbenos y lo revisamos.
            </Alert>
          )
        ) : pase?.token ? (
          <div className="flex flex-col gap-5">
            <EnlacesDeAcceso
              enlaces={[
                {
                  nombre,
                  correo: persona?.email ?? "",
                  enlace: `${pase.origen}/prueba/${pase.token}`,
                },
              ]}
              zona={zona}
              titulo="Su acceso"
              nota="El mismo que le llega por correo. Enséñale el QR y que lo escanee con su teléfono, o cópiaselo."
            />

            <ReenviarPase evaluacion={id} />
          </div>
        ) : (
          <Alert tone="info" title="Esta evaluación ya no tiene enlace vivo">
            {evaluacion.status === "enviada" ||
            evaluacion.status === "calificada"
              ? "Respondió y su informe se está preparando. Aparecerá aquí."
              : "El plazo pasó sin que respondiera. Si aún hace falta evaluarla, habrá que encargarla de nuevo."}
          </Alert>
        )}
      </div>
    </div>
  );
}

/**
 * El informe publicado, con todo lo que hace falta para dibujarlo.
 *
 * Los textos fijos —qué mide cada escala— van aparte de los valores porque no
 * son del resultado de nadie: son del instrumento, iguales para todo el mundo,
 * y por eso no se copian en cada `result_values`.
 */
async function leerInforme(
  id: string,
  assessmentId: string,
  organizacion: string,
  nombreDelEvaluado: string,
  documentoDelEvaluado: string | null,
) {
  const supabase = await crearClienteServidor();

  const [
    { data: valores },
    { data: resultado },
    { data: parametros },
    { data: fijos },
    { data: empresa },
  ] = await Promise.all([
    supabase
      .from("result_values")
      .select("parameter_key, valor, sugerido, nota")
      .eq("assignment_id", id),
    supabase
      .from("results")
      .select("nota_global")
      .eq("assignment_id", id)
      .maybeSingle(),
    supabase
      .from("assessment_parameters")
      .select("clave, etiqueta, kind, seccion")
      .eq("assessment_id", assessmentId)
      .order("posicion"),
    supabase.rpc("textos_fijos_del_instrumento", {
      p_assessment: assessmentId,
    }),
    supabase
      .from("organizations")
      .select("nombre")
      .eq("id", organizacion)
      .maybeSingle(),
  ]);

  if (!valores || valores.length === 0) return null;

  return {
    consentimiento: await consentimientoFirmado(supabase, id, {
      nombre: nombreDelEvaluado,
      documento: documentoDelEvaluado,
      empresa: empresa?.nombre ?? null,
    }),
    valores: valores as ValorInforme[],
    parametros: (parametros ?? []) as ParametroInforme[],
    notaGlobal: resultado?.nota_global ?? null,
    textosFijos: Object.fromEntries(
      ((fijos ?? []) as { parameter_key: string; cuerpo: string }[]).map(
        (t) => [t.parameter_key, t.cuerpo],
      ),
    ),
    empresa: empresa?.nombre ?? null,
  };
}

/** El testigo vivo, si lo hay, y la dirección con la que armar el enlace. */
async function leerPase(id: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase.rpc("pase_de_evaluacion", {
    p_assignment: id,
  });

  const fila = (data ?? [])[0] as { token: string | null } | undefined;
  if (!fila?.token) return null;

  return { token: fila.token, origen: await origenDeLaPeticion() };
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-text-muted text-sm">{titulo}</dt>
      <dd className="text-text-strong">{valor}</dd>
    </div>
  );
}

/**
 * El nombre con el que se titula el modal.
 *
 * Una consulta aparte y mínima, en vez de sacarla de la ficha: el título vive
 * en la cabecera del modal —fuera del contenido— y hacer que la ficha se lo
 * devolviera al padre obligaría a partirla en dos componentes que siempre van
 * juntos. Es una lectura de una fila por apertura.
 */
export async function nombreDeEvaluacion(id: string): Promise<string> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("assignments")
    .select("persona:organization_people(nombre, apellidos, email)")
    .eq("id", id)
    .maybeSingle();

  const persona = (
    Array.isArray(data?.persona) ? data?.persona[0] : data?.persona
  ) as { nombre: string; apellidos: string | null; email: string } | undefined;

  if (!persona) return "Evaluación";

  return (
    [persona.nombre, persona.apellidos].filter(Boolean).join(" ") ||
    persona.email
  );
}
