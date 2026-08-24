"use client";

import { Download, MailCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CierreDeLaPrueba } from "@/lib/evaluaciones/acciones-pase";

/**
 * La despedida de quien acaba de responder.
 *
 * NO ENSEÑA LOS RESULTADOS, y ese es el cambio. Antes esta pantalla dibujaba
 * el perfil entero porque era la única ocasión de leerlo; desde que el PDF
 * sale por correo a la persona además de a la empresa, dejó de serlo. Y un
 * perfil psicológico leído a solas, recién salido de media hora de prueba y
 * sin nadie que lo interprete, es exactamente la lectura que no conviene.
 *
 * Lo que sí tiene que dejar claro, en este orden, porque es el orden en que
 * se lo pregunta quien termina:
 *
 *   1. Se acabó y salió bien.
 *   2. Dónde están sus resultados —en su correo, no aquí—.
 *   3. Que puede llevárselos ahora si quiere.
 *   4. Quién le va a escribir y para qué.
 *   5. Que puede cerrar la pestaña sin romper nada.
 *
 * El punto 5 no es cortesía: sin él, alguien que acaba de responder y no ve
 * resultados se queda esperando a que aparezca algo.
 */
export function FinDeLaPrueba({ cierre }: { cierre: CierreDeLaPrueba | null }) {
  /*
   * El motor no llegó a publicar.
   *
   * Ocurre —el cierre automático está escrito para no lanzar nunca— y en ese
   * caso el enlace NO se apagó, a propósito: es lo único que le queda a esta
   * persona para volver. El texto se lo dice.
   */
  if (!cierre) {
    return (
      <div className="mx-auto flex w-full max-w-[60ch] flex-col gap-6">
        <Alert tone="success" title="Recibimos tus respuestas">
          Tu informe se está preparando. Te llegará por correo, y si quieres
          comprobarlo antes puedes volver a abrir el mismo enlace en un rato.
        </Alert>
      </div>
    );
  }

  const quienEscribe = cierre.empresa ?? "La empresa que encargó la evaluación";

  return (
    <div className="mx-auto flex w-full max-w-[60ch] flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="bg-accent-soft text-accent grid size-14 place-items-center rounded-full">
          <MailCheck aria-hidden="true" className="size-7" />
        </span>

        <div className="flex flex-col gap-2">
          <h2 className="text-h2">Terminaste tu evaluación</h2>
          {/*
            El nombre, porque cierra el círculo que abrió el consentimiento.
            Quien empezó leyendo «{nombre}, esto es lo que vas a responder»
            termina sabiendo que la plataforma siguió hablándole a él.
          */}
          <p className="text-text-body text-lg">
            Gracias por tu tiempo, {cierre.nombre}. Tus respuestas quedaron
            registradas y ya no hay nada más que hacer aquí.
          </p>
        </div>
      </div>

      <Alert tone="success" title="Tus resultados salieron por correo">
        {cierre.correo ? (
          <>
            Te enviamos tu informe en PDF a <strong>{cierre.correo}</strong>, la
            misma dirección por la que recibiste tu enlace. {quienEscribe}{" "}
            también recibió su copia, porque fue quien encargó la evaluación.
          </>
        ) : (
          <>
            Tu informe en PDF salió hacia {quienEscribe}, que fue quien encargó
            la evaluación. Si quieres tu propia copia, descárgala aquí antes de
            cerrar esta página.
          </>
        )}
      </Alert>

      {/*
        Descargar, no imprimir, y el archivo NO viene de una dirección.

        La versión anterior abría el diálogo del navegador sobre el informe
        dibujado en pantalla; sin informe en pantalla eso ya no existe. Y poner
        una dirección que devolviera el PDF sería reabrir justo la credencial
        al portador que el pase acaba de cerrar, así que el archivo llega
        dentro de la respuesta de la acción y se arma aquí mismo.

        Si la composición falló no hay botón, en vez de un botón que descarga
        un archivo roto: su copia ya va por correo y ese es el camino bueno.
      */}
      {cierre.pdf && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => descargar(cierre.pdf!, cierre.archivo)}
          >
            <Download aria-hidden="true" className="size-4" />
            Descargar mi informe en PDF
          </Button>
        </div>
      )}

      <div className="border-line bg-panel text-text-body flex flex-col gap-3 rounded-xl border p-6">
        <p>
          <strong className="text-text-strong">{quienEscribe}</strong> se pondrá
          en contacto contigo para continuar con los siguientes pasos.
        </p>
        <p className="text-text-muted text-sm">
          Ya puedes cerrar esta página cuando quieras: no queda nada pendiente
          de tu parte y no vas a perder nada.
        </p>
      </div>
    </div>
  );
}

/**
 * El PDF, de base64 a archivo guardado, sin pasar por el servidor.
 *
 * `atob` devuelve una cadena binaria —un carácter por byte— y hay que pasarla
 * a bytes a mano: dársela a `Blob` directamente la codificaría como UTF-8 y el
 * archivo saldría corrupto sin que nada avise, porque el PDF pesa más y abre
 * en nada.
 */
function descargar(base64: string, nombre: string) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);

  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();

  // Se libera, o el archivo entero se queda en memoria hasta cerrar la pestaña.
  URL.revokeObjectURL(url);
}
