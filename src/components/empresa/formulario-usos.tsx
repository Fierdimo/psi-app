"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { solicitarUsos } from "@/lib/usos/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Pedir más usos.
 *
 * Dos campos y ninguna promesa de inmediatez: el pago ocurre fuera de la
 * plataforma y la solicitud se queda esperando a que el profesional lo
 * confirme. Decirlo aquí, y no solo en el mensaje de éxito, evita la vuelta de
 * «ya pagué, ¿por qué no tengo saldo?».
 */
export function FormularioUsos({ pendiente }: { pendiente: boolean }) {
  const [estado, accion, enviando] = useActionState(solicitarUsos, INICIAL);

  /*
   * El aviso de «hay una pendiente» ES TAMBIÉN el acuse de recibo.
   *
   * Al enviar, la acción revalida y esta pantalla vuelve con `pendiente` en
   * cierto, así que el formulario —y con él su mensaje de éxito— desaparece
   * antes de que nadie lo lea. Se descubrió en la prueba de extremo a extremo:
   * el envío funcionaba y la confirmación no se veía nunca.
   *
   * La salida no es guardar el mensaje en algún sitio, es que este texto sirva
   * para los dos momentos: el de acabar de enviarla y el de volver mañana a
   * mirar. Por eso dice qué pasó, dónde verlo y qué esperar, en vez de
   * limitarse a negar la segunda solicitud.
   */
  if (pendiente) {
    return (
      <Alert tone="info" title="Tu solicitud está esperando respuesta">
        La tienes abajo con su estado. En cuanto confirmemos el pago, el saldo
        aparecerá arriba y podrás encargar evaluaciones. Mientras se resuelve no
        se puede pedir otra: si te equivocaste en la cantidad, escríbenos por el
        canal de siempre.
      </Alert>
    );
  }

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-h4">Solicitar más usos</h2>
        <p className="text-text-muted text-sm">
          Un uso es una evaluación. El pago se resuelve fuera de la plataforma:
          al recibir tu solicitud te contactamos, y el saldo sube cuando quede
          confirmado.
        </p>
      </div>

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Solicitud enviada" : "No se pudo enviar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <Field
          id="cantidad"
          name="cantidad"
          type="number"
          min={1}
          max={1000}
          defaultValue=""
          label="Cuántos usos"
          inputMode="numeric"
          error={estado.errores?.cantidad}
        />
        <Field
          id="nota"
          name="nota"
          label="Referencia"
          optional
          defaultValue=""
          help="Lo que te sirva para reconocerla después: una cotización, una sede, un proceso."
          error={estado.errores?.nota}
        />
      </div>

      <div>
        <Button type="submit" loading={enviando ? "Enviando…" : undefined}>
          Solicitar usos
        </Button>
      </div>
    </form>
  );
}
