"use client";

import { CalendarDays, Wand2, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  franjasDelDia,
  guardarReparto,
  type Franja,
} from "@/lib/citas/acciones-reparto";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * El tablero del día.
 *
 * Antes, aceptar una solicitud de empresa era decir «sí» a un bloque de tres
 * horas con diez nombres dentro, sin saber si cabían ni en qué orden. Esto es
 * lo que se mira ANTES de aceptar: cuántos bloques tiene el día, quién va en
 * cada uno, y quién se queda fuera.
 *
 * TRES DECISIONES QUE LO EXPLICAN TODO:
 *
 *  1. El plan se guarda ENTERO. El componente mantiene la hora de todos los
 *     convocados, no solo la de los del día que se está mirando, y manda la
 *     lista completa. Así, cambiar de fecha para aplazar a tres personas no
 *     borra a las que ya estaban colocadas el jueves.
 *
 *  2. Los huecos son legítimos. No se rellena solo: dejar un bloque vacío es
 *     una decisión —un descanso, un margen para el que llega tarde— y una
 *     rejilla que se autocompleta la borra sin preguntar.
 *
 *  3. Quedarse sin sitio también es un estado. Si hay doce personas y siete
 *     bloques, cinco se quedan sin hora y se ven. Esconderlas dejaría aceptar
 *     una sesión que no cabe.
 */

export type Convocado = {
  person_id: string;
  nombre: string;
  apellidos: string | null;
  documento: string | null;
  starts_at: string | null;
};

const INICIAL: EstadoFormulario = { ok: false };

export function OrganizadorDelDia({
  citaId,
  convocados,
  fechaInicial,
  zona,
}: {
  citaId: string;
  convocados: Convocado[];
  /** El día que propuso la empresa: por donde se empieza a mirar. */
  fechaInicial: string;
  zona: string;
}) {
  const [estado, accion, guardando] = useActionState(guardarReparto, INICIAL);

  const [dia, setDia] = useState(fechaInicial);
  const [franjas, setFranjas] = useState<Franja[] | null>(null);

  /** persona → hora asignada (ISO) o null. Es el plan completo. */
  const [plan, setPlan] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(convocados.map((c) => [c.person_id, c.starts_at])),
  );

  useEffect(() => {
    let vigente = true;

    /*
     * El «cargando» se marca al CAMBIAR de día, no dentro del efecto.
     *
     * Vaciar la rejilla aquí encadenaba un render de más por cada carga. Y en
     * la primera —la del día que propuso la empresa— no hay nada que vaciar:
     * ya empieza en nulo.
     */
    franjasDelDia(dia, zona).then((f) => {
      if (vigente) setFranjas(f);
    });

    return () => {
      vigente = false;
    };
  }, [dia, zona]);

  const nombreDe = (c: Convocado) =>
    [c.nombre, c.apellidos].filter(Boolean).join(" ");

  /** Quién está puesto en esta franja, si alguien. */
  const ocupanteDe = (inicio: string) =>
    convocados.find((c) => plan[c.person_id] === inicio) ?? null;

  const sinHora = convocados.filter((c) => !plan[c.person_id]);

  /** Los que están citados otro día: no se tocan al reorganizar este. */
  const enOtroDia = convocados.filter((c) => {
    const hora = plan[c.person_id];
    return hora && !hora.startsWith(dia) && !mismoDia(hora, dia, zona);
  });

  function colocar(inicio: string, persona: string | "") {
    setPlan((previo) => {
      const copia = { ...previo };
      // Quien estuviera en esa franja se queda sin hora: dos personas no caben.
      for (const [id, hora] of Object.entries(copia)) {
        if (hora === inicio) copia[id] = null;
      }
      if (persona) copia[persona] = inicio;
      return copia;
    });
  }

  /**
   * Rellenar los huecos con quien falta, en orden.
   *
   * Es un atajo, no la norma: se pulsa cuando el día está vacío y no se quiere
   * elegir doce veces. Después se puede vaciar cualquier bloque a mano, que es
   * como se dejan los huecos a propósito.
   */
  function autoColocar() {
    if (!franjas) return;

    setPlan((previo) => {
      const copia = { ...previo };
      const pendientes = convocados
        .filter((c) => !copia[c.person_id])
        .map((c) => c.person_id);

      for (const franja of franjas) {
        if (pendientes.length === 0) break;
        if (franja.ocupada) continue;
        if (Object.values(copia).includes(franja.inicio)) continue;
        copia[pendientes.shift()!] = franja.inicio;
      }

      return copia;
    });
  }

  const reparto = Object.entries(plan)
    .filter(([, inicio]) => inicio)
    .map(([persona, inicio]) => ({ persona, inicio: inicio! }));

  const colocados = reparto.length;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="cita" value={citaId} />
      <input type="hidden" name="reparto" value={JSON.stringify(reparto)} />

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Día organizado" : "No se pudo organizar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-body text-sm font-medium">
            Día que estás organizando
          </span>
          <span className="relative inline-flex items-center">
            <CalendarDays
              aria-hidden="true"
              className="text-text-muted pointer-events-none absolute left-3 size-4"
            />
            <input
              type="date"
              value={dia}
              onChange={(e) => {
                setFranjas(null);
                setDia(e.target.value);
              }}
              className="border-line-interactive bg-panel text-text-strong focus-visible:outline-accent h-11 rounded-md border pr-3 pl-9 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={autoColocar}
            disabled={!franjas || sinHora.length === 0}
            className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50"
          >
            <Wand2 aria-hidden="true" className="size-4" />
            Rellenar los huecos
          </button>

          <Button type="submit" loading={guardando ? "Guardando…" : undefined}>
            Guardar el reparto
          </Button>
        </div>
      </div>

      <p className="text-text-muted text-sm">
        {colocados} de {convocados.length}{" "}
        {convocados.length === 1 ? "persona citada" : "personas citadas"}
        {franjas ? ` · el día tiene ${franjas.length} bloques` : ""}
        {enOtroDia.length > 0 ? ` · ${enOtroDia.length} en otro día` : ""}
      </p>

      {franjas === null ? (
        <p className="text-text-muted text-sm">Buscando los bloques del día…</p>
      ) : franjas.length === 0 ? (
        /* Un día sin bloques no es un fallo: es un día que la consulta no
           atiende, o una jornada que no da para uno. Se dice cuál. */
        <Alert tone="info" title="Ese día no tiene bloques">
          O no está entre tus días de atención, o la jornada no da para un
          bloque entero. Se cambia en «La consulta».
        </Alert>
      ) : (
        <ul className="border-line divide-line divide-y rounded-lg border">
          {franjas.map((f) => {
            const ocupante = ocupanteDe(f.inicio);
            const libres = convocados.filter(
              (c) => !plan[c.person_id] || c.person_id === ocupante?.person_id,
            );

            return (
              <li
                key={f.inicio}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <span className="text-text-strong tabular w-20 shrink-0 text-sm font-medium">
                  {hora(f.inicio, zona)}
                </span>

                {f.ocupada && !ocupante ? (
                  /* Ya hay otra cita del profesional encima. Ofrecer el bloque
                     dejaría agendar a dos personas a la vez desde pantallas
                     distintas. */
                  <span className="text-text-muted text-sm">
                    Ocupado por otra cita
                  </span>
                ) : (
                  <>
                    <select
                      value={ocupante?.person_id ?? ""}
                      onChange={(e) => colocar(f.inicio, e.target.value)}
                      aria-label={`Quién va a las ${hora(f.inicio, zona)}`}
                      className="border-line-interactive bg-panel text-text-strong focus-visible:outline-accent h-10 min-w-[14rem] flex-1 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <option value="">— hueco libre —</option>
                      {libres.map((c) => (
                        <option key={c.person_id} value={c.person_id}>
                          {nombreDe(c)}
                          {c.documento ? ` · ${c.documento}` : ""}
                        </option>
                      ))}
                    </select>

                    {ocupante && (
                      <button
                        type="button"
                        onClick={() => colocar(f.inicio, "")}
                        aria-label={`Dejar libre las ${hora(f.inicio, zona)}`}
                        className="text-text-muted hover:bg-accent-soft hover:text-accent ease-psi grid size-9 shrink-0 place-items-center rounded-md transition-colors duration-150"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sinHora.length > 0 && (
        <div className="border-line bg-warning-50 flex flex-col gap-1 rounded-lg border p-3">
          <p className="text-warning-700 text-sm font-medium">
            {sinHora.length}{" "}
            {sinHora.length === 1 ? "persona sin hora" : "personas sin hora"}
          </p>
          <p className="text-text-body text-sm">
            {sinHora.map(nombreDe).join(", ")}. Cámbiate de día para citarlas, o
            acepta la sesión y organízalas después.
          </p>
        </div>
      )}
    </form>
  );
}

function hora(iso: string, zona: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zona,
  });
}

/** ¿Esta hora cae en ese día, mirado desde la zona de la consulta? */
function mismoDia(iso: string, dia: string, zona: string) {
  const f = new Date(iso).toLocaleDateString("en-CA", { timeZone: zona });
  return f === dia;
}
