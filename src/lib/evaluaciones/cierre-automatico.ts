import "server-only";

import { enviarCorreo } from "@/lib/correo/enviar";
import { informeListo } from "@/lib/correo/plantillas";
/*
 * Desde `motores`, no desde `motor`.
 *
 * `motor` es el registro vacío; `motores` es el índice que además IMPORTA cada
 * implementación, y ese import es lo que las inscribe. Cogerlo del sitio
 * equivocado compila igual y falla en ejecución con «no hay motor registrado»,
 * que suena a que falta el instrumento en la base y no a un import.
 */
import { motorDe } from "@/lib/evaluaciones/motores";
import type { Item } from "@/lib/evaluaciones/motor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { origenDeLaPeticion } from "@/lib/http/origen";

/**
 * Cerrar la evaluación en cuanto la persona la envía.
 *
 * DECISIÓN DEL CLIENTE. Antes, entre el resultado y la empresa había un
 * profesional que lo leía y lo firmaba; ahora el sistema califica, publica y
 * avisa. Lo que llega es lo que propuso el motor, sin interpretar.
 *
 * Se conserva lo que sí se puede conservar: el informe queda guardado, se
 * puede corregir y volver a mirar, y en la base queda escrito que salió solo
 * (`results.released_automatically`), que es la diferencia entre un informe
 * publicado y uno firmado.
 *
 * NUNCA LANZA. Si el motor revienta o el correo no sale, la persona ya
 * terminó su prueba y no puede hacer nada al respecto: dejarla ante un error
 * sería castigarla por un fallo nuestro. Se registra y la evaluación se queda
 * en «enviada», que es justo el estado en el que el profesional la ve como
 * pendiente de calificar.
 */
export async function cerrarYAvisar(asignacion: string): Promise<void> {
  const admin = crearClienteAdmin();

  try {
    const { data: datos } = await admin
      .from("assignments")
      .select(
        "assessment_id, organization_id, assessment:assessments(nombre, motor), persona:organization_people(nombre, apellidos), organizacion:organizations(nombre, contacto_email, contacto_nombre)",
      )
      .eq("id", asignacion)
      .maybeSingle();

    if (!datos) return;

    const uno = <T>(v: unknown): T | null =>
      Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);

    const prueba = uno<{ nombre: string; motor: string }>(datos.assessment);
    if (!prueba?.motor) return;

    const [items, respuestas, textos] = await Promise.all([
      leerTodo<Item>((d, h) =>
        admin
          .from("assessment_items")
          .select("id, posicion, tipo, enunciado, escala, opciones")
          .eq("assessment_id", datos.assessment_id)
          .order("posicion")
          .range(d, h),
      ),
      leerTodo<{ item_id: string; valor: unknown }>((d, h) =>
        admin
          .from("responses")
          .select("item_id, valor")
          .eq("assignment_id", asignacion)
          .range(d, h),
      ),
      leerTodo<{ parameter_key: string; nivel: string | null; cuerpo: string }>(
        (d, h) =>
          admin
            .from("assessment_texts")
            .select("parameter_key, nivel, cuerpo")
            .eq("assessment_id", datos.assessment_id)
            .order("parameter_key")
            .order("nivel", { nullsFirst: true })
            .range(d, h),
      ),
    ]);

    const valores = motorDe(prueba.motor).calificar({
      items,
      respuestas: respuestas as never,
      textos: textos as never,
    });

    const { error } = await admin.rpc("cerrar_evaluacion_automaticamente", {
      p_assignment_id: asignacion,
      p_valores: valores,
    });

    if (error) {
      console.error("[cierre] no se pudo publicar:", error.message);
      return;
    }

    const empresa = uno<{
      nombre: string;
      contacto_email: string | null;
      contacto_nombre: string | null;
    }>(datos.organizacion);

    if (!empresa?.contacto_email) {
      // Sin correo de contacto no hay a quién avisar, pero el informe ya está
      // publicado y la empresa lo verá al entrar. No es un fallo.
      return;
    }

    const persona = uno<{ nombre: string; apellidos: string | null }>(
      datos.persona,
    );

    const origen = await origenDeLaPeticion();

    await enviarCorreo(
      { correo: empresa.contacto_email, nombre: empresa.contacto_nombre },
      informeListo(
        [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") ||
          "la persona evaluada",
        prueba.nombre,
        `${origen}/empresa/informes/${asignacion}`,
      ),
    );
  } catch (fallo) {
    /*
     * Se registra el mensaje, no el error entero: la excepción del motor
     * puede arrastrar las respuestas de la persona, y eso no va a un registro.
     */
    console.error(
      "[cierre] la evaluación quedó sin publicar:",
      fallo instanceof Error ? fallo.message : "fallo desconocido",
    );
  }
}

/** Igual que en la calificación manual: PostgREST corta en mil filas. */
async function leerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGINA = 1000;
  const todo: T[] = [];

  for (let desde = 0; ; desde += PAGINA) {
    const { data } = await consulta(desde, desde + PAGINA - 1);
    if (!data || data.length === 0) break;
    todo.push(...data);
    if (data.length < PAGINA) break;
  }

  return todo;
}
