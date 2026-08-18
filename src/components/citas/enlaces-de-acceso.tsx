"use client";

import { Check, Copy, Download, ImageDown, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { toDataURL as qrComoPng, toString as qrComoSvg } from "qrcode";

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
 * El enlace de cada persona es el MISMO que le llega por correo: uno solo por
 * invitación, que vive hasta que se acepta. Antes se fabricaba uno nuevo en
 * cada consulta y quien comparaba los dos creía que uno estaba roto.
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
    .filter((e) => !e.sinPase)
    .map((e) => `${e.nombre}${e.correo ? ` (${e.correo})` : ""}\n${e.enlace}`)
    .join("\n\n");

  return (
    <div className="border-line bg-panel flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-text-strong font-medium">{titulo}</h3>
          <p className="text-text-muted text-sm">
            {nota ??
              "Están listos desde que se confirmó la sesión. Si alguien no recibe su correo, pásale el suyo por donde sueles hablarle."}
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

            {e.sinPase ? (
              <span className="text-text-muted shrink-0 text-sm">
                Sin pase todavía · pídeselo al profesional
              </span>
            ) : (
              <>
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
                    <Qr
                      valor={e.enlace}
                      nombre={e.nombre}
                      yaTieneCuenta={e.yaTieneCuenta}
                    />
                  </div>
                )}
              </>
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
  nombre,
  yaTieneCuenta,
}: {
  valor: string;
  nombre: string;
  yaTieneCuenta?: boolean;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  /*
   * El aviso recuerda EN QUÉ BOTÓN se pulsó.
   *
   * Con un solo estado compartido, descargar dejaba «Descargada» escrito en el
   * botón de copiar, que es el que no se había tocado.
   */
  const [aviso, setAviso] = useState<{
    boton: "copiar" | "descargar";
    texto: string;
  } | null>(null);

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

  function avisar(boton: "copiar" | "descargar", texto: string) {
    setAviso({ boton, texto });
    setTimeout(() => setAviso(null), 2500);
  }

  /**
   * Copiar la imagen al portapapeles para pegarla donde sea.
   *
   * Es lo que pide el caso real: la empresa reparte por WhatsApp o por correo
   * desde su propia cuenta, y ahí se pega una imagen, no se adjunta un archivo
   * que antes hay que buscar en Descargas.
   *
   * Dos intentos y una salida, porque los navegadores no se ponen de acuerdo:
   * Safari exige que el ClipboardItem se construya DENTRO del gesto del
   * usuario, así que se le pasa la promesa sin esperarla; otros no aceptan
   * promesas y quieren el blob ya hecho. Si ninguno funciona —o el sitio no va
   * por HTTPS, que también lo impide— se descarga, que nunca falla.
   */
  async function copiarImagen() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": comoImagen(valor, nombre) }),
      ]);
      avisar("copiar", "Copiada");
      return;
    } catch {
      /* Se intenta la otra forma antes de rendirse. */
    }

    try {
      const imagen = await comoImagen(valor, nombre);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": imagen }),
      ]);
      avisar("copiar", "Copiada");
      return;
    } catch {
      /* Ni una ni otra: queda el archivo. */
    }

    /*
     * Se dice que acabó en archivo, no «Copiada».
     *
     * Quien lee «Copiada» se va a pegar y no pega nada; quien lee
     * «Descargada» sabe que tiene que buscarla en Descargas.
     */
    await descargarImagen("copiar");
  }

  async function descargarImagen(desde: "copiar" | "descargar" = "descargar") {
    const imagen = await comoImagen(valor, nombre);
    const url = URL.createObjectURL(imagen);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pase-${nombre.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
    avisar(desde, "Descargada");
  }

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
        aria-label={`Código QR con el enlace de acceso de ${nombre}`}
        role="img"
        className="rounded-lg bg-white p-3 [&>svg]:size-44"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={copiarImagen}
          className="border-line-interactive text-accent-on-soft hover:bg-accent-soft ease-psi inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
        >
          {aviso?.boton === "copiar" ? (
            <>
              <Check aria-hidden="true" className="size-3.5" />
              {aviso.texto}
            </>
          ) : (
            <>
              <ImageDown aria-hidden="true" className="size-3.5" />
              Copiar imagen
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => descargarImagen()}
          className="border-line-interactive text-text-body hover:bg-accent-soft ease-psi inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
        >
          {aviso?.boton === "descargar" ? (
            <>
              <Check aria-hidden="true" className="size-3.5" />
              {aviso.texto}
            </>
          ) : (
            <>
              <Download aria-hidden="true" className="size-3.5" />
              Descargar
            </>
          )}
        </button>
      </div>

      <p className="text-text-muted max-w-[34ch] text-center text-xs">
        {yaTieneCuenta
          ? "Lleva a la entrada. Que use el correo y la contraseña que ya tiene."
          : "Que lo escanee la persona con su teléfono, delante de ti."}
      </p>
    </div>
  );
}

/**
 * El código como PNG, CON EL NOMBRE ESCRITO DEBAJO.
 *
 * El nombre no es decoración. Estas imágenes se reparten de una en una por
 * WhatsApp o por correo, y un QR suelto es indistinguible de otro: pegar el de
 * Marta en el mensaje de Julián es darle a Julián la llave de la cuenta de
 * Marta, que es el peor error posible aquí y no da ninguna señal de haber
 * ocurrido. Escrito en la propia imagen, quien reparte lo ve antes de enviar y
 * quien lo recibe puede comprobar que es el suyo.
 */
async function comoImagen(valor: string, nombre: string): Promise<Blob> {
  const LADO = 512;
  const PIE = 96;

  // El PNG lo dibuja la propia librería; rasterizar el SVG a mano falla en los
  // navegadores que exigen ancho y alto explícitos en la etiqueta.
  const png = await qrComoPng(valor, {
    width: LADO,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  const codigo = new Image();
  codigo.src = png;
  await codigo.decode();

  const lienzo = document.createElement("canvas");
  lienzo.width = LADO;
  lienzo.height = LADO + PIE;

  const pincel = lienzo.getContext("2d")!;
  /*
   * Negro sobre blanco, y a propósito fuera del tema.
   *
   * Esta imagen sale de la plataforma: se pega en WhatsApp, se imprime, se
   * mira en el teléfono de otra persona. Un QR con los colores de la marca —o
   * peor, invertido porque quien lo generó tenía el modo oscuro puesto— no lo
   * lee la mitad de los lectores. El contraste máximo es un requisito del
   * formato, no una decisión de diseño.
   */
  // color-guard-ignore
  pincel.fillStyle = "#ffffff";
  pincel.fillRect(0, 0, lienzo.width, lienzo.height);
  pincel.drawImage(codigo, 0, 0, LADO, LADO);

  const TIPO = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const ANCHO = LADO - 48;

  // color-guard-ignore · Mismo motivo: el nombre viaja dentro del PNG.
  pincel.fillStyle = "#111827";
  pincel.textAlign = "center";
  pincel.textBaseline = "middle";

  /*
   * El nombre se ENCOGE antes que recortarse.
   *
   * «María Fernanda Restrepo Villalobos» salía como «María Fernanda Restrepo
   * Villa…», y un apellido a medias es justo lo que no sirve cuando hay dos
   * hermanas en la misma tanda. Solo si ni al tamaño mínimo cabe se recorta,
   * que es un nombre absurdamente largo y ahí ya no hay nada que hacer.
   */
  let cuerpo = 34;
  pincel.font = `600 ${cuerpo}px ${TIPO}`;
  while (pincel.measureText(nombre).width > ANCHO && cuerpo > 20) {
    cuerpo -= 2;
    pincel.font = `600 ${cuerpo}px ${TIPO}`;
  }

  let texto = nombre;
  while (pincel.measureText(texto).width > ANCHO && texto.length > 4) {
    texto = texto.slice(0, -1);
  }
  if (texto !== nombre) texto = `${texto.trimEnd()}…`;

  pincel.fillText(texto, LADO / 2, LADO + PIE / 2 - 8);

  return new Promise((listo, falla) =>
    lienzo.toBlob(
      (b) => (b ? listo(b) : falla(new Error("no se pudo crear la imagen"))),
      "image/png",
    ),
  );
}
