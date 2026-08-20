"use server";

import { obtenerPerfil } from "@/lib/auth/perfil";
import { origenDeLaPeticion } from "@/lib/http/origen";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EnlaceDeAcceso } from "@/lib/validacion/auth";

/**
 * El acceso de una persona, pedido en el momento.
 *
 * Se busca al pulsar y no se manda con la página a propósito. Pintar la cola
 * de evaluaciones metería veinticinco testigos vivos en el código de una
 * pantalla que casi siempre se abre para otra cosa; así solo sale el de la
 * persona por la que se preguntó.
 */
export async function paseDePersona(
  personaId: string,
): Promise<
  { ok: true; pase: EnlaceDeAcceso } | { ok: false; mensaje: string }
> {
  const perfil = await obtenerPerfil();
  if (!perfil) return { ok: false, mensaje: "Necesitas haber entrado." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("pase_de_persona", {
    p_person_id: personaId,
  });

  if (error) {
    return { ok: false, mensaje: error.message.replace(/^.*?:\s*/, "") };
  }

  const fila = (data ?? [])[0] as
    | {
        nombre: string | null;
        apellidos: string | null;
        documento: string | null;
        email: string | null;
        token: string | null;
      }
    | undefined;

  if (!fila) return { ok: false, mensaje: "No encontramos a esa persona." };

  const origen = await origenDeLaPeticion();

  return {
    ok: true,
    pase: {
      nombre:
        [fila.nombre, fila.apellidos].filter(Boolean).join(" ") ||
        (fila.documento ?? "Sin nombre"),
      correo: fila.email ?? (fila.documento ? `Doc. ${fila.documento}` : ""),
      enlace: fila.token ? `${origen}/prueba/${fila.token}` : "",
      sinPase: !fila.token,
    },
  };
}
