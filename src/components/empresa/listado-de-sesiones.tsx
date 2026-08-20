import { CalendarDays } from "lucide-react";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Paginacion } from "@/components/navegacion/paginacion";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { fechaLarga, rangoHorario } from "@/lib/fechas/formato";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * El listado de sesiones, aparte de su página.
 *
 * Existe para poder pintarse DETRÁS de un panel. Las rutas de detalle abiertas
 * en directo —al recargar o al pegar la dirección— no pasan por la
 * intercepción, así que sin esto el detalle sustituía a la lista y quien
 * recargaba perdía de vista de dónde había salido.
 */
/** Cómo se nombra cada estado ante la empresa, y con qué tono. */
const ESTADOS: Record<
  string,
  {
    texto: string;
    tone: "neutral" | "accent" | "success" | "warning" | "danger";
  }
> = {
  solicitada: { texto: "A la espera de confirmación", tone: "warning" },
  reprogramacion_solicitada: {
    texto: "Cambio de fecha pedido",
    tone: "warning",
  },
  confirmada: { texto: "Confirmada", tone: "accent" },
  realizada: { texto: "Realizada", tone: "success" },
  no_asistio: { texto: "Nadie asistió", tone: "danger" },
  cancelada: { texto: "Cancelada", tone: "neutral" },
  rechazada: { texto: "Rechazada", tone: "danger" },
};

/**
 * Lo que se puede hacer dentro de cada sesión, dicho desde fuera.
 *
 * Sin esto, todas las tarjetas invitaban igual y había que entrar para
 * descubrir si tocaba corregir la fecha o repartir los accesos. Los estados sin
 * entrada aquí caen en «Ver»: una sesión cancelada se puede consultar, pero no
 * hay nada que hacer con ella.
 */
const ACCION: Record<string, string> = {
  solicitada: "Editar",
  confirmada: "Repartir accesos",
  realizada: "Repartir accesos",
};

/**
 * Cuántas sesiones por página.
 *
 * Una empresa que evalúa cada mes acumula decenas en un año, y la lista se
 * recorre para encontrar una concreta. Veinte caben sin desplazarse mucho.
 */
const POR_PAGINA = 20;

export async function ListadoDeSesiones({ pagina = 1 }: { pagina?: number }) {
  const perfil = await exigirEmpresa();
  const supabase = await crearClienteServidor();

  // El listado de personas se consultaba aquí para un formulario que ya no
  // vive en esta pantalla: convocar se hace desde el panel de la solicitud.
  const desde = (pagina - 1) * POR_PAGINA;

  const { data: sesiones, count } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, patient_note", { count: "exact" })
    .order("starts_at", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);

  const zona = perfil.timezone;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Sesiones de evaluación"
        descripcion="Una sesión reúne a varias personas de tu listado. La solicitas tú; el profesional la confirma cuando el trámite está resuelto."
      >
        {/* Solicitar es un acto aparte de consultar: se abre como panel. */}
        <Link href="/empresa/sesiones/nueva" className={buttonVariants()}>
          <CalendarPlus aria-hidden="true" className="size-4" />
          Solicitar sesión
        </Link>
      </EncabezadoPagina>

      {!sesiones || sesiones.length === 0 ? (
        <EstadoVacio
          icono={CalendarDays}
          titulo="Todavía no has solicitado ninguna sesión"
          descripcion="Cuando solicites una, aparecerá aquí con su estado. No queda en firme hasta que el profesional la confirma."
          enlace={{
            href: "/empresa/sesiones/nueva",
            texto: "Solicitar la primera",
          }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sesiones.map((s) => {
            const estado = ESTADOS[s.status] ?? {
              texto: s.status,
              tone: "neutral" as const,
            };
            return (
              <li key={s.id}>
                {/*
                  La tarjeta ENTERA abre la sesión, en cualquier estado.

                  Antes solo enlazaba mientras era solicitud, para editarla. El
                  resultado era que una sesión confirmada —justo cuando hay algo
                  que hacer, repartir los accesos— no tenía por dónde entrarse:
                  la pantalla existía y no había forma de llegar a ella.

                  Lo que se puede hacer dentro cambia con el estado, y por eso
                  se anuncia aquí: «Editar» mientras la fecha aún se mueve,
                  «Repartir accesos» cuando ya está en firme.
                */}
                <Link
                  href={`/empresa/sesiones/${s.id}`}
                  className="border-line bg-panel hover:border-accent ease-psi flex flex-wrap items-start justify-between gap-4 rounded-lg border p-5 shadow-xs transition-colors duration-150"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-text-strong font-medium">
                      {fechaLarga(s.starts_at, zona)}
                    </p>
                    <p className="text-text-muted tabular text-sm">
                      {rangoHorario(s.starts_at, s.ends_at, zona)}
                    </p>
                    {s.patient_note && (
                      <p className="text-text-body max-w-[62ch] pt-1 text-sm">
                        {s.patient_note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-accent-on-soft text-sm font-medium">
                      {ACCION[s.status] ?? "Ver"}
                    </span>
                    <Badge tone={estado.tone}>{estado.texto}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        total={count ?? 0}
        porPagina={POR_PAGINA}
        nombre="sesiones"
        enlace={(n) =>
          n > 1 ? `/empresa/sesiones?pagina=${n}` : "/empresa/sesiones"
        }
      />
    </Pantalla>
  );
}
