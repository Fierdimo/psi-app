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
import { capitalizar, fechaLarga } from "@/lib/fechas/formato";
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

const ETIQUETA: Record<
  string,
  { texto: string; tono: "success" | "warning" | "neutral" }
> = {
  enviada: { texto: "Por calificar", tono: "warning" },
  calificada: { texto: "Por publicar", tono: "warning" },
  en_curso: { texto: "Respondiendo", tono: "neutral" },
  asignada: { texto: "Asignada", tono: "neutral" },
  publicada: { texto: "Publicada", tono: "success" },
};

export default async function EvaluacionesPage() {
  const perfil = await exigirProfesional();
  const zona = perfil.timezone;

  const supabase = await crearClienteServidor();

  /*
   * Las sesiones confirmadas a las que todavía no se les asignó nada.
   *
   * Sin esto, confirmar una solicitud la hacía desaparecer de la vista: la
   * sesión existía en el calendario y en Evaluaciones no había rastro, así que
   * había que acordarse de volver a la agenda a buscarla. El paso siguiente a
   * confirmar es asignar, y tiene que verse desde donde se asigna.
   */
  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  type Nombre = { nombre: string; apellidos: string | null };

  const { data: sesiones } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, organizacion:organizations(nombre), asignaciones:assignments(id)",
    )
    .eq("status", "confirmada")
    /*
     * Solo las sesiones de empresa.
     *
     * Una sesión corporativa ES una sesión de evaluación: si está confirmada y
     * no tiene instrumento, falta un paso. Una cita de terapia no: la mayoría
     * no lleva prueba, y marcarlas todas como «falta asignar» convertiría este
     * aviso en ruido que se aprende a ignorar. A un paciente se le asigna
     * desde el detalle de su cita, cuando toca.
     */
    .not("organization_id", "is", null)
    .order("starts_at");

  const { data } = await supabase
    .from("assignments")
    .select(
      "id, status, assigned_at, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento), paciente:profiles!assignments_patient_id_fkey(nombre, apellidos), organizacion:organizations(nombre)",
    )
    .order("assigned_at", { ascending: true });

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

  const sinAsignar = (sesiones ?? [])
    .filter((s) => (s.asignaciones ?? []).length === 0)
    .map((s) => ({
      id: s.id,
      starts_at: s.starts_at,
      titular: uno<{ nombre: string }>(s.organizacion)?.nombre ?? "Sesión",
    }));

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Evaluaciones"
        descripcion="Lo que espera tu revisión aparece primero. Nada llega a la persona ni a su empresa hasta que lo firmes."
      />

      {sinAsignar.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-h3">Confirmadas, sin evaluación asignada</h2>
            <p className="text-text-muted mt-1 text-sm">
              Aceptaste estas sesiones pero todavía no elegiste qué instrumento
              se aplica.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {sinAsignar.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/profesional/citas/${s.id}`}
                  className="border-line bg-panel hover:border-accent flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="text-text-strong font-medium">{s.titular}</p>
                    <p className="text-text-muted text-sm">
                      {capitalizar(fechaLarga(s.starts_at, zona))}
                    </p>
                  </div>
                  <Badge tone="warning">Falta asignar</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {filas.length === 0 ? (
        sinAsignar.length > 0 ? (
          // Decir «no has asignado ninguna» debajo de una lista de sesiones que
          // esperan asignación se contradice a sí mismo.
          <p className="text-text-muted text-sm">
            Cuando asignes un instrumento, cada persona aparecerá aquí con su
            estado.
          </p>
        ) : (
          <EstadoVacio
            icono={ClipboardList}
            titulo="Todavía no has asignado ninguna evaluación"
            descripcion="Se asignan desde el detalle de una sesión confirmada: eliges el instrumento una vez y queda para todos los convocados."
            enlace={{ href: "/profesional/agenda", texto: "Ir a la agenda" }}
          />
        )
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
