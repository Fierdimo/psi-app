import { ClipboardList } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Evaluaciones" };

/** Primero lo que espera por ti, y dentro de eso lo más antiguo. */
const ORDEN: Record<string, number> = {
  enviada: 0,
  calificada: 1,
  en_curso: 2,
  asignada: 3,
  publicada: 4,
};

const ETIQUETA: Record<string, { texto: string; tono: "success" | "warning" | "neutral" }> =
  {
    enviada: { texto: "Por calificar", tono: "warning" },
    calificada: { texto: "Por publicar", tono: "warning" },
    en_curso: { texto: "Respondiendo", tono: "neutral" },
    asignada: { texto: "Asignada", tono: "neutral" },
    publicada: { texto: "Publicada", tono: "success" },
  };

export default async function EvaluacionesPage() {
  await exigirProfesional();

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("assignments")
    .select(
      "id, status, assigned_at, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento), paciente:profiles!assignments_patient_id_fkey(nombre, apellidos), organizacion:organizations(nombre)",
    )
    .order("assigned_at", { ascending: true });

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  type Nombre = { nombre: string; apellidos: string | null };

  const filas = (data ?? [])
    .map((a) => {
      const quien = uno<Nombre>(a.persona) ?? uno<Nombre>(a.paciente);
      return {
        id: a.id,
        status: a.status,
        nombre: quien
          ? [quien.nombre, quien.apellidos].filter(Boolean).join(" ")
          : "Sin nombre",
        instrumento: uno<{ nombre: string }>(a.assessment)?.nombre ?? "",
        empresa: uno<{ nombre: string }>(a.organizacion)?.nombre ?? null,
      };
    })
    .sort((a, b) => (ORDEN[a.status] ?? 9) - (ORDEN[b.status] ?? 9));

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Evaluaciones"
        descripcion="Lo que espera tu revisión aparece primero. Nada llega a la persona ni a su empresa hasta que lo firmes."
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={ClipboardList}
          titulo="Todavía no has asignado ninguna evaluación"
          descripcion="Se asignan desde el detalle de una sesión confirmada: eliges el instrumento una vez y queda para todos los convocados."
          enlace={{ href: "/profesional/agenda", texto: "Ir a la agenda" }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => {
            const etiqueta = ETIQUETA[f.status] ?? {
              texto: f.status,
              tono: "neutral" as const,
            };
            return (
              <li key={f.id}>
                <Link
                  href={`/profesional/evaluaciones/${f.id}`}
                  className="border-line bg-surface hover:border-primary flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="text-text-strong font-medium">{f.nombre}</p>
                    <p className="text-text-muted text-sm">
                      {f.instrumento}
                      {f.empresa ? ` · ${f.empresa}` : ""}
                    </p>
                  </div>
                  <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Pantalla>
  );
}
