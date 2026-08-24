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
import {
  FiltroEvaluaciones,
  VISTAS,
  type Vista,
} from "@/components/profesional/filtro-evaluaciones";
import {
  TablaEvaluaciones,
  type FilaEvaluacion,
} from "@/components/profesional/tabla-evaluaciones";
import { exigirProfesional } from "@/lib/auth/perfil";
import { ahoraEn, capitalizar, fechaLarga } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Evaluaciones" };

/**
 * Cuántas filas por página.
 *
 * Veinticinco caben en una pantalla de escritorio sin desplazarse mucho y son
 * pocas para el teléfono, que es donde se mira entre sesión y sesión. Subirlo
 * no ahorra clics: quien tiene doscientas no las recorre, las busca.
 */
const POR_PAGINA = 25;

export default async function EvaluacionesPage({
  searchParams,
}: PageProps<"/profesional/evaluaciones">) {
  const perfil = await exigirProfesional();
  const zona = perfil.timezone;

  const parametros = await searchParams;
  const pedida = String(parametros.estado ?? "");
  const vista: Vista = VISTAS.some((v) => v.clave === pedida)
    ? (pedida as Vista)
    : "revisar";
  const busqueda = String(parametros.q ?? "").trim();
  const pagina = Math.max(1, Number(parametros.pagina ?? 1) || 1);

  const supabase = await crearClienteServidor();

  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

  type Nombre = {
    nombre: string;
    apellidos: string | null;
    documento?: string | null;
  };

  /*
   * Las sesiones confirmadas que TODAVÍA NO HAN OCURRIDO.
   *
   * Antes se traían todas las confirmadas, y una sesión sigue en ese estado
   * después de celebrarse: la lista de accesos crecía para siempre con
   * sesiones de hace meses cuyos enlaces ya no sirve enseñar a nadie. Lo que
   * hace falta a mano es lo de hoy y lo que viene.
   */
  const ahoraISO = ahoraEn(zona).toUTC().toISO()!;

  const { data: sesiones } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, organizacion:organizations(nombre), asignaciones:assignments(id)",
    )
    .eq("status", "confirmada")
    .gte("ends_at", ahoraISO)
    /*
     * Solo las sesiones de empresa.
     *
     * Una sesión corporativa ES una sesión de evaluación: si está confirmada y
     * no tiene instrumento, falta un paso. Una cita de terapia no: la mayoría
     * no lleva prueba, y marcarlas todas como «falta asignar» convertiría este
     * aviso en ruido que se aprende a ignorar.
     */
    .not("organization_id", "is", null)
    .order("starts_at");

  /*
   * La búsqueda se resuelve en dos pasos, y no con un `or` sobre las
   * relaciones.
   *
   * Se busca por nombre, documento o empresa, y esos datos viven en tres
   * tablas distintas: la ficha que cargó la empresa, el perfil de un paciente
   * particular, y la organización. PostgREST solo filtra por una relación
   * embebida si se fuerza el cruce, lo que además descartaría las evaluaciones
   * de pacientes que no tienen empresa. Buscar primero los identificadores y
   * filtrar por ellos es más consultas, pero devuelve lo correcto.
   */
  let personas: string[] | null = null;
  let pacientes: string[] | null = null;
  let organizaciones: string[] | null = null;

  if (busqueda) {
    const patron = `%${busqueda}%`;

    const [{ data: fichas }, { data: perfiles }, { data: empresas }] =
      await Promise.all([
        supabase
          .from("organization_people")
          .select("id")
          .or(
            `nombre.ilike.${patron},apellidos.ilike.${patron},documento.ilike.${patron}`,
          ),
        supabase
          .from("profiles")
          .select("id")
          .or(
            `nombre.ilike.${patron},apellidos.ilike.${patron},documento.ilike.${patron}`,
          ),
        supabase.from("organizations").select("id").ilike("nombre", patron),
      ]);

    personas = (fichas ?? []).map((f) => f.id);
    pacientes = (perfiles ?? []).map((p) => p.id);
    organizaciones = (empresas ?? []).map((e) => e.id);
  }

  const conFiltros = <T,>(consulta: T): T => {
    let q = consulta as never as {
      in: (col: string, vals: string[]) => unknown;
      or: (filtro: string) => unknown;
    };

    const estados = VISTAS.find((v) => v.clave === vista)!.estados;
    if (estados.length > 0) q = q.in("status", estados) as typeof q;

    if (busqueda) {
      /*
       * Una lista vacía en `in` no filtra nada en PostgREST, así que se
       * sustituye por un identificador imposible. Sin esto, buscar algo que no
       * existe en fichas pero sí en empresas devolvía TODAS las evaluaciones.
       */
      const nada = "00000000-0000-0000-0000-000000000000";
      const lista = (ids: string[] | null) =>
        ids && ids.length > 0 ? ids.join(",") : nada;

      q = q.or(
        `person_id.in.(${lista(personas)}),patient_id.in.(${lista(pacientes)}),organization_id.in.(${lista(organizaciones)})`,
      ) as typeof q;
    }

    return q as never as T;
  };

  const desde = (pagina - 1) * POR_PAGINA;

  const [{ data, count }, porRevisar, enMarcha] = await Promise.all([
    conFiltros(
      supabase
        .from("assignments")
        .select(
          "id, status, assigned_at, person_id, assessment:assessments(nombre), persona:organization_people(nombre, apellidos, documento), paciente:profiles!assignments_patient_id_fkey(nombre, apellidos, documento), organizacion:organizations(nombre)",
          { count: "exact" },
        ),
    )
      /*
       * De la más reciente a la más antigua, en todas las pestañas.
       *
       * Antes «Por revisar» iba al revés —lo que llevaba más tiempo esperando,
       * primero— con el argumento de que era una cola. Con el giro a
       * evaluaciones por encargo dejó de serlo: no hay cola que drenar porque
       * el informe se publica solo; lo que llega es un flujo, y de un flujo se
       * mira lo último.
       *
       * Y sobre todo: la empresa ve sus evaluaciones de la más reciente a la
       * más antigua. Que el profesional las viera al revés hacía que los dos
       * lados hablaran de «la primera de la lista» refiriéndose a filas
       * distintas.
       */
      .order("assigned_at", { ascending: false })
      /*
       * Desempate estable.
       *
       * Asignar alcanza a todos los convocados de una sesión en el mismo acto,
       * así que decenas comparten `assigned_at` al milisegundo. Sin esto, cada
       * página se calcula por su cuenta y la misma persona aparece en dos
       * mientras otra no aparece en ninguna.
       */
      .order("id", { ascending: false })
      .range(desde, desde + POR_PAGINA - 1),

    // Los contadores de las pestañas, sin traerse las filas.
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .in("status", ["enviada", "calificada"]),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .in("status", ["asignada", "en_curso"]),
  ]);

  const filas: FilaEvaluacion[] = (data ?? []).map((a) => {
    const quien = uno<Nombre>(a.persona) ?? uno<Nombre>(a.paciente);
    return {
      id: a.id,
      status: a.status,
      nombre: quien
        ? [quien.nombre, quien.apellidos].filter(Boolean).join(" ")
        : "Sin nombre",
      documento: quien?.documento ?? null,
      instrumento: uno<{ nombre: string }>(a.assessment)?.nombre ?? "",
      empresa: uno<{ nombre: string }>(a.organizacion)?.nombre ?? null,
      fecha: a.assigned_at,
      personaId: a.person_id ?? null,
    };
  });

  const total = count ?? 0;

  const sinAsignar = (sesiones ?? [])
    .filter((s) => (s.asignaciones ?? []).length === 0)
    .map((s) => ({
      id: s.id,
      starts_at: s.starts_at,
      titular: uno<{ nombre: string }>(s.organizacion)?.nombre ?? "Sesión",
    }));

  /*
   * La dirección de otra página, conservando filtro y búsqueda.
   *
   * Como texto y no como objeto: es lo que espera `Paginacion`, que lo comparte
   * con las listas de la empresa. Un `URLSearchParams` vacío no añade la
   * interrogación, así que la primera página queda limpia.
   */
  const enlace = (destino: number) => {
    const params = new URLSearchParams();
    if (vista !== "revisar") params.set("estado", vista);
    if (busqueda) params.set("q", busqueda);
    if (destino > 1) params.set("pagina", String(destino));

    const cola = params.toString();
    return `/profesional/evaluaciones${cola ? `?${cola}` : ""}`;
  };

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

      <FiltroEvaluaciones
        vista={vista}
        busqueda={busqueda}
        cuentas={{
          revisar: porRevisar.count ?? 0,
          curso: enMarcha.count ?? 0,
        }}
      />

      {filas.length === 0 ? (
        busqueda ? (
          <p className="text-text-muted text-sm">
            Nada coincide con «{busqueda}» aquí. Prueba en otra pestaña: la
            búsqueda se conserva al cambiar.
          </p>
        ) : vista === "revisar" ? (
          <EstadoVacio
            icono={ClipboardList}
            titulo="No hay nada esperando tu revisión"
            descripcion="Cuando alguien envíe su prueba aparecerá aquí para que la califiques. Lo que sigue en marcha está en la pestaña de al lado."
            enlace={{ href: "/profesional/agenda", texto: "Ir a la agenda" }}
          />
        ) : (
          <p className="text-text-muted text-sm">
            No hay ninguna evaluación en este estado.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <TablaEvaluaciones filas={filas} zona={zona} />

          <Paginacion
            pagina={pagina}
            total={total}
            porPagina={POR_PAGINA}
            nombre="evaluaciones"
            enlace={(n) => enlace(n)}
          />
        </div>
      )}
    </Pantalla>
  );
}
