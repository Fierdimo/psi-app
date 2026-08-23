"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Field } from "@/components/ui/field";
import { autorizarUsos, rechazarUsos } from "@/lib/usos/acciones-profesional";
import type { EstadoFormulario } from "@/lib/validacion/auth";

const INICIAL: EstadoFormulario = { ok: false };

export type SolicitudDeUsos = {
  id: string;
  cantidad: number;
  nota: string | null;
  pedida: string;
  empresa: string;
  contactoNombre: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  saldoActual: number;
};

/**
 * La bandeja de compras de usos.
 *
 * Sustituye a la de solicitudes de cita, y decide lo mismo que decidía
 * aquella: si algo que se acordó fuera de la plataforma ocurrió de verdad.
 * Antes era «¿te va bien esta fecha?»; ahora es «¿entró el pago?».
 *
 * Por eso el CANAL DE CONTACTO está en la tarjeta y no a un clic. Es por donde
 * se resuelve el trámite, y tenerlo delante mientras se decide es la
 * diferencia entre resolver la bandeja de una sentada y abrir cinco pestañas.
 *
 * Las dos acciones pasan por diálogo. Autorizar mete saldo —dinero— y rechazar
 * le dice que no a alguien que dice haber pagado. Ninguna se deshace.
 */
export function BandejaUsos({
  solicitudes,
}: {
  solicitudes: readonly SolicitudDeUsos[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {solicitudes.map((s) => (
        <FilaSolicitud key={s.id} solicitud={s} />
      ))}
    </ul>
  );
}

function FilaSolicitud({ solicitud }: { solicitud: SolicitudDeUsos }) {
  const [autorizando, setAutorizando] = useState(false);
  const [rechazando, setRechazando] = useState(false);

  const [estadoSi, accionSi, enviandoSi] = useActionState(
    autorizarUsos,
    INICIAL,
  );
  const [estadoNo, accionNo, enviandoNo] = useActionState(
    rechazarUsos,
    INICIAL,
  );

  const fallo = estadoSi.mensaje && !estadoSi.ok ? estadoSi : estadoNo;

  return (
    <li className="border-line bg-panel flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-text-strong text-lg font-semibold">
            {solicitud.empresa}
          </span>
          <span className="text-text-body">
            Pide{" "}
            <strong className="text-text-strong">
              {solicitud.cantidad} {solicitud.cantidad === 1 ? "uso" : "usos"}
            </strong>{" "}
            · hoy tiene {solicitud.saldoActual}
          </span>
          {solicitud.nota && (
            <span className="text-text-muted text-sm">{solicitud.nota}</span>
          )}
          <span className="text-text-muted text-sm">{solicitud.pedida}</span>
        </div>

        {/* El canal, a la vista. Es por donde se comprueba el pago. */}
        <div className="flex flex-col gap-0.5 text-sm">
          {solicitud.contactoNombre && (
            <span className="text-text-body">{solicitud.contactoNombre}</span>
          )}
          {solicitud.contactoEmail && (
            <a
              href={`mailto:${solicitud.contactoEmail}`}
              className="text-accent font-medium"
            >
              {solicitud.contactoEmail}
            </a>
          )}
          {solicitud.contactoTelefono && (
            <a
              href={`tel:${solicitud.contactoTelefono}`}
              className="text-text-body"
            >
              {solicitud.contactoTelefono}
            </a>
          )}
        </div>
      </div>

      {fallo?.mensaje && !fallo.ok && (
        <Alert tone="danger" title="No se pudo resolver">
          {fallo.mensaje}
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setAutorizando(true)}>
          Autorizar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setRechazando(true)}
        >
          Rechazar
        </Button>
      </div>

      <Dialogo
        abierto={autorizando}
        titulo={`Autorizar ${solicitud.cantidad} usos a ${solicitud.empresa}`}
        aceptar="Autorizar"
        aceptando={enviandoSi ? "Autorizando…" : undefined}
        formulario={`autorizar-${solicitud.id}`}
        onCerrar={() => setAutorizando(false)}
      >
        <p className="text-text-body">
          Su saldo pasará de {solicitud.saldoActual} a{" "}
          {solicitud.saldoActual + solicitud.cantidad}. Hazlo solo cuando el
          pago esté confirmado: el saldo no se retira.
        </p>

        <form
          id={`autorizar-${solicitud.id}`}
          action={accionSi}
          className="mt-4"
        >
          <input type="hidden" name="orden" value={solicitud.id} />
          <Field
            id={`referencia-${solicitud.id}`}
            name="referencia"
            label="Referencia del pago"
            optional
            defaultValue=""
            help="Un número de transferencia o de factura. Queda guardado con la autorización."
            error={estadoSi.errores?.referencia}
          />
        </form>
      </Dialogo>

      <Dialogo
        abierto={rechazando}
        titulo={`Rechazar la solicitud de ${solicitud.empresa}`}
        aceptar="Rechazar"
        variante="destructive"
        aceptando={enviandoNo ? "Rechazando…" : undefined}
        formulario={`rechazar-${solicitud.id}`}
        onCerrar={() => setRechazando(false)}
      >
        <p className="text-text-body">
          No se carga nada a su saldo. El motivo le llega tal cual por correo,
          así que conviene que le sirva para corregir.
        </p>

        <form
          id={`rechazar-${solicitud.id}`}
          action={accionNo}
          className="mt-4"
        >
          <input type="hidden" name="orden" value={solicitud.id} />
          <Field
            id={`motivo-${solicitud.id}`}
            name="motivo"
            label="Motivo"
            defaultValue=""
            error={estadoNo.errores?.motivo}
          />
        </form>
      </Dialogo>
    </li>
  );
}
