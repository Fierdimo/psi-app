"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  establecerNuevaContrasena,
  ingresar,
  registrar,
  solicitarRecuperacion,
} from "@/lib/auth/acciones";
import {
  REQUISITOS_CONTRASENA,
  type EstadoFormulario,
} from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Requisitos de contraseña, visibles ANTES de escribir (SPEC.md §7.2).
 *
 * Enseñarlos solo cuando la contraseña ya falló obliga a la persona a
 * adivinar, fallar y corregir. Mostrarlos por adelantado cuesta lo mismo y
 * evita el ciclo entero.
 */
function RequisitosContrasena() {
  return (
    <ul className="text-text-muted text-micro flex flex-col gap-1">
      {REQUISITOS_CONTRASENA.map((requisito) => (
        <li key={requisito} className="flex items-center gap-1.5">
          <Check aria-hidden="true" className="size-3 shrink-0" />
          {requisito}
        </li>
      ))}
    </ul>
  );
}

function ErrorGeneral({ estado }: { estado: EstadoFormulario }) {
  if (!estado.mensaje || estado.ok) return null;
  return <Alert tone="danger" title={estado.mensaje} />;
}

export function FormularioIngreso({
  siguiente,
  variante = "paciente",
}: {
  siguiente?: string;
  variante?: "paciente" | "profesional";
}) {
  const [estado, accion, enviando] = useActionState(ingresar, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <ErrorGeneral estado={estado} />
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}

      <Field
        id="correo"
        name="correo"
        type="email"
        label="Correo electrónico"
        autoComplete="email"
        autoFocus
        required
        error={estado.errores?.correo}
      />

      <Field
        id="contrasena"
        name="contrasena"
        type="password"
        label="Contraseña"
        autoComplete="current-password"
        required
        error={estado.errores?.contrasena}
      />

      <Button type="submit" block loading={enviando ? "Entrando…" : undefined}>
        {variante === "profesional" ? "Entrar al área profesional" : "Entrar"}
      </Button>
    </form>
  );
}

export function FormularioRegistro({ siguiente }: { siguiente?: string }) {
  const [estado, accion, enviando] = useActionState(registrar, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      {/* Sobrevive al rodeo de la verificación de correo: se manda a Supabase
          dentro del enlace de vuelta, y el callback lo respeta. Sin esto, quien
          llega desde una invitación acaba en su panel y pierde el enlace. */}
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}

      <ErrorGeneral estado={estado} />

      {/*
        Dos bloques, y separados a la vista.

        Aquí se dan de alta DOS cosas a la vez —una organización y la persona
        que va a administrarla— y sin la separación el formulario se lee como
        una lista de siete campos donde «Nombre» aparece dos veces queriendo
        decir cosas distintas.
      */}
      <fieldset className="flex flex-col gap-5">
        <legend className="text-text-strong mb-1 text-sm font-semibold">
          Tu empresa
        </legend>

        <Field
          id="empresaNombre"
          name="empresaNombre"
          label="Nombre de la empresa"
          autoComplete="organization"
          autoFocus
          required
          error={estado.errores?.empresaNombre}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="empresaNit"
            name="empresaNit"
            label="NIT"
            optional
            help="Puedes añadirlo después."
            autoComplete="off"
            error={estado.errores?.empresaNit}
          />
          <Field
            id="empresaTelefono"
            name="empresaTelefono"
            label="Teléfono"
            optional
            type="tel"
            autoComplete="tel"
            error={estado.errores?.empresaTelefono}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-text-strong mb-1 text-sm font-semibold">
          Quien la administra
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="nombre"
            name="nombre"
            label="Nombre"
            autoComplete="given-name"
            required
            error={estado.errores?.nombre}
          />
          <Field
            id="apellidos"
            name="apellidos"
            label="Apellidos"
            autoComplete="family-name"
            required
            error={estado.errores?.apellidos}
          />
        </div>

        <Field
          id="correo"
          name="correo"
          type="email"
          label="Correo electrónico"
          help="Con esta dirección entrarás, y es por donde te escribiremos para resolver los pagos."
          autoComplete="email"
          required
          error={estado.errores?.correo}
        />

        <div className="flex flex-col gap-2">
          <Field
            id="contrasena"
            name="contrasena"
            type="password"
            label="Contraseña"
            autoComplete="new-password"
            required
            error={estado.errores?.contrasena}
          />
          <RequisitosContrasena />
        </div>
      </fieldset>

      <Button type="submit" block loading={enviando ? "Creando…" : undefined}>
        Crear cuenta de empresa
      </Button>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, accion, enviando] = useActionState(
    solicitarRecuperacion,
    INICIAL,
  );

  if (estado.ok && estado.mensaje) {
    return (
      <Alert tone="success" title="Revisa tu correo">
        {estado.mensaje}
      </Alert>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <ErrorGeneral estado={estado} />

      <Field
        id="correo"
        name="correo"
        type="email"
        label="Correo electrónico"
        autoComplete="email"
        autoFocus
        required
        error={estado.errores?.correo}
      />

      <Button type="submit" block loading={enviando ? "Enviando…" : undefined}>
        Enviar enlace
      </Button>
    </form>
  );
}

export function FormularioNuevaContrasena() {
  const [estado, accion, enviando] = useActionState(
    establecerNuevaContrasena,
    INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <ErrorGeneral estado={estado} />

      <div className="flex flex-col gap-2">
        <Field
          id="contrasena"
          name="contrasena"
          type="password"
          label="Nueva contraseña"
          autoComplete="new-password"
          autoFocus
          required
          error={estado.errores?.contrasena}
        />
        <RequisitosContrasena />
      </div>

      <Button type="submit" block loading={enviando ? "Guardando…" : undefined}>
        Guardar contraseña
      </Button>
    </form>
  );
}
