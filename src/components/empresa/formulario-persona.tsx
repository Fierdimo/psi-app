"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { cargarPersona, editarPersona } from "@/lib/empresa/acciones";
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
export interface PersonaEditable {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  documento: string;
  cargo: string | null;
  vinculo: string;
}

export function FormularioPersona({
  /** Con persona, el formulario EDITA. Sin ella, da de alta. */
  persona,
}: {
  persona?: PersonaEditable;
}) {
  const editando = persona !== undefined;

  const [estado, accion, enviando] = useActionState(
    editando ? editarPersona : cargarPersona,
    INICIAL,
  );

  /*
   * El vínculo cambia la etiqueta del cargo, y no es un detalle: «cargo» y
   * «cargo al que aspira» son cosas distintas, y el informe del profesional
   * las titula distinto. Se preselecciona aspirante porque es el caso más
   * frecuente.
   */
  const [vinculo, setVinculo] = useState(persona?.vinculo ?? "aspirante");

  /*
   * Se ajusta DURANTE el render y no en un efecto.
   *
   * Lo normal es cargar a varias personas seguidas, así que tras un alta
   * correcta el selector vuelve a su valor por defecto. Los demás campos los
   * vacía React solo al enviar un formulario con acción de servidor; este no,
   * porque su valor lo controlamos nosotros para poder cambiar la etiqueta del
   * cargo.
   *
   * Sincronizarlo con `useEffect` provoca un render en cascada —y el lint lo
   * rechaza, con razón: el valor se puede derivar comparando con el anterior.
   */
  const [okPrevio, setOkPrevio] = useState(estado.ok);
  if (estado.ok !== okPrevio) {
    setOkPrevio(estado.ok);
    if (estado.ok && !editando) setVinculo("aspirante");
  }

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      {persona && <input type="hidden" name="persona" value={persona.id} />}
      {/* El título lo pone el encabezado de la pantalla. Aquí solo queda la
          advertencia sobre el documento, que sí es del formulario. */}
      <p className="text-text-muted text-sm">
        {editando
          ? "El documento no se cambia una vez la persona activó su cuenta: es lo que la identifica y lo que enlaza su historial."
          : "Podrás convocarla aunque todavía no tenga cuenta: la crea cuando reciba su invitación."}
      </p>

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
          defaultValue={persona?.documento ?? ""}
          name="documento"
          label="Documento de identidad"
          autoComplete="off"
          error={estado.errores?.documento}
        />
        <Field
          id="email"
          defaultValue={persona?.email ?? ""}
          name="email"
          type="email"
          label="Correo"
          autoComplete="off"
          error={estado.errores?.email}
        />
        <Field
          id="nombre"
          defaultValue={persona?.nombre ?? ""}
          name="nombre"
          label="Nombre"
          autoComplete="off"
          error={estado.errores?.nombre}
        />
        <Field
          id="apellidos"
          defaultValue={persona?.apellidos ?? ""}
          name="apellidos"
          label="Apellidos"
          autoComplete="off"
          error={estado.errores?.apellidos}
        />
        <Select
          id="vinculo"
          name="vinculo"
          label="Vínculo con la empresa"
          opciones={[
            { valor: "aspirante", etiqueta: "Aspirante a un puesto" },
            { valor: "empleado", etiqueta: "Ya trabaja aquí" },
          ]}
          value={vinculo}
          onChange={(e) => setVinculo(e.target.value)}
          error={estado.errores?.vinculo}
        />
        <Field
          id="cargo"
          defaultValue={persona?.cargo ?? ""}
          name="cargo"
          label={vinculo === "empleado" ? "Cargo" : "Cargo al que aspira"}
          autoComplete="off"
          error={estado.errores?.cargo}
        />
      </div>

      <div>
        <Button
          type="submit"
          loading={
            enviando ? (editando ? "Guardando…" : "Cargando…") : undefined
          }
        >
          {editando ? "Guardar cambios" : "Añadir al listado"}
        </Button>
      </div>
    </form>
  );
}
