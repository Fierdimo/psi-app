"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cargarPersona } from "@/lib/empresa/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Alta de una persona en el listado de la empresa.
 *
 * El documento va primero y no es un capricho de orden: es la identidad. El
 * correo puede cambiar entre empresas y entre épocas —el corporativo aquí, el
 * personal allá— y por eso no sirve para reconocer a alguien. Cargar dos veces
 * la misma cédula corrige sus datos en lugar de duplicarla.
 */
export function FormularioPersona() {
  const [estado, accion, enviando] = useActionState(cargarPersona, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  // Tras un alta correcta se vacía, porque lo normal es cargar a varias
  // seguidas y tener que borrar los campos a mano cansa a la tercera.
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado.ok]);

  return (
    <form
      ref={formulario}
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-h4">Cargar una persona</h2>
        <p className="text-text-muted text-sm">
          Podrás convocarla a una sesión aunque todavía no tenga cuenta: la crea
          cuando reciba su invitación.
        </p>
      </div>

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Listo" : "No se pudo cargar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="documento"
          name="documento"
          label="Documento de identidad"
          autoComplete="off"
          error={estado.errores?.documento}
        />
        <Field
          id="email"
          name="email"
          type="email"
          label="Correo"
          autoComplete="off"
          error={estado.errores?.email}
        />
        <Field
          id="nombre"
          name="nombre"
          label="Nombre"
          autoComplete="off"
          error={estado.errores?.nombre}
        />
        <Field
          id="apellidos"
          name="apellidos"
          label="Apellidos"
          autoComplete="off"
          error={estado.errores?.apellidos}
        />
        <Field
          id="cargo"
          name="cargo"
          label="Cargo"
          autoComplete="off"
          error={estado.errores?.cargo}
        />
      </div>

      <div>
        <Button type="submit" loading={enviando ? "Cargando…" : undefined}>
          Añadir al listado
        </Button>
      </div>
    </form>
  );
}
