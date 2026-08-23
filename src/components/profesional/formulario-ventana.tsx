"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { actualizarVentana } from "@/lib/evaluaciones/acciones-configuracion";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

export type InstrumentoConfigurable = {
  clave: string;
  nombre: string;
  descripcion: string | null;
  ventana_minutos: number | null;
};

/**
 * Cuánto tiempo hay para terminar, por instrumento.
 *
 * Un formulario por prueba y no uno con todas dentro: guardar una no debería
 * arrastrar los cambios a medio escribir de otra, y con un solo instrumento en
 * el catálogo un formulario general sería exactamente esto con más código.
 */
export function FormularioVentana({
  instrumento,
}: {
  instrumento: InstrumentoConfigurable;
}) {
  const [estado, accion, enviando] = useActionState(actualizarVentana, INICIAL);

  const actual = instrumento.ventana_minutos;

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      <input type="hidden" name="clave" value={instrumento.clave} />

      <div className="flex flex-col gap-1">
        <h2 className="text-h4">{instrumento.nombre}</h2>
        {instrumento.descripcion && (
          <p className="text-text-muted max-w-[60ch] text-sm">
            {instrumento.descripcion}
          </p>
        )}
      </div>

      {/*
        El valor vigente, dicho en prosa antes del campo.

        Un campo vacío es ambiguo —¿no hay límite, o nadie lo ha configurado?—
        y esta es justo la clase de ajuste que alguien viene a comprobar sin
        intención de cambiarlo.
      */}
      <p className="text-text-body">
        {actual === null ? (
          <>
            Ahora mismo <strong className="text-text-strong">sin límite</strong>
            : quien empieza puede volver y terminar cuando quiera, hasta que
            venza su enlace.
          </>
        ) : (
          <>
            Ahora mismo{" "}
            <strong className="text-text-strong">{actual} minutos</strong> desde
            que se empieza.
          </>
        )}
      </p>

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Guardado" : "No se pudo guardar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="max-w-[320px]">
        <Field
          id={`minutos-${instrumento.clave}`}
          name="minutos"
          type="number"
          min={5}
          max={1440}
          inputMode="numeric"
          defaultValue={actual ?? ""}
          label="Minutos para terminar"
          optional
          help="Se cuentan desde que la persona empieza la prueba, no desde que recibe el correo. Déjalo vacío para no poner límite."
          error={estado.errores?.minutos}
        />
      </div>

      <div>
        <Button type="submit" loading={enviando ? "Guardando…" : undefined}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
