"use client";

import { CalendarPlus, X } from "lucide-react";
import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { BotonPase } from "@/components/citas/boton-pase";
import { useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Field } from "@/components/ui/field";
import { confirmarCita, rechazarCita } from "@/lib/citas/acciones-profesional";
import {
  franjasDeDias,
  guardarReparto,
  huecosSeguidos,
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
 *
 * UNA TANDA NO TIENE POR QUÉ CABER EN UN DÍA, y es el caso normal en cuanto la
 * empresa manda quince personas a una jornada de ocho bloques. El plan es de la
 * SESIÓN, no del día que se está mirando: cambiar de fecha no lo borra, y
 * «continuar en los días siguientes» coloca a los que faltan en los primeros
 * huecos que haya, saltando fines de semana y lo que ya esté tomado.
 *
 * Antes esto era imposible por una línea: al cambiar la fecha se vaciaba el
 * plan entero. El aviso de abajo mandaba a cambiar de fecha, y hacerlo tiraba
 * lo que llevabas hecho.
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
  inicioPropuesto,
  pendiente,
  zona,
}: {
  citaId: string;
  convocados: Convocado[];
  /** Lo que propuso la empresa: el punto de partida, no una obligación. */
  fechaInicial: string;
  horaInicial: string;
  /**
   * Lo mismo, como instante.
   *
   * Hace falta para pedir huecos cuando todavía no hay nadie colocado, y llega
   * ya resuelto desde el servidor: componerlo aquí a partir de la fecha y la
   * hora obligaría a traerse luxon al navegador solo para eso, y hacerlo con
   * `new Date(...)` usaría la zona del equipo en vez de la de la consulta.
   */
  inicioPropuesto: string;
  /**
   * Si la sesión sigue esperando respuesta.
   *
   * Confirmar y rechazar viven AQUÍ y no en un bloque aparte debajo: eran la
   * misma decisión partida en dos sitios, y en el orden equivocado. Se podía
   * confirmar sin haber guardado el horario, y entonces la empresa recibía el
   * correo de una sesión cuyos convocados no tenían hora.
   */
  pendiente: boolean;
  zona: string;
}) {
  const [dia, setDia] = useState(fechaInicial);

  /**
   * La rejilla de CADA día que hay en juego, no solo la del visible.
   *
   * Con una sola, alguien colocado el martes tenía en su desplegable los
   * bloques del lunes: podía quitarse la hora o traerse al lunes, pero no
   * moverse a otra hora de su propio día sin cambiar antes la pantalla de
   * fecha. Teniéndolas todas, cada fila ofrece las horas de su día y las de los
   * demás, agrupadas, y un cambio es un cambio.
   */
  const [rejillas, setRejillas] = useState<Record<string, Franja[]> | null>(
    null,
  );

  /** persona → hora asignada (ISO) o null. Es el plan completo, de TODOS los días. */
  const [plan, setPlan] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(convocados.map((c) => [c.person_id, c.starts_at])),
  );

  const [estado, setEstado] = useState<EstadoFormulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [estirando, setEstirando] = useState(false);

  /*
   * Lo que tiene que decir el botón de continuar, aparte.
   *
   * Compartía el aviso con el de guardar, que se rotula «No se pudo guardar»:
   * un «solo cupieron cuatro de siete» bajo ese título hace pensar que se
   * perdió el reparto, cuando no se ha guardado nada todavía y el plan está
   * entero en la pantalla.
   */
  const [aviso, setAviso] = useState<string | null>(null);

  /** Cuál de los dos diálogos está abierto, si alguno. */
  const [decidiendo, setDecidiendo] = useState<"confirmar" | "rechazar" | null>(
    null,
  );

  const [estadoConfirmar, confirmar, confirmando] = useActionState(
    confirmarCita,
    { ok: false } as EstadoFormulario,
  );
  const [estadoRechazar, rechazar, rechazando] = useActionState(rechazarCita, {
    ok: false,
  } as EstadoFormulario);

  const falloAlDecidir =
    (!estadoConfirmar.ok && estadoConfirmar.mensaje) ||
    (!estadoRechazar.ok && estadoRechazar.mensaje);

  /*
   * Los días que hay que tener cargados: el visible y aquellos en los que hay
   * alguien colocado.
   *
   * Se serializa a una cadena para que el efecto no se dispare en cada render
   * por recibir un arreglo nuevo con el mismo contenido.
   */
  const diasEnJuego = useMemo(() => {
    const dias = new Set<string>([dia]);
    for (const hora of Object.values(plan)) {
      if (hora) dias.add(claveDeDia(hora, zona));
    }
    return [...dias].sort();
  }, [dia, plan, zona]);

  const clavesEnJuego = diasEnJuego.join(",");

  useEffect(() => {
    let vigente = true;
    const dias = clavesEnJuego.split(",");

    franjasDeDias(dias, zona, citaId).then((r) => {
      if (!vigente) return;
      setRejillas(r);

      /*
       * Al abrir, si nadie tiene hora todavía, se reparte solo desde la que
       * propuso la empresa.
       *
       * Es la propuesta puesta sobre la mesa, no una decisión tomada: se ve el
       * plan completo antes de aceptar y se cambia con un control. Dejarlo
       * vacío obligaba a colocar a doce personas para poder decir «sí, así
       * está bien».
       *
       * Solo la PRIMERA vez. Al cambiar de día no se vuelve a repartir: para
       * entonces hay un plan, y rehacerlo sería deshacer lo que se acaba de
       * decidir.
       */
      setPlan((previo) => {
        if (Object.values(previo).some(Boolean)) return previo;

        const delDia = r[dia] ?? [];
        const arranque = delDia.find(
          (x) => !x.ocupada && horaDe(x.inicio, zona) >= horaInicial,
        );
        if (!arranque) return previo;

        return reordenarElDia(
          previo,
          delDia,
          convocados,
          arranque.inicio,
          zona,
        );
      });
    });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavesEnJuego, dia, zona, citaId]);

  const nombreDe = (c: Convocado) =>
    [c.nombre, c.apellidos].filter(Boolean).join(" ");

  /** Cambiar la hora de comienzo recoloca a los de ESTE día, seguidos. */
  function empezarA(inicio: string) {
    if (!franjas || !inicio) return;
    setPlan((previo) =>
      reordenarElDia(previo, franjas, convocados, inicio, zona),
    );
    setEstado(null);
    setAviso(null);
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
    setAviso(null);
  }

  const sinHora = convocados.filter((c) => !plan[c.person_id]);

  /**
   * Los que faltan, en los primeros huecos que haya a partir del final del plan.
   *
   * Se piden EXACTAMENTE los que faltan y a partir del último colocado: así
   * ninguno puede caer encima de alguien que ya tiene sitio, sin tener que
   * mandar el plan entero al servidor para que lo esquive.
   */
  async function continuarEnLosDiasSiguientes() {
    setEstirando(true);
    setEstado(null);
    setAviso(null);

    const colocadas = Object.values(plan).filter(Boolean) as string[];
    const ultima = colocadas.reduce<string | null>(
      (max, h) => (max === null || Date.parse(h) > Date.parse(max) ? h : max),
      null,
    );

    /* Un milisegundo después del último: los bloques de la rejilla empiezan en
       horas fijas, así que esto excluye el suyo y admite el siguiente. */
    const desde = ultima
      ? new Date(Date.parse(ultima) + 1).toISOString()
      : inicioPropuesto;

    const huecos = await huecosSeguidos(desde, sinHora.length, zona, citaId);
    setEstirando(false);

    if (huecos.length === 0) {
      setAviso(
        "No queda ningún hueco libre en los próximos dos meses. Revisa tu horario o libera bloques.",
      );
      return;
    }

    setPlan((previo) => {
      const copia = { ...previo };
      sinHora.forEach((c, i) => {
        const hueco = huecos[i];
        if (hueco) copia[c.person_id] = hueco.inicio;
      });
      return copia;
    });

    if (huecos.length < sinHora.length) {
      setAviso(
        `Solo cupieron ${huecos.length} de ${sinHora.length}. El resto sigue sin hora: revisa tu horario o quítale gente a la tanda.`,
      );
    }
  }

  async function guardar() {
    setGuardando(true);
    setEstado(null);
    setAviso(null);

    const datos = new FormData();
    datos.set("cita", citaId);
    datos.set("reparto", repartoSerializado);

    setEstado(await guardarReparto({ ok: false }, datos));
    setGuardando(false);
  }

  /**
   * En qué días cae la tanda y cuánta gente en cada uno.
   *
   * Con el reparto repartido en tres días, las filas de abajo enseñan la fecha
   * de cada persona pero no la FORMA del plan: hace falta contarlas a mano para
   * saber si el miércoles queda uno suelto. Esto lo dice de un vistazo, y cada
   * jornada lleva a su rejilla.
   */
  const jornadas = useMemo(() => {
    const porDia = new Map<string, { iso: string; cuantos: number }>();

    for (const c of convocados) {
      const hora = plan[c.person_id];
      if (!hora) continue;

      const clave = claveDeDia(hora, zona);
      const previo = porDia.get(clave);
      porDia.set(clave, {
        iso: previo?.iso ?? hora,
        cuantos: (previo?.cuantos ?? 0) + 1,
      });
    }

    return [...porDia.entries()]
      .map(([clave, d]) => ({ clave, ...d }))
      .sort((a, b) => a.clave.localeCompare(b.clave));
  }, [plan, convocados, zona]);

  /* La hora de arranque es la del DÍA VISIBLE, no la del plan entero: mirando
     el miércoles, «empezar a las» tiene que decir a qué hora empieza el
     miércoles. Con el mínimo global salía en blanco. */
  const primeraDelDia = useMemo(() => {
    const delDia = Object.values(plan).filter(
      (h): h is string => Boolean(h) && claveDeDia(h!, zona) === dia,
    );
    return delDia.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  }, [plan, dia, zona]);

  /** Quiénes quedan con hora, para el resumen del diálogo. */
  const citados = convocados.filter((c) => plan[c.person_id]);

  /*
   * El plan, listo para viajar con la confirmación.
   *
   * Es el mismo formato que manda `guardar`, y a propósito: si los dos caminos
   * armaran el reparto distinto, el horario que se guarda dependería del botón
   * que se hubiera pulsado.
   */
  const repartoSerializado = JSON.stringify(
    Object.entries(plan)
      .filter(([, inicio]) => inicio)
      .map(([persona, inicio]) => ({ persona, inicio: inicio! })),
  );

  /* La del día visible, que es la que gobierna «empezar a las». */
  const franjas = rejillas?.[dia] ?? null;
  const libres = (franjas ?? []).filter((f) => !f.ocupada);

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <Alert tone="warning" title="No cupieron todas">
          {aviso}
        </Alert>
      )}

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
              /*
               * El plan NO se toca.
               *
               * Aquí se vaciaba entero, y con eso una tanda de quince no había
               * forma de repartirla en dos días: colocabas ocho el lunes,
               * cambiabas al martes para los siete que sobran, y los ocho del
               * lunes se habían borrado. Cambiar de día es cambiar de rejilla,
               * no empezar de cero.
               *
               * Tampoco se vacía la rejilla: las de los días con gente ya
               * están cargadas, así que volver a uno de ellos es instantáneo.
               * Solo un día nuevo obliga a pedir la suya.
               */
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
            value={primeraDelDia ?? ""}
            onChange={(e) => empezarA(e.target.value)}
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
      </div>

      {/* Solo cuando de verdad se parte: con todo en un día sería una fila que
          repite la fecha que ya está en el encabezado. */}
      {jornadas.length > 1 && (
        <div className="border-line bg-panel flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <span className="text-text-body text-sm font-medium">
            Se reparte en {jornadas.length} jornadas:
          </span>

          {jornadas.map((j) => (
            <button
              key={j.clave}
              type="button"
              onClick={() => setDia(j.clave)}
              aria-current={j.clave === dia ? "true" : undefined}
              className={
                "ease-psi rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 " +
                (j.clave === dia
                  ? "border-accent bg-accent-soft text-accent-on-soft"
                  : "border-line-interactive text-text-body hover:bg-sunken")
              }
            >
              {fechaDe(j.iso, zona)} · {j.cuantos}
            </button>
          ))}
        </div>
      )}

      <ul className="border-line divide-line divide-y rounded-lg border">
        {convocados.map((c) => {
          const hora = plan[c.person_id];
          const otroDia = Boolean(hora && claveDeDia(hora, zona) !== dia);

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

                <BotonPase
                  persona={c.person_id}
                  nombre={nombreDe(c)}
                  zona={zona}
                />

                {rejillas === null ? (
                  <span className="text-text-muted text-sm">…</span>
                ) : (
                  <select
                    value={hora ?? ""}
                    onChange={(e) =>
                      colocar(c.person_id, e.target.value || null)
                    }
                    aria-label={`Hora de ${nombreDe(c)}`}
                    className={
                      "border-line-interactive bg-panel text-text-strong focus-visible:outline-accent h-10 w-[11rem] shrink-0 rounded-md border px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 " +
                      /* Quien está en otro día se marca: en una lista de
                         quince, una hora suelta no dice si es de hoy. */
                      (otroDia ? "border-accent text-accent-on-soft" : "")
                    }
                  >
                    <option value="">— sin hora —</option>

                    {/*
                      Una hora que no está en ninguna rejilla cargada.

                      Pasa si el horario de la consulta cambió después de
                      guardar —ese bloque ya no existe— y es justo cuando hay
                      que verla: sin esta opción el desplegable saldría vacío y
                      parecería que la persona no tiene hora, cuando la tiene y
                      es la que hay que corregir.
                    */}
                    {hora &&
                      !(rejillas[claveDeDia(hora, zona)] ?? []).some(
                        (f) => f.inicio === hora,
                      ) && (
                        <option value={hora}>{fechaYHora(hora, zona)}</option>
                      )}

                    {/*
                      UN GRUPO POR DÍA, y el suyo entre ellos.
                      
                      Aquí solo estaban los bloques del día que se estuviera
                      mirando. Quien había caído en el día siguiente podía
                      quitarse la hora o traerse al día visible, pero no
                      moverse a otra hora de SU día: para eso había que cambiar
                      la pantalla de fecha primero, y era el movimiento más
                      probable justo después de repartir.
                    */}
                    {diasEnJuego.map((d) => {
                      const delDia = rejillas[d] ?? [];
                      if (delDia.length === 0) return null;

                      return (
                        <optgroup
                          key={d}
                          label={fechaDe(delDia[0].inicio, zona)}
                        >
                          {delDia.map((f) => {
                            const otro = convocados.find(
                              (o) =>
                                o.person_id !== c.person_id &&
                                plan[o.person_id] === f.inicio,
                            );

                            return (
                              <option
                                key={f.inicio}
                                value={f.inicio}
                                /* Solo se apaga lo que NO es tuyo: otra cita de
                                   la agenda. Lo que tiene otro convocado se
                                   puede elegir —se intercambian— y la etiqueta
                                   dice con quién. */
                                disabled={f.ocupada}
                              >
                                {/*
                                  Con fecha si NO es el día que se está mirando.
                                  
                                  El grupo ya la lleva, pero el grupo solo se ve
                                  con el desplegable abierto: cerrado enseña la
                                  opción sola, y un «09:00» pelado en la fila de
                                  alguien que va el miércoles se lee como que va
                                  hoy.
                                */}
                                {d === dia
                                  ? horaDe(f.inicio, zona)
                                  : fechaYHora(f.inicio, zona)}
                                {f.ocupada
                                  ? " · ocupado"
                                  : otro
                                    ? ` · cambiar con ${otro.nombre}`
                                    : ""}
                              </option>
                            );
                          })}
                        </optgroup>
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

      {sinHora.length > 0 && rejillas !== null && (
        <div className="border-line bg-warning-50 flex flex-col items-start gap-2 rounded-lg border p-3">
          <p className="text-warning-700 text-sm font-medium">
            {sinHora.length}{" "}
            {sinHora.length === 1 ? "persona sin hora" : "personas sin hora"}
          </p>
          <p className="text-text-body text-sm">
            {sinHora.map(nombreDe).join(", ")}. No caben en lo que queda del
            día.
          </p>

          {/*
            La salida por defecto, en un botón.
            
            Aquí ponía «cámbiate de fecha para citarlas», que era mandar a
            recorrer el calendario a mano buscando huecos —y saltándose fines
            de semana y bloques ya tomados— para colocar a siete personas de
            una en una. Es exactamente la cuenta que la máquina hace mejor.
          */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={continuarEnLosDiasSiguientes}
            loading={estirando ? "Buscando huecos…" : undefined}
          >
            <CalendarPlus aria-hidden="true" className="size-4" />
            Continuar en los días siguientes
          </Button>
        </div>
      )}

      {/*
        TODO LO QUE SE PUEDE HACER, AL FINAL Y JUNTO.

        «Guardar el horario» vivía arriba, entre los controles del día, y
        confirmar y rechazar en un bloque aparte más abajo. Eran tres botones
        de la misma decisión repartidos por la pantalla, y el de arriba se
        pulsaba antes de haber mirado el reparto porque estaba al lado de los
        controles que se tocan primero.
      */}
      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-4">
        {pendiente && (
          <Button
            type="button"
            onClick={() => setDecidiendo("confirmar")}
            loading={confirmando ? "Confirmando…" : undefined}
          >
            Confirmar la sesión
          </Button>
        )}

        <Button
          type="button"
          variant={pendiente ? "secondary" : "primary"}
          onClick={guardar}
          loading={guardando ? "Guardando…" : undefined}
        >
          Guardar el horario
        </Button>

        {pendiente && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDecidiendo("rechazar")}
          >
            Rechazar
          </Button>
        )}

        {/* Solo cuando hay algo que decir: con la sesión pendiente, guardar es
            opcional —confirmar ya lo hace— y decirlo evita la duda de si hay
            que pulsar los dos. */}
        {pendiente && (
          <p className="text-text-muted w-full text-sm">
            Al confirmar se guarda este horario. Guardar aparte sirve para
            dejarlo a medias y seguir después.
          </p>
        )}
      </div>

      {falloAlDecidir && (
        <Alert tone="danger" title="No se pudo">
          {falloAlDecidir}
        </Alert>
      )}

      {/*
        EL ALTO ANTES DE DECIR QUE SÍ.

        Confirmar le manda un correo a la empresa y le abre el acceso a cada
        convocado; rechazar le dice que no a una solicitud. Ninguna de las dos
        se deshace, y estaban las dos a un clic suelto de distancia.

        El resumen no es decoración: es el número que hay que mirar antes de
        aceptar. «Dos personas se quedan sin hora» dentro de una lista de
        quince pasa desapercibido; delante de la pregunta, no.
      */}
      <Dialogo
        abierto={decidiendo === "confirmar"}
        titulo="¿Confirmar la sesión?"
        aceptar="Sí, confirmar"
        aceptando={confirmando ? "Confirmando…" : undefined}
        formulario={`confirmar-${citaId}`}
        onCerrar={() => setDecidiendo(null)}
      >
        <p>
          {citados.length === 0 ? (
            <>
              Nadie tiene hora todavía. La empresa recibirá la sesión como
              confirmada, pero sin horario para sus convocados.
            </>
          ) : (
            <>
              Quedan citadas <strong>{citados.length}</strong>{" "}
              {citados.length === 1 ? "persona" : "personas"}
              {jornadas.length > 1 ? (
                <>
                  {" "}
                  repartidas en <strong>{jornadas.length}</strong> jornadas
                  {": "}
                  {jornadas.map((j) => fechaDe(j.iso, zona)).join(", ")}
                </>
              ) : (
                <> el {fechaDe(jornadas[0].iso, zona)}</>
              )}
              .
            </>
          )}
        </p>

        {sinHora.length > 0 && (
          <p className="text-warning-700">
            {sinHora.length}{" "}
            {sinHora.length === 1
              ? "persona se queda sin hora"
              : "personas se quedan sin hora"}
            : {sinHora.map(nombreDe).join(", ")}. Puedes citarlas después.
          </p>
        )}

        <p className="text-text-muted">
          La empresa recibirá un aviso por correo y cada convocado su acceso.
        </p>

        <form id={`confirmar-${citaId}`} action={confirmar}>
          <input type="hidden" name="cita" value={citaId} />
          {/* El horario viaja con la confirmación: son una sola decisión. */}
          <input type="hidden" name="reparto" value={repartoSerializado} />
        </form>
      </Dialogo>

      <Dialogo
        abierto={decidiendo === "rechazar"}
        titulo="¿Rechazar la solicitud?"
        aceptar="Sí, rechazar"
        aceptando={rechazando ? "Rechazando…" : undefined}
        variante="destructive"
        formulario={`rechazar-${citaId}`}
        onCerrar={() => setDecidiendo(null)}
      >
        <p>
          La empresa recibirá un correo diciendo que no. El horario que hayas
          preparado aquí no se guarda.
        </p>

        <form
          id={`rechazar-${citaId}`}
          action={rechazar}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="cita" value={citaId} />
          {/* El motivo va en el correo: «no» a secas, sin explicación, es
              innecesariamente frío para una solicitud que costó preparar. */}
          <Field
            id={`motivo-${citaId}`}
            name="motivo"
            label="Motivo"
            optional
            help="Se incluirá en el correo a la empresa."
            error={estadoRechazar.errores?.motivo}
          />
        </form>
      </Dialogo>
    </div>
  );
}

/**
 * Recoloca a los del día visible desde una hora, SIN TOCAR los otros días.
 *
 * Los que ya estaban ese día conservan su orden —correr la tanda una hora no
 * debe barajar a nadie— y detrás van los que no tienen hora todavía. Quien no
 * quepa se queda sin ella, y eso se ve: hay más gente que bloques y es una
 * decisión que el profesional tiene que tomar, no algo que esconder.
 */
function reordenarElDia(
  plan: Record<string, string | null>,
  franjas: Franja[],
  convocados: Convocado[],
  desde: string,
  zona: string,
): Record<string, string | null> {
  const dia = claveDeDia(desde, zona);

  const enElDia = convocados
    .filter((c) => {
      const hora = plan[c.person_id];
      return Boolean(hora) && claveDeDia(hora!, zona) === dia;
    })
    .sort(
      (a, b) => Date.parse(plan[a.person_id]!) - Date.parse(plan[b.person_id]!),
    );

  const sinHora = convocados.filter((c) => !plan[c.person_id]);

  const disponibles = franjas.filter(
    (f) => !f.ocupada && Date.parse(f.inicio) >= Date.parse(desde),
  );

  const copia = { ...plan };
  [...enElDia, ...sinHora].forEach((c, i) => {
    copia[c.person_id] = disponibles[i]?.inicio ?? null;
  });

  return copia;
}

/**
 * El día de un instante, en la zona de la consulta, como «2026-08-24».
 *
 * En ese formato ordena solo y coincide con lo que espera un `<input
 * type="date">`, así que sirve de clave, de criterio de orden y de valor del
 * control sin conversiones intermedias. `en-CA` es el atajo estándar para
 * conseguir ISO de `toLocaleDateString`.
 */
function claveDeDia(iso: string, zona: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: zona });
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

/** «lun, 24 ago» */
function fechaDe(iso: string, zona: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
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
