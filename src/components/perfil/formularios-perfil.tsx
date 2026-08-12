"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  cambiarContrasena,
  cambiarCorreo,
  guardarDatosPersonales,
  guardarPreferencias,
  solicitarEliminacion,
} from "@/lib/auth/acciones-perfil";
import { ZONAS_HORARIAS, zonaDelDispositivo } from "@/lib/fechas/zonas";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/** Suscripción vacía: la zona horaria del dispositivo no cambia sola. */
const SIN_SUSCRIPCION = () => () => {};

function Resultado({ estado }: { estado: EstadoFormulario }) {
  if (!estado.mensaje) return null;
  return (
    <Alert
      tone={estado.ok ? "success" : "danger"}
      title={estado.ok ? "Listo" : "No se pudo guardar"}
    >
      {estado.mensaje}
    </Alert>
  );
}

/* ========================================================================== */

export function FormularioDatosPersonales({
  perfil,
}: {
  perfil: {
    nombre: string | null;
    apellidos: string | null;
    telefono: string | null;
    fecha_nacimiento: string | null;
    documento: string | null;
  };
}) {
  const [estado, accion, enviando] = useActionState(
    guardarDatosPersonales,
    INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <Resultado estado={estado} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="nombre"
          name="nombre"
          label="Nombre"
          defaultValue={perfil.nombre ?? ""}
          autoComplete="given-name"
          error={estado.errores?.nombre}
        />
        <Field
          id="apellidos"
          name="apellidos"
          label="Apellidos"
          defaultValue={perfil.apellidos ?? ""}
          autoComplete="family-name"
          error={estado.errores?.apellidos}
        />
        <Field
          id="telefono"
          name="telefono"
          type="tel"
          label="Teléfono"
          optional
          defaultValue={perfil.telefono ?? ""}
          autoComplete="tel"
          error={estado.errores?.telefono}
        />
        <Field
          id="fecha_nacimiento"
          name="fecha_nacimiento"
          type="date"
          label="Fecha de nacimiento"
          optional
          defaultValue={perfil.fecha_nacimiento ?? ""}
          error={estado.errores?.fecha_nacimiento}
        />
      </div>

      <Field
        id="documento"
        name="documento"
        label="Documento de identidad"
        optional
        defaultValue={perfil.documento ?? ""}
        help="Tu profesional puede necesitarlo para emitir comprobantes."
        error={estado.errores?.documento}
      />

      <div>
        <Button type="submit" loading={enviando ? "Guardando…" : undefined}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

/* ========================================================================== */

export function FormularioPreferencias({
  timezone,
  recordatorios,
}: {
  timezone: string;
  recordatorios: boolean;
}) {
  const [estado, accion, enviando] = useActionState(
    guardarPreferencias,
    INICIAL,
  );

  const [zonaElegida, setZonaElegida] = useState(timezone);

  /*
   * La zona del dispositivo solo existe en el navegador. `useSyncExternalStore`
   * permite devolver `null` en el servidor y el valor real en el cliente sin
   * discrepancia de hidratación, que es justo lo que un `useEffect` con
   * `setState` hace peor: renderiza una vez de más y React lo señala.
   *
   * No hay suscripción porque el valor no cambia mientras la página vive.
   */
  const zonaDispositivo = useSyncExternalStore(
    SIN_SUSCRIPCION,
    zonaDelDispositivo,
    () => null,
  );

  const desfase = zonaDispositivo !== null && zonaDispositivo !== zonaElegida;

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <Resultado estado={estado} />

      {desfase && (
        <Alert tone="info" title="Tu dispositivo está en otra zona horaria">
          Este dispositivo dice estar en {zonaDispositivo}. Las horas de tus
          citas se muestran siempre en la zona que elijas aquí, así que conviene
          que sea la del lugar donde tienes las sesiones.
        </Alert>
      )}

      <Select
        id="timezone"
        name="timezone"
        label="Zona horaria"
        defaultValue={timezone}
        onChange={(e) => setZonaElegida(e.currentTarget.value)}
        opciones={ZONAS_HORARIAS.map((z) => ({
          valor: z.valor,
          etiqueta: z.etiqueta,
        }))}
        help="Todas las horas de la plataforma se muestran en esta zona."
        error={estado.errores?.timezone}
      />

      <Checkbox
        id="recordatorios_email"
        name="recordatorios_email"
        label="Recordatorio por correo"
        descripcion="Un aviso 24 horas antes de cada cita. Indica solo fecha, hora y modalidad."
        defaultChecked={recordatorios}
      />

      <div>
        <Button type="submit" loading={enviando ? "Guardando…" : undefined}>
          Guardar preferencias
        </Button>
      </div>
    </form>
  );
}

/* ========================================================================== */

export function FormularioCorreo({ correoActual }: { correoActual: string }) {
  const [estado, accion, enviando] = useActionState(cambiarCorreo, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <Resultado estado={estado} />

      <Field
        id="correo-actual"
        label="Correo actual"
        defaultValue={correoActual}
        disabled
        readOnly
      />

      <Field
        id="correo"
        name="correo"
        type="email"
        label="Nuevo correo"
        autoComplete="email"
        help="Te enviaremos un enlace de confirmación a la dirección nueva."
        error={estado.errores?.correo}
      />

      <div>
        <Button
          type="submit"
          variant="secondary"
          loading={enviando ? "Enviando…" : undefined}
        >
          Cambiar correo
        </Button>
      </div>
    </form>
  );
}

export function FormularioContrasena() {
  const [estado, accion, enviando] = useActionState(cambiarContrasena, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <Resultado estado={estado} />

      <Field
        id="actual"
        name="actual"
        type="password"
        label="Contraseña actual"
        autoComplete="current-password"
        error={estado.errores?.actual}
      />

      <Field
        id="nueva"
        name="nueva"
        type="password"
        label="Contraseña nueva"
        autoComplete="new-password"
        help="Al menos 10 caracteres, con una letra y un número."
        error={estado.errores?.nueva}
      />

      <div>
        <Button
          type="submit"
          variant="secondary"
          loading={enviando ? "Guardando…" : undefined}
        >
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}

/* ========================================================================== */

export function FormularioEliminacion({
  yaSolicitada,
}: {
  yaSolicitada: boolean;
}) {
  const [estado, accion, enviando] = useActionState(
    solicitarEliminacion,
    INICIAL,
  );
  const [abierto, setAbierto] = useState(false);

  if (yaSolicitada || estado.ok) {
    return (
      <Alert tone="info" title="Solicitud de eliminación registrada">
        Tu profesional la revisará y se pondrá en contacto contigo. Mientras
        tanto puedes seguir usando la plataforma con normalidad.
      </Alert>
    );
  }

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-text-body text-sm">
          Puedes pedir que se elimine tu cuenta y tus datos. Ten en cuenta que
          tu profesional puede estar obligado por ley a conservar parte de la
          información clínica durante un plazo determinado.
        </p>
        <Button variant="destructive-quiet" onClick={() => setAbierto(true)}>
          Solicitar eliminación de mi cuenta
        </Button>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <Resultado estado={estado} />

      <Alert
        tone="warning"
        title="Esto inicia un trámite, no un borrado inmediato"
      >
        La solicitud queda registrada con fecha y la revisa tu profesional. Te
        confirmará qué información puede eliminarse y cuál debe conservarse por
        obligación legal.
      </Alert>

      <Field
        id="motivo"
        name="motivo"
        label="Motivo"
        optional
        help="Ayuda a tu profesional a entender el contexto. Puedes dejarlo en blanco."
        error={estado.errores?.motivo}
      />

      <Field
        id="confirmacion"
        name="confirmacion"
        label="Escribe ELIMINAR para confirmar"
        autoComplete="off"
        error={estado.errores?.confirmacion}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="destructive"
          loading={enviando ? "Enviando…" : undefined}
        >
          Enviar solicitud
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
