"use client";

import { MailCheck } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { RESPONSABLE } from "@/lib/legal/responsable";
import type { CierreDeLaPrueba } from "@/lib/evaluaciones/acciones-pase";

/**
 * La despedida de quien acaba de responder.
 *
 * NO ENSEÑA LOS RESULTADOS, y ese es el cambio. Antes esta pantalla dibujaba
 * el perfil entero porque era la única ocasión de leerlo. Un perfil psicológico
 * leído a solas, recién salido de media hora de prueba y sin nadie que lo
 * interprete, es exactamente la lectura que no conviene.
 *
 * Y TAMPOCO LOS ENTREGA POR NINGÚN OTRO CAMINO. Esta pantalla llegó a tener un
 * botón para descargar el PDF, y el correo lo llevaba adjunto; ninguna de las
 * dos cosas sigue en pie. Los resultados los recibe únicamente la empresa que
 * encargó la evaluación.
 *
 * Lo que sí tiene que dejar claro, en este orden, porque es el orden en que
 * se lo pregunta quien termina:
 *
 *   1. Se acabó y salió bien.
 *   2. Quién recibió los resultados y con quién sigue el proceso.
 *   3. A dónde escribir si quiere sus datos.
 *   4. Que puede cerrar la pestaña sin romper nada.
 *
 * El punto 3 es el que evita que esto se lea como una puerta cerrada: no se le
 * envían de oficio, pero puede pedirlos. El 4 no es cortesía: sin él, alguien
 * que acaba de responder y no ve resultados se queda esperando a que aparezca
 * algo.
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
          Tu evaluación se está procesando y sus resultados van a la empresa que
          la encargó. Si quieres comprobar que quedó completa, puedes volver a
          abrir el mismo enlace en un rato.
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

      <Alert tone="success" title="Tu evaluación está completa">
        {quienEscribe} recibió los resultados, porque fue quien encargó la
        evaluación.{" "}
        {cierre.correo ? (
          <>
            A <strong>{cierre.correo}</strong> te enviamos la confirmación de
            que terminaste; los resultados no viajan por ese correo.
          </>
        ) : null}
      </Alert>

      <div className="border-line bg-panel text-text-body flex flex-col gap-3 rounded-xl border p-6">
        <p>
          <strong className="text-text-strong">{quienEscribe}</strong> continúa
          el proceso contigo. Para conocer los siguientes pasos o los plazos,
          dirígete a ellos por el canal en el que te venían atendiendo.
        </p>
        <p className="text-text-muted text-sm">
          Si quieres consultar tus datos o pedir una copia de tu informe,
          escribe a{" "}
          <a className="underline" href={`mailto:${RESPONSABLE.correo}`}>
            {RESPONSABLE.correo}
          </a>
          . Ya puedes cerrar esta página cuando quieras: no queda nada pendiente
          de tu parte.
        </p>
      </div>
    </div>
  );
}
