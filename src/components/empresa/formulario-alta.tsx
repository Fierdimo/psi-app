"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { completarAltaDeEmpresa } from "@/lib/empresa/acciones-alta";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

export function FormularioAltaDeEmpresa() {
  const [estado, accion, enviando] = useActionState(
    completarAltaDeEmpresa,
    INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      {estado.mensaje && (
        <Alert tone="danger" title="No se pudo completar">
          {estado.mensaje}
        </Alert>
      )}

      <Field
        id="nombre"
        name="nombre"
        label="Nombre de la empresa"
        autoComplete="organization"
        autoFocus
        required
        error={estado.errores?.nombre}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="nit"
          name="nit"
          label="NIT"
          optional
          help="Puedes añadirlo después."
          autoComplete="off"
          error={estado.errores?.nit}
        />
        <Field
          id="telefono"
          name="telefono"
          label="Teléfono"
          optional
          type="tel"
          autoComplete="tel"
          error={estado.errores?.telefono}
        />
      </div>

      <Button type="submit" block loading={enviando ? "Guardando…" : undefined}>
        Continuar
      </Button>
    </form>
  );
}
