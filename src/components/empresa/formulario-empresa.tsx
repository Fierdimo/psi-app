"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { actualizarEmpresa } from "@/lib/empresa/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

export interface DatosEmpresa {
  nombre: string;
  nit: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
}

/**
 * La ficha de la empresa, editable.
 *
 * Se rellenaba al registrarse y no se volvía a tocar. El contacto es lo que
 * más se queda viejo —cambia quien lleva el tema, cambia el correo— y es justo
 * por donde el profesional resuelve el trámite antes de confirmar una sesión.
 */
export function FormularioEmpresa({ empresa }: { empresa: DatosEmpresa }) {
  const [estado, accion, enviando] = useActionState(actualizarEmpresa, INICIAL);

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Listo" : "No se pudo guardar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="nombre"
          name="nombre"
          label="Nombre de la empresa"
          defaultValue={empresa.nombre}
          autoComplete="organization"
        />
        <Field
          id="nit"
          name="nit"
          label="NIT"
          defaultValue={empresa.nit ?? ""}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-h4">Contacto</h2>
        <p className="text-text-muted text-sm">
          Por aquí te escribe el profesional para resolver el trámite antes de
          confirmar una sesión. Basta con un correo o un teléfono.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="contacto_nombre"
          name="contacto_nombre"
          label="Persona de contacto"
          defaultValue={empresa.contacto_nombre ?? ""}
          autoComplete="name"
        />
        <Field
          id="contacto_email"
          name="contacto_email"
          type="email"
          label="Correo"
          defaultValue={empresa.contacto_email ?? ""}
          autoComplete="email"
        />
        <Field
          id="contacto_telefono"
          name="contacto_telefono"
          type="tel"
          label="Teléfono"
          defaultValue={empresa.contacto_telefono ?? ""}
          autoComplete="tel"
        />
      </div>

      <div>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
