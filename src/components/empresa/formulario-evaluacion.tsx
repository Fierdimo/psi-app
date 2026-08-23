"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { pedirEvaluacion } from "@/lib/usos/acciones";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

/**
 * Encargar una evaluación: dos campos y un uso.
 *
 * Nombre y correo. Nada de cargo, ni de vínculo, ni de tipo de contrato: para
 * mandar una prueba y devolver un informe no hace falta saber nada de eso, y
 * cada campo de más es una excusa para no enviar hoy.
 *
 * El documento está y es opcional a propósito. Dejó de ser identidad cuando
 * dejaron de existir las cuentas; hoy sirve para una sola cosa, distinguir dos
 * homónimos en una tanda de cuarenta, y por eso no bloquea nada.
 */
export function FormularioEvaluacion({
  pruebas,
  saldo,
}: {
  pruebas: readonly { valor: string; etiqueta: string }[];
  saldo: number;
}) {
  const [estado, accion, enviando] = useActionState(pedirEvaluacion, INICIAL);

  return (
    <form
      action={accion}
      className="border-line bg-panel flex flex-col gap-5 rounded-lg border p-6"
      noValidate
    >
      <p className="text-text-muted text-sm">
        Al enviar se descuenta un uso y le llega un correo con su enlace y un
        código QR. Te quedan{" "}
        <strong className="text-text-strong">{saldo}</strong>.
      </p>

      {estado.mensaje && (
        <Alert tone="danger" title="No se pudo encargar">
          {estado.mensaje}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Con una sola prueba el desplegable parece de más. Se queda: el día
            que haya dos, la pantalla no cambia y nadie tiene que aprenderla
            otra vez. */}
        <Select
          id="prueba"
          name="prueba"
          label="Prueba"
          className="sm:col-span-2"
          opciones={pruebas}
          defaultValue={pruebas[0]?.valor}
          error={estado.errores?.prueba}
        />
        <Field
          id="nombre"
          name="nombre"
          label="Nombre"
          autoComplete="off"
          defaultValue=""
          error={estado.errores?.nombre}
        />
        <Field
          id="apellidos"
          name="apellidos"
          label="Apellidos"
          optional
          autoComplete="off"
          defaultValue=""
          error={estado.errores?.apellidos}
        />
        <Field
          id="email"
          name="email"
          type="email"
          label="Correo"
          autoComplete="off"
          defaultValue=""
          help="Es por donde le llega el enlace. Usa su correo personal si lo tienes: el informe se le envía también a esta dirección."
          error={estado.errores?.email}
        />
        <Field
          id="documento"
          name="documento"
          label="Documento"
          optional
          autoComplete="off"
          defaultValue=""
          help="Solo para que lo reconozcas en el listado. No se le pide ni se comprueba."
          error={estado.errores?.documento}
        />
      </div>

      <div>
        <Button
          type="submit"
          disabled={saldo < 1}
          loading={enviando ? "Enviando…" : undefined}
        >
          Encargar y enviar el enlace
        </Button>
      </div>
    </form>
  );
}
