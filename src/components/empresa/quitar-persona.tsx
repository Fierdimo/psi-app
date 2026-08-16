"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { quitarPersona } from "@/lib/empresa/acciones";

const INICIAL = { ok: false, mensaje: "" };

/**
 * Retirar a alguien del listado.
 *
 * Va aparte del formulario y no como un botón más: borrar no es guardar, y
 * ponerlos juntos hace que se pulse el que no era.
 *
 * La base lo impide si esa persona ya tiene una evaluación asignada o está
 * convocada a una sesión confirmada. Aquí no se adivina el motivo: se enseña
 * el que devuelve, que es el que explica qué hacer.
 */
export function QuitarPersona({ persona }: { persona: string }) {
  const [estado, accion, enviando] = useActionState(quitarPersona, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="persona" value={persona} />

      {estado.mensaje ? (
        <Alert
          tone={estado.ok ? "success" : "danger"}
          title={estado.ok ? "Retirada" : "No se puede quitar"}
        >
          {estado.mensaje}
        </Alert>
      ) : null}

      <div>
        <Button type="submit" variant="secondary" disabled={enviando}>
          {enviando ? "Quitando…" : "Quitar del listado"}
        </Button>
      </div>
    </form>
  );
}
