import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis evaluaciones" };

/**
 * Las evaluaciones de la persona.
 *
 * Existía la pantalla de UNA evaluación pero no había cómo llegar a ella: la
 * asignación se hacía, el correo no la nombraba y en la cuenta no aparecía por
 * ningún lado. Una prueba que nadie encuentra es una prueba que nadie hace.
 *
 * Vive fuera del área de atención —igual que `/evaluacion/[id]`— porque quien
 * llega puede haber sido convocado por una empresa y no ser paciente de nadie.
 */
export default async function MisEvaluacionesPage() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar?siguiente=/evaluacion");

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("assignments")
    .select(
      "id, status, habilitado_at, assessment:assessments(nombre), organizacion:organizations(nombre)",
    )
    .order("assigned_at", { ascending: false });

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  const filas = data ?? [];

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Mis evaluaciones"
        descripcion="Las pruebas que te han asignado y en qué punto está cada una."
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={ClipboardList}
          titulo="No tienes evaluaciones asignadas"
          descripcion="Cuando una empresa o tu profesional te asigne una, aparecerá aquí y te llegará un correo."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((a) => {
            const estado = ESTADO[a.status] ?? {
              texto: a.status,
              tono: "neutral" as const,
            };

            return (
              <li key={a.id}>
                <Link
                  href={`/evaluacion/${a.id}`}
                  className="border-line bg-panel hover:border-accent flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="text-text-strong font-medium">
                      {uno<{ nombre: string }>(a.assessment)?.nombre ??
                        "Evaluación"}
                    </p>
                    <p className="text-text-muted text-sm">
                      {uno<{ nombre: string }>(a.organizacion)?.nombre
                        ? `Solicitada por ${uno<{ nombre: string }>(a.organizacion)?.nombre}`
                        : "Solicitada por tu profesional"}
                    </p>
                  </div>
                  <Badge tone={estado.tono}>{estado.texto}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Pantalla>
  );
}

/*
 * Lo que la persona necesita saber, en sus palabras.
 *
 * `calificada` NO se nombra: para quien respondió es lo mismo que «enviada»
 * —el profesional está revisando— y decirle que ya está calificada le haría
 * preguntar por qué no puede verla.
 */
const ESTADO: Record<
  string,
  { texto: string; tono: "success" | "warning" | "neutral" }
> = {
  asignada: { texto: "Pendiente", tono: "warning" },
  en_curso: { texto: "A medias", tono: "warning" },
  enviada: { texto: "En revisión", tono: "neutral" },
  calificada: { texto: "En revisión", tono: "neutral" },
  publicada: { texto: "Resultados listos", tono: "success" },
  vencida: { texto: "Vencida", tono: "neutral" },
  anulada: { texto: "Anulada", tono: "neutral" },
};
