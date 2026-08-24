import { NextResponse, type NextRequest } from "next/server";

import { obtenerPerfil } from "@/lib/auth/perfil";
import { informeAdjunto } from "@/lib/evaluaciones/informe-pdf";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * El informe de una evaluación, para descargar.
 *
 * ES EL MISMO ARCHIVO QUE SALE POR CORREO. No una versión «para la web»: lo
 * genera la misma función, sobre la misma estructura, así que quien compare el
 * adjunto con lo que se bajó aquí no encuentra diferencias — que es justo lo
 * que hace creíble un entregable.
 *
 * Se descarga en vez de imprimirse. Imprimir sigue estando en la pantalla y
 * sirve para papel; esto es para archivar, y da el mismo archivo que el correo.
 *
 * -------------------------------------------------------------------------
 * QUIÉN PUEDE: el profesional, y la empresa que encargó ESA evaluación. Se
 * comprueba aquí y contra la base, no confiando en que solo se enseñe el botón
 * a quien toca: una dirección adivinable no puede depender de que nadie la
 * escriba a mano.
 *
 * Quien respondió NO entra por aquí. Su copia le llegó por correo y su enlace
 * se apagó al enseñársela (migración 0055); abrir esta puerta a `anon` sería
 * deshacer eso.
 * -------------------------------------------------------------------------
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const perfil = await obtenerPerfil();
  if (!perfil) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const supabase = await crearClienteServidor();

  /*
   * La consulta pasa por RLS, así que una empresa solo encuentra lo suyo y el
   * profesional lo encuentra todo. El «no existe» y el «no es tuyo» se
   * responden igual, que es lo correcto: distinguirlos convertiría esta
   * dirección en un detector de evaluaciones ajenas.
   */
  const { data: evaluacion } = await supabase
    .from("assignments")
    .select(
      "status, assigned_at, persona:organization_people(nombre, apellidos, documento), organizacion:organizations(nombre), prueba:assessments(nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!evaluacion) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (evaluacion.status !== "publicada") {
    return NextResponse.json(
      { error: "Esta evaluación todavía no tiene informe" },
      { status: 409 },
    );
  }

  const uno = <T>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const persona = uno<{
    nombre: string;
    apellidos: string | null;
    documento: string | null;
  }>(evaluacion.persona);
  const empresa = uno<{ nombre: string }>(evaluacion.organizacion);
  const prueba = uno<{ nombre: string }>(evaluacion.prueba);

  const nombre =
    [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") ||
    "Sin nombre";

  const pdf = await informeAdjunto(id, {
    nombre,
    documento: persona?.documento ?? null,
    empresa: empresa?.nombre ?? null,
    fechaISO: evaluacion.assigned_at,
  });

  if (!pdf) {
    return NextResponse.json(
      { error: "No se pudo generar el informe" },
      { status: 500 },
    );
  }

  const archivo = `Informe ${prueba?.nombre ?? "evaluación"} - ${nombre}.pdf`;

  return new NextResponse(Buffer.from(pdf, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      /*
       * `attachment` y no `inline`: se pidió descargar. Y el nombre va
       * también en `filename*` codificado, o los acentos del nombre de una
       * persona llegan rotos a quien use un navegador antiguo.
       */
      "Content-Disposition": `attachment; filename="informe.pdf"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
      // Un informe no se cachea en ningún intermediario: lleva datos de salud.
      "Cache-Control": "private, no-store",
    },
  });
}
