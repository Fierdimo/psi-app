import { ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { PasesDeSesion } from "@/components/citas/pases-de-sesion";
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

  /*
   * TODAS las confirmadas, no solo las que faltan por asignar.
   *
   * Es la lista de la que salen los accesos de abajo: quien llega a la sesión
   * sin haber recibido su enlace lo necesita esté o no asignado el
   * instrumento, y esas dos cosas no van juntas.
   */
  const confirmadas = (sesiones ?? []).map((s) => ({
    id: s.id,
    starts_at: s.starts_at,
    titular: uno<{ nombre: string }>(s.organizacion)?.nombre ?? "Sesión",
  }));

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
                  className="border-line bg-panel hover:border-accent flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
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

      {/*
        Los accesos, a mano y en el sitio donde se está mirando.

        El caso es concreto: la persona se presenta a su sesión, no recibió el
        correo o lo perdió, y está delante del profesional. Antes había que
        salir a la agenda, buscar la sesión y entrar en su detalle; ahora se
        despliega aquí y se le enseña el QR.

        Van al FINAL y plegados. Esta pantalla promete en su primera línea que
        lo que espera revisión aparece primero, y una lista de accesos por
        delante la desmiente. Son la excepción —alguien que llegó sin su
        enlace—, no lo que se viene a mirar.

        Con `details`: funciona sin JavaScript y el teclado lo maneja solo.
      */}
      {confirmadas.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-h3">Accesos de los convocados</h2>
            <p className="text-text-muted mt-1 text-sm">
              Por si alguien llega sin su enlace. Despliega la sesión y enséñale
              su código.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {confirmadas.map((s) => (
              <li
                key={s.id}
                className="border-line bg-panel rounded-lg border p-4"
              >
                <details className="group flex flex-col gap-3">
                  <summary className="text-text-strong hover:text-accent ease-psi flex cursor-pointer list-none items-center gap-2 font-medium transition-colors duration-150">
                    <ChevronRight
                      aria-hidden="true"
                      className="ease-psi size-4 shrink-0 transition-transform duration-150 group-open:rotate-90"
                    />
                    <span>{s.titular}</span>
                    <span className="text-text-muted text-sm font-normal">
                      {capitalizar(fechaLarga(s.starts_at, zona))}
                    </span>
                  </summary>

                  <PasesDeSesion
                    citaId={s.id}
                    titulo="Accesos de esta sesión"
                    nota="Cada persona tiene el suyo desde que confirmaste la sesión, y es el mismo que sale por correo. Enséñale el QR y que lo escanee con su teléfono."
                  />
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Pantalla>
  );
}
