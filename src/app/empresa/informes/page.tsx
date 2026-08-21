import { ClipboardList } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Paginacion } from "@/components/navegacion/paginacion";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Informes" };

/**
 * Los informes que la empresa encargó.
 *
 * La empresa ve el informe COMPLETO de cada persona que mandó a evaluar: fue
 * su decisión y está en el spec. Lo que no ve, y no aparece por ningún lado,
 * es la hoja de respuestas: contrató un informe, no lo que cada quien marcó.
 *
 * Se listan también las que aún no están publicadas, con su estado y sin
 * enlace. Sin ellas, quien encargó veinte evaluaciones y ve cinco informes no
 * sabe si las otras quince se perdieron o siguen en revisión.
 */
/**
 * Cuántos informes por página.
 *
 * Es la lista que más crece de las tres del área: un informe por persona
 * evaluada, para siempre. Una empresa con dos tandas al año llega a cientos.
 */
const POR_PAGINA = 20;

export default async function InformesPage({
  searchParams,
}: PageProps<"/empresa/informes">) {
  await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const { pagina: pedida } = await searchParams;
  const pagina = Math.max(1, Number(pedida ?? 1) || 1);
  const desde = (pagina - 1) * POR_PAGINA;

  const { data, count } = await supabase
    .from("assignments")
    .select(
      "id, status, assigned_at, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento, cargo)",
      { count: "exact" },
    )
    /*
     * Un desempate estable, o las páginas se solapan.
     *
     * Ordenar solo por la fecha de asignación deja el orden de los empates a criterio de
     * Postgres, y con `range` cada página se calcula en una consulta distinta:
     * la misma fila puede salir en la uno y en la dos, y otra no salir en
     * ninguna. Con la base local eran 16 de 20 repetidas entre página y
     * página. El identificador no se repite nunca.
     */
    .order("assigned_at", { ascending: false })
    .order("id")
    .range(desde, desde + POR_PAGINA - 1);

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  type Persona = {
    nombre: string;
    apellidos: string | null;
    documento: string;
    cargo: string | null;
  };

  const filas = data ?? [];

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Informes"
        descripcion="El resultado de cada persona que mandaste a evaluar. Aparecen cuando el profesional los firma: hasta entonces no existen para nadie."
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={ClipboardList}
          titulo="Todavía no hay informes"
          descripcion="Cuando el profesional aplique una evaluación y firme sus resultados, los verás aquí."
          enlace={{ href: "/empresa/sesiones", texto: "Ver mis sesiones" }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((a) => {
            const persona = uno<Persona>(a.persona);
            const publicado = a.status === "publicada";
            const estado = ESTADO[a.status] ?? {
              texto: a.status,
              tono: "neutral" as const,
            };

            const contenido = (
              <>
                <div className="min-w-0">
                  <p className="text-text-strong font-medium">
                    {persona
                      ? [persona.nombre, persona.apellidos]
                          .filter(Boolean)
                          .join(" ")
                      : "Sin nombre"}
                  </p>
                  <p className="text-text-muted text-sm">
                    {persona?.documento}
                    {persona?.cargo && ` · ${persona.cargo}`}
                    {" · "}
                    {uno<{ nombre: string }>(a.assessment)?.nombre}
                  </p>
                </div>
                <Badge tone={estado.tono}>{estado.texto}</Badge>
              </>
            );

            return (
              <li key={a.id}>
                {publicado ? (
                  <Link
                    href={`/empresa/informes/${a.id}`}
                    className="border-line bg-panel hover:border-accent flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    {contenido}
                  </Link>
                ) : (
                  /* Sin enlace: no hay nada que abrir todavía. Un enlace que
                     lleva a una pantalla vacía se prueba dos veces antes de
                     creerse que no hay nada. */
                  <div className="border-line bg-panel flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    {contenido}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        total={count ?? 0}
        porPagina={POR_PAGINA}
        nombre="informes"
        enlace={(n) =>
          n > 1 ? `/empresa/informes?pagina=${n}` : "/empresa/informes"
        }
      />
    </Pantalla>
  );
}

/*
 * En las palabras de quien encargó, no en las del sistema.
 *
 * `calificada` no se nombra: para la empresa es lo mismo que «enviada» —el
 * profesional está revisando— y decirle que ya está calificada le haría
 * preguntar por qué no puede verla.
 */
const ESTADO: Record<
  string,
  { texto: string; tono: "success" | "warning" | "neutral" }
> = {
  asignada: { texto: "Sin empezar", tono: "neutral" },
  en_curso: { texto: "Respondiendo", tono: "neutral" },
  enviada: { texto: "En revisión", tono: "warning" },
  calificada: { texto: "En revisión", tono: "warning" },
  publicada: { texto: "Listo", tono: "success" },
  vencida: { texto: "Vencida", tono: "neutral" },
  anulada: { texto: "Anulada", tono: "neutral" },
};
