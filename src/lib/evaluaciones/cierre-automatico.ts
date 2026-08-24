import "server-only";

import { enviarCorreo } from "@/lib/correo/enviar";
import { informeListo, informeParaLaPersona } from "@/lib/correo/plantillas";
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
import { informeAdjunto } from "@/lib/evaluaciones/informe-pdf";
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
        "assessment_id, organization_id, assigned_at, assessment:assessments(nombre, motor), persona:organization_people(nombre, apellidos, documento, email), organizacion:organizations(nombre, contacto_email, contacto_nombre)",
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

    const persona = uno<{
      nombre: string;
      apellidos: string | null;
      documento: string | null;
      email: string | null;
    }>(datos.persona);

    const nombreCompleto =
      [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") ||
      "la persona evaluada";

    const origen = await origenDeLaPeticion();

    /*
     * EL INFORME VIAJA COMO ADJUNTO, y es una decisión del cliente que
     * revierte la regla anterior de este archivo.
     *
     * Antes solo salía el aviso con un enlace, con el argumento de que un
     * perfil psicológico con nombre y cédula no debería cruzar servidores de
     * correo ajenos. Sigue siendo cierto y ahora se acepta a cambio de lo que
     * se gana: la empresa archiva el documento donde archiva lo demás, y la
     * persona evaluada conserva su copia sin depender de haberla guardado en
     * la pantalla del final.
     *
     * Lo que NO cambia: el asunto sigue sin decir de qué va la prueba.
     */
    const pdf = await informeAdjunto(asignacion, {
      nombre: nombreCompleto,
      documento: persona?.documento ?? null,
      empresa: empresa.nombre,
      fechaISO: datos.assigned_at,
    });

    const adjuntos = pdf
      ? [
          {
            nombre: `Informe ${prueba.nombre} - ${nombreCompleto}.pdf`,
            contenido: pdf,
            tipo: "application/pdf",
          },
        ]
      : undefined;

    const paraLaEmpresa = informeListo(
      nombreCompleto,
      prueba.nombre,
      `${origen}/empresa/evaluaciones/${asignacion}`,
      Boolean(pdf),
    );

    await enviarCorreo(
      { correo: empresa.contacto_email, nombre: empresa.contacto_nombre },
      { ...paraLaEmpresa, adjuntos },
    );

    /*
     * Y a la persona evaluada, su copia.
     *
     * Va a la dirección donde le llegó la convocatoria —la escribió la
     * empresa— y eso es un efecto de borde conocido: en un proceso de
     * selección puede ser un buzón corporativo. No añade un destinatario que
     * no tuviera ya acceso: a esa misma dirección viajó su enlace.
     *
     * Se envía DESPUÉS del de la empresa y en su propio `try`: que la persona
     * se quede sin copia no puede impedir que la empresa reciba lo que pagó.
     */
    if (persona?.email && pdf) {
      try {
        await enviarCorreo(
          { correo: persona.email, nombre: persona.nombre },
          {
            ...informeParaLaPersona(
              persona.nombre,
              prueba.nombre,
              empresa.nombre,
            ),
            // Con el mismo adjunto: es su copia, no un aviso de que existe.
            adjuntos,
          },
        );
      } catch (falloCorreo) {
        console.error(
          "[cierre] la persona se quedó sin su copia:",
          falloCorreo instanceof Error
            ? falloCorreo.message
            : "fallo desconocido",
        );
      }
    }
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
