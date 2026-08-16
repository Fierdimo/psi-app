import { Badge } from "@/components/ui/badge";

/**
 * El informe, tal como lo lee quien fue evaluado.
 *
 * Se muestra dentro de su evaluación, no en una sección aparte: es la misma
 * cosa en dos momentos —«en revisión» y luego «resultados listos»— y separarla
 * hacía perder el hilo de dónde estaba lo que uno había respondido.
 *
 * Manda SIEMPRE lo que escribió el profesional. La redacción que propone el
 * instrumento es un borrador suyo; si la corrigió, la corregida es la buena y
 * la otra no se enseña. Un informe que muestra las dos invita a compararlas, y
 * lo que la persona tiene delante es un documento firmado, no un proceso.
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

const TITULOS: Record<string, string> = {
  disc: "Tu perfil de comportamiento",
  dominancia: "Tu dominancia cerebral",
};

export function Informe({
  parametros,
  valores,
  notaGlobal,
}: {
  parametros: ParametroInforme[];
  valores: ValorInforme[];
  notaGlobal: string | null;
}) {
  const porClave = new Map(valores.map((v) => [v.parameter_key, v]));
  const secciones = [...new Set(parametros.map((p) => p.seccion ?? "otros"))];

  return (
    /*
      Un informe se LEE, así que aquí sí manda la medida de lectura.
      El armazón usa todo el ancho de la pantalla porque un panel de trabajo lo
      necesita, pero un párrafo de 1.300 px hace perder la línea al volver al
      margen izquierdo. Ancho para la herramienta, medida para el texto.
    */
    <div className="flex max-w-[80ch] flex-col gap-8">
      {notaGlobal ? (
        <div className="border-line bg-panel rounded-xl border p-6">
          <p className="text-text-body">{notaGlobal}</p>
        </div>
      ) : null}

      {secciones.map((seccion) => {
        const deLaSeccion = parametros
          .filter((p) => (p.seccion ?? "otros") === seccion)
          // Un apartado sin nada que decir no se pinta vacío: se omite.
          .filter((p) => {
            const v = porClave.get(p.clave);
            return v && (v.nota || v.sugerido || v.valor !== null);
          });

        if (deLaSeccion.length === 0) return null;

        return (
          <section key={seccion} className="flex flex-col gap-3">
            <h2 className="text-h3">{TITULOS[seccion] ?? "Tu informe"}</h2>

            {deLaSeccion.map((p) => {
              const v = porClave.get(p.clave)!;
              const cuerpo = v.nota ?? v.sugerido;
              const puntaje =
                v.valor === null || v.valor === undefined || p.kind === "texto"
                  ? null
                  : String(v.valor).replace(/^"|"$/g, "");

              return (
                <div
                  key={p.clave}
                  className="border-line bg-panel rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-text-strong font-medium">
                      {p.etiqueta}
                    </h3>
                    {puntaje ? <Badge tone="neutral">{puntaje}</Badge> : null}
                  </div>
                  {cuerpo ? (
                    <p className="text-text-body mt-2 text-sm whitespace-pre-line">
                      {cuerpo}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
