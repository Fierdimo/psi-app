"use client";

import { Check, Copy, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toString as qrComoSvg } from "qrcode";

import { Badge } from "@/components/ui/badge";
import type { EnlaceDeAcceso } from "@/lib/validacion/auth";

/**
 * Los accesos de una sesión, para entregarlos a mano.
 *
 * Existe porque el correo no siempre llega, y en un caso ni siquiera se
 * contrata: una dirección vieja, la carpeta de spam, o una consulta que decide
 * ahorrarse el servicio de envío. Sin esto, un correo que no llega es una
 * persona que no puede presentarse a su evaluación.
 *
 * Se enseñan UNA vez, y se dice por qué: el testigo solo existe en claro este
 * instante porque en la base queda su hash. No es una limitación que haya que
 * disculpar —es lo que impide que alguien con acceso a la base entre en nombre
 * de otra persona— pero sí hay que avisarla y ofrecer la salida: generarlos de
 * nuevo crea otros.
 */
export function EnlacesDeAcceso({
  enlaces,
  titulo = "Enlaces de acceso, por si hay que entregarlos a mano",
  nota,
}: {
  enlaces: readonly EnlaceDeAcceso[];
  titulo?: string;
  nota?: string;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  async function copiar(clave: string, texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado((a) => (a === clave ? null : a)), 2000);
  }

  /*
   * La lista entera de una vez.
   *
   * Con cincuenta convocados, copiar uno por uno son cincuenta clics y una
   * equivocación garantizada —el enlace de alguien pegado en el mensaje de
   * otro, que es lo peor que puede pasar aquí—. Se copia como texto con el
   * nombre delante para que quien reparta sepa cuál es cuál.
   */
  const listaEntera = enlaces
    .map((e) => `${e.nombre}${e.correo ? ` (${e.correo})` : ""}\n${e.enlace}`)
    .join("\n\n");

  return (
    <div className="border-line bg-panel flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-text-strong font-medium">{titulo}</h3>
          <p className="text-text-muted text-sm">
            {nota ??
              "Solo se pueden ver ahora: en la base queda cifrado. Si alguien no recibe su correo, pásale el suyo por donde sueles hablarle. Si los pierdes, vuelve a generarlos."}
          </p>
        </div>

        {enlaces.length > 1 && (
          <button
            type="button"
            onClick={() => copiar("todos", listaEntera)}
            className="border-line-interactive text-accent-on-soft hover:bg-accent-soft ease-psi inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          >
            {copiado === "todos" ? (
              <>
                <Check aria-hidden="true" className="size-3.5" />
                Copiada
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="size-3.5" />
                Copiar la lista
              </>
            )}
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {enlaces.map((e) => (
          <li
            key={e.enlace + e.correo}
            className="border-line bg-bg flex flex-wrap items-center gap-3 rounded-md border p-3"
          >
            {/*
              En un teléfono el nombre se lleva su propio renglón.
              
              Compartiéndolo con los dos botones quedaba «Julián Ospina»
              partido en dos líneas y el correo cortado en «julian…», que es
              justo el dato que sirve para no darle a alguien el pase de otro.
            */}
            <span className="min-w-full flex-1 sm:min-w-0">
              <span className="text-text-strong flex flex-wrap items-center gap-2 text-sm font-medium">
                {e.nombre}
                {/*
                  Quien ya tiene cuenta se marca, y no es un adorno: sin esto,
                  quien reparte ve dos enlaces distintos sin saber por qué, y
                  el que lleva a la entrada parece un pase roto.
                */}
                {e.yaTieneCuenta && (
                  <Badge tone="neutral">Ya tiene cuenta</Badge>
                )}
              </span>
              <span className="text-text-muted block truncate text-xs">
                {e.correo}
              </span>
            </span>

            {/*
              El QR es para la entrega en persona: se enseña en pantalla y la
              persona lo escanea con su teléfono. Es la forma de que el acceso
              llegue A SU DUEÑO sin pasar por las manos de nadie más, que es
              justo lo que el consentimiento necesita.
            */}
            <button
              type="button"
              onClick={() =>
                setAbierto((a) => (a === e.enlace ? null : e.enlace))
              }
              aria-expanded={abierto === e.enlace}
              className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            >
              <QrCode aria-hidden="true" className="size-3.5" />
              {abierto === e.enlace ? "Ocultar" : "Ver QR"}
            </button>

            <button
              type="button"
              onClick={() => copiar(e.enlace, e.enlace)}
              className="border-line-interactive text-accent-on-soft hover:bg-accent-soft ease-psi inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            >
              {copiado === e.enlace ? (
                <>
                  <Check aria-hidden="true" className="size-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="size-3.5" />
                  Copiar enlace
                </>
              )}
            </button>

            {abierto === e.enlace && (
              <div className="w-full pt-1">
                <Qr valor={e.enlace} yaTieneCuenta={e.yaTieneCuenta} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * El código, dibujado en el navegador.
 *
 * Se genera aquí y no en el servidor a propósito: el enlace lleva el testigo,
 * y mandarlo a dibujar fuera lo pasearía por otro sitio más. Ya está en esta
 * pantalla; no hace falta que salga de ella.
 */
function Qr({
  valor,
  yaTieneCuenta,
}: {
  valor: string;
  yaTieneCuenta?: boolean;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    qrComoSvg(valor, {
      type: "svg",
      margin: 1,
      // Corrección media: el código se lee de una pantalla, a veces con
      // reflejos y desde un ángulo. El tamaño extra no importa aquí.
      errorCorrectionLevel: "M",
    })
      .then((s) => {
        if (vigente) setSvg(s);
      })
      .catch(() => {
        if (vigente) setSvg(null);
      });

    return () => {
      vigente = false;
    };
  }, [valor]);

  if (!svg) {
    return <p className="text-text-muted text-sm">Preparando el código…</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/*
        Fondo blanco siempre, también en modo oscuro: un QR con los colores
        invertidos no lo lee la mitad de los teléfonos, y el que falla lo hace
        delante de la persona a la que se lo estás enseñando.
      */}
      <div
        aria-label="Código QR con el enlace de acceso"
        role="img"
        className="rounded-lg bg-white p-3 [&>svg]:size-44"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-text-muted max-w-[34ch] text-center text-xs">
        {yaTieneCuenta
          ? "Lleva a la entrada. Que use el correo y la contraseña que ya tiene."
          : "Que lo escanee la persona con su teléfono, delante de ti."}
      </p>
    </div>
  );
}
