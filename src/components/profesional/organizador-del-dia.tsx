"use client";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BotonPase } from "@/components/citas/boton-pase";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  franjasDelDia,
  guardarReparto,
  type Franja,
} from "@/lib/citas/acciones-reparto";
import type { EstadoFormulario } from "@/lib/validacion/auth";

/**
 * A qué hora atiende a cada convocado.
 *
 * DOS INTENTOS DESCARTADOS antes de este, y los dos por lo mismo: cobraban al
 * profesional un trabajo que no tenía por qué hacer.
 *
 *  1. La rejilla del día con un desplegable por bloque —«¿quién va a las
 *     9?»—. Se leía al revés de como se piensa el problema, y si el día pedido
 *     no era laborable no había bloques que pintar: la empresa pide un sábado,
 *     la consulta no abre en sábado, y no quedaba nada que tocar.
 *  2. Una fila por persona con SU fecha y SU hora. Correcto y exhaustivo, y
 *     para doce convocados eran veinticuatro decisiones donde hacía falta una.
 *
 * Lo que se hace de verdad es «empiezo a las dos y los voy pasando». Así que
 * eso es un control: se elige cuándo empieza el primero y el resto cae detrás,
 * en bloques seguidos, saltándose la pausa y lo que ya esté ocupado. Si la
 * hora que propuso la empresa vale, no hay nada que tocar y basta confirmar.
 *
 * Retocar a uno suelto sigue estando —su desplegable— pero es la excepción, no
 * el precio de entrada.
 */

export type Convocado = {
  person_id: string;
  nombre: string;
  apellidos: string | null;
  documento: string | null;
  cargo: string | null;
  vinculo: string;
  starts_at: string | null;
  /**
   * Cómo va su evaluación, si ya se le asignó una.
   *
   * Vivía en una tercera lista, debajo. La misma gente aparecía en tres
   * listados —hora, acceso y estado— y había que emparejarlos a ojo.
   */
  estado: string | null;
  consentimiento: string | null;
};

export function OrganizadorDelDia({
  citaId,
  convocados,
  fechaInicial,
  horaInicial,
  zona,
}: {
  citaId: string;
  convocados: Convocado[];
  /** Lo que propuso la empresa: el punto de partida, no una obligación. */
  fechaInicial: string;
  horaInicial: string;
  zona: string;
}) {
  const [dia, setDia] = useState(fechaInicial);
  const [franjas, setFranjas] = useState<Franja[] | null>(null);

  /** persona → hora asignada (ISO) o null. Es el plan completo. */
  const [plan, setPlan] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(convocados.map((c) => [c.person_id, c.starts_at])),
  );

  const [estado, setEstado] = useState<EstadoFormulario | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;

    franjasDelDia(dia, zona, citaId).then((f) => {
      if (!vigente) return;
      setFranjas(f);

      /*
       * Al abrir, si nadie tiene hora todavía, se reparte solo desde la que
       * propuso la empresa.
       *
       * Es la propuesta puesta sobre la mesa, no una decisión tomada: se ve el
       * plan completo antes de aceptar y se cambia con un control. Dejarlo
       * vacío obligaba a colocar a doce personas para poder decir «sí, así
       * está bien».
       */
      setPlan((previo) => {
        const alguienColocado = Object.values(previo).some(Boolean);
        if (alguienColocado) return previo;
        return repartir(f, convocados, horaInicial, zona);
      });
    });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, zona, citaId]);

  const nombreDe = (c: Convocado) =>
    [c.nombre, c.apellidos].filter(Boolean).join(" ");

  /** Cambiar la hora de comienzo recoloca a todos, seguidos. */
  function empezarA(hora: string) {
    if (!franjas) return;
    setPlan(repartir(franjas, convocados, hora, zona));
    setEstado(null);
  }

  /**
   * Poner a alguien a una hora. Si ya era de otro, se INTERCAMBIAN.
   *
   * Antes las horas ocupadas salían apagadas, así que mover a Ana a las 9
   * —donde estaba Jorge— eran tres pasos: quitarle la hora a Jorge, dársela a
   * Ana, y acordarse de recolocar a Jorge. Reordenar una tanda de doce con esa
   * mecánica es exactamente el trabajo que esta pantalla existe para ahorrar.
   *
   * Intercambiar y no desplazar en cadena: mover a uno no debe reorganizar el
   * día entero a espaldas de quien lo hace. Se cambian dos y se ven los dos.
   */
  function colocar(persona: string, inicio: string | null) {
    setPlan((previo) => {
      const copia = { ...previo };
      const anterior = copia[persona] ?? null;

      if (inicio) {
        const dueño = Object.keys(copia).find(
          (id) => id !== persona && copia[id] === inicio,
        );
        // Al que la tenía le queda la de este, que puede ser ninguna.
        if (dueño) copia[dueño] = anterior;
      }

      copia[persona] = inicio;
      return copia;
    });
    setEstado(null);
  }

  async function guardar() {
    setGuardando(true);
    setEstado(null);

    const datos = new FormData();
    datos.set("cita", citaId);
    datos.set(
      "reparto",
      JSON.stringify(
        Object.entries(plan)
          .filter(([, inicio]) => inicio)
          .map(([persona, inicio]) => ({ persona, inicio: inicio! })),
      ),
    );

    setEstado(await guardarReparto({ ok: false }, datos));
    setGuardando(false);
  }

  const primera = Object.values(plan).filter(Boolean).sort()[0] as
    string | undefined;

  const sinHora = convocados.filter((c) => !plan[c.person_id]);
  const libres = (franjas ?? []).filter((f) => !f.ocupada);

  return (
    <div className="flex flex-col gap-4">
      {estado?.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Horario guardado" : "No se pudo guardar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      {/* El control que resuelve el caso normal: cuándo empieza el primero. */}
      <div className="border-line bg-sunken flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-body text-sm font-medium">Día</span>
          <input
            type="date"
            value={dia}
            onChange={(e) => {
              setFranjas(null);
              setPlan(
                Object.fromEntries(convocados.map((c) => [c.person_id, null])),
              );
              setDia(e.target.value);
            }}
            className="border-line-interactive bg-panel text-text-strong focus-visible:outline-accent h-10 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-text-body text-sm font-medium">
            Empezar a las
          </span>
          <select
            value={primera ?? ""}
            onChange={(e) => empezarA(horaDe(e.target.value, zona))}
            disabled={libres.length === 0}
            className="border-line-interactive bg-panel text-text-strong focus-visible:outline-accent h-10 min-w-[9rem] rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="">— elige —</option>
            {libres.map((f) => (
              <option key={f.inicio} value={f.inicio}>
                {horaDe(f.inicio, zona)}
              </option>
            ))}
          </select>
        </label>

        {/*
          Solo se habla cuando hay algo que decir.
          
          Aquí vivía una frase explicando que el resto se coloca detrás y que
          cada uno se puede cambiar. Se ve al usarlo —las horas aparecen
          seguidas y cada fila tiene su desplegable—, así que era una
          instrucción para algo que ya se estaba entendiendo solo.
        */}
        {franjas !== null && franjas.length === 0 && (
          <p className="text-text-muted flex-1 text-sm">
            Ese día no atiendes. Elige otro.
          </p>
        )}

        <Button
          type="button"
          onClick={guardar}
          loading={guardando ? "Guardando…" : undefined}
        >
          Guardar el horario
        </Button>
      </div>

      <ul className="border-line divide-line divide-y rounded-lg border">
        {convocados.map((c) => {
          const hora = plan[c.person_id];

          return (
            /*
              DOS LÍNEAS, no una.

              En una sola no cabía todo dentro de un panel de 600px: el nombre
              acababa en «An…» y el documento en «10473733…», que son
              precisamente los dos datos con los que se reconoce a alguien. En
              dos, el nombre ocupa su renglón entero y los controles el suyo,
              siempre en la misma vertical.
            */
            <li key={c.person_id} className="flex flex-col gap-1.5 p-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-text-strong truncate text-sm font-medium">
                  {nombreDe(c)}
                </span>
                {c.estado && (
                  <Badge
                    tone={tono(c.estado, c.consentimiento)}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {etiqueta(c.estado, c.consentimiento)}
                  </Badge>
                )}
              </span>

              <span className="flex items-center gap-2">
                <span className="text-text-muted min-w-0 flex-1 truncate text-xs">
                  {[c.documento, c.cargo].filter(Boolean).join(" · ")}
                </span>

                <BotonPase persona={c.person_id} nombre={nombreDe(c)} />

                {franjas === null ? (
                  <span className="text-text-muted text-sm">…</span>
                ) : (
                  <select
                    value={hora ?? ""}
                    onChange={(e) =>
                      colocar(c.person_id, e.target.value || null)
                    }
                    aria-label={`Hora de ${nombreDe(c)}`}
                    className="border-line-interactive bg-panel text-text-strong focus-visible:outline-accent h-10 w-[9.5rem] shrink-0 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <option value="">— sin hora —</option>
                    {hora && !franjas.some((f) => f.inicio === hora) && (
                      <option value={hora}>{fechaYHora(hora, zona)}</option>
                    )}
                    {franjas.map((f) => {
                      const otro = convocados.find(
                        (o) =>
                          o.person_id !== c.person_id &&
                          plan[o.person_id] === f.inicio,
                      );

                      return (
                        <option
                          key={f.inicio}
                          value={f.inicio}
                          /* Solo se apaga lo que NO es tuyo: otra cita de la
                             agenda. Lo que tiene otro convocado se puede
                             elegir —se intercambian— y la etiqueta dice con
                             quién. */
                          disabled={f.ocupada}
                        >
                          {horaDe(f.inicio, zona)}
                          {f.ocupada
                            ? " · ocupado"
                            : otro
                              ? ` · cambiar con ${otro.nombre}`
                              : ""}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* Su propio hueco: si apareciera y desapareciera dentro del
                    desplegable, la hora se movería de sitio. */}
                <span className="grid w-9 shrink-0 place-items-center">
                  {hora && (
                    <button
                      type="button"
                      onClick={() => colocar(c.person_id, null)}
                      aria-label={`Quitar la hora de ${nombreDe(c)}`}
                      className="text-text-muted hover:bg-accent-soft hover:text-accent ease-psi grid size-9 place-items-center rounded-md transition-colors duration-150"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {sinHora.length > 0 && franjas !== null && (
        <div className="border-line bg-warning-50 flex flex-col gap-1 rounded-lg border p-3">
          <p className="text-warning-700 text-sm font-medium">
            {sinHora.length}{" "}
            {sinHora.length === 1 ? "persona sin hora" : "personas sin hora"}
          </p>
          <p className="text-text-body text-sm">
            {sinHora.map(nombreDe).join(", ")}. No caben en lo que queda del
            día: cámbiate de fecha para citarlas, o confirma y organízalas
            después.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Todos seguidos desde una hora, saltándose lo ocupado.
 *
 * Quien no quepa se queda sin hora, y eso se ve: hay más gente que bloques y
 * es una decisión que el profesional tiene que tomar, no algo que esconder.
 */
function repartir(
  franjas: Franja[],
  convocados: Convocado[],
  desde: string,
  zona: string,
): Record<string, string | null> {
  const plan: Record<string, string | null> = Object.fromEntries(
    convocados.map((c) => [c.person_id, null]),
  );

  const disponibles = franjas.filter(
    (f) => !f.ocupada && horaDe(f.inicio, zona) >= desde,
  );

  convocados.forEach((c, i) => {
    plan[c.person_id] = disponibles[i]?.inicio ?? null;
  });

  return plan;
}

function horaDe(iso: string, zona: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zona,
  });
}

function fechaYHora(iso: string, zona: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zona,
  });
}

/**
 * Cómo va la evaluación de una persona, en dos palabras.
 *
 * El consentimiento manda sobre el estado: mientras no haya consentido, que la
 * prueba esté «asignada» no dice nada útil —no puede empezarla— y quien mira
 * necesita saber a quién le falta decidir, que es lo único que detiene el día.
 */
function etiqueta(estado: string, consentimiento: string | null) {
  if (consentimiento === "rechazado") return "Se negó";
  if (consentimiento !== "aceptado" && estado === "asignada")
    return "Sin consentir";

  return (
    {
      asignada: "Lista para empezar",
      en_curso: "Respondiendo",
      enviada: "Enviada",
      calificada: "Calificada",
      publicada: "Informe listo",
      vencida: "Vencida",
      anulada: "Anulada",
    }[estado] ?? estado
  );
}

function tono(
  estado: string,
  consentimiento: string | null,
): "success" | "warning" | "neutral" | "danger" {
  if (consentimiento === "rechazado") return "danger";
  if (consentimiento !== "aceptado" && estado === "asignada") return "warning";
  if (estado === "publicada") return "success";
  return "neutral";
}
