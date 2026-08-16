"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import {
  SelectorDePersonas,
  type PersonaElegible,
} from "@/components/empresa/selector-de-personas";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { editarSolicitud, solicitarSesion } from "@/lib/empresa/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

const DURACIONES = [
  { valor: "60", etiqueta: "1 hora" },
  { valor: "120", etiqueta: "2 horas" },
  { valor: "180", etiqueta: "3 horas" },
  { valor: "240", etiqueta: "4 horas" },
];

/**
 * Solicitud de una sesión de evaluación.
 *
 * La lista de personas es de casillas y no de un desplegable múltiple: se
 * convoca a varias a la vez y hay que poder ver a quién se marcó sin abrir
 * nada. El contador está a la vista porque el número de convocados es lo que
 * determina cuánto dura la sesión.
 */
export interface SesionEditable {
  id: string;
  starts_at: string;
  ends_at: string;
  modality: string;
  location: string | null;
  patient_note: string | null;
}

export function FormularioSesion({
  personas,
  /** Preseleccionados al editar una solicitud existente. */
  inicial = [],
  fechaMinima,
  /** Con sesión, el formulario CORRIGE una solicitud en vez de crearla. */
  sesion,
}: {
  personas: PersonaElegible[];
  inicial?: string[];
  fechaMinima: string;
  sesion?: SesionEditable;
}) {
  const editando = sesion !== undefined;

  const [estado, accion, enviando] = useActionState(
    editando ? editarSolicitud : solicitarSesion,
    INICIAL,
  );

  /*
   * Los valores iniciales salen de la sesión, en la zona del navegador.
   *
   * La fecha llega en UTC desde la base; presentarla sin convertir mostraría
   * otro día a partir de las 19:00 en Bogotá, que es justo cuando alguien
   * revisa lo que pidió por la tarde.
   */
  const inicio = sesion ? new Date(sesion.starts_at) : null;

  const dosDigitos = (n: number) => String(n).padStart(2, "0");

  const diaInicial = inicio
    ? `${inicio.getFullYear()}-${dosDigitos(inicio.getMonth() + 1)}-${dosDigitos(inicio.getDate())}`
    : undefined;

  const horaInicial = inicio
    ? `${dosDigitos(inicio.getHours())}:${dosDigitos(inicio.getMinutes())}`
    : "09:00";

  const duracionInicial = sesion
    ? String(
        Math.round(
          (new Date(sesion.ends_at).getTime() - inicio!.getTime()) / 60000,
        ),
      )
    : "120";

  if (personas.length === 0) {
    return (
      <Alert tone="info" title="Primero carga a las personas">
        Una sesión convoca a personas de tu listado. Añade al menos a una y
        vuelve aquí.
      </Alert>
    );
  }

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      {sesion && <input type="hidden" name="cita" value={sesion.id} />}
      {/* El título lo pone el encabezado de la pantalla: repetirlo aquí
          hacía leer dos veces lo mismo antes de llegar a los campos. */}

      {estado.mensaje && (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Solicitud enviada" : "No se pudo solicitar"}
        >
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="fecha"
          name="fecha"

          defaultValue={diaInicial}
          type="date"
          label="Día"
          min={fechaMinima}
          error={estado.errores?.fecha}
        />
        <Field
          id="hora"
          name="hora"
          type="time"
          label="Hora de inicio"
          defaultValue={horaInicial}
          error={estado.errores?.hora}
        />
        <Select
          id="duracion"
          name="duracion"
          label="Duración"
          opciones={DURACIONES}
          defaultValue={duracionInicial}
          error={estado.errores?.duracion}
        />
      </div>

      <SelectorDePersonas
        personas={personas}
        inicial={inicial}
        error={estado.errores?.personas}
      />

      <Field
        id="nota"
        name="nota"

        defaultValue={sesion?.patient_note ?? ""}
        label="Para qué es la evaluación"
        placeholder="Por ejemplo: selección para dos cargos operativos."
        error={estado.errores?.nota}
      />

      <div>
        <Button type="submit" loading={enviando ? "Enviando…" : undefined}>
          Enviar solicitud
        </Button>
      </div>
    </form>
  );
}
