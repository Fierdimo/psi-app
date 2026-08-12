import { capitalizar, fechaLarga, rangoHorario } from "@/lib/fechas/formato";
import { MODALIDAD, type Modalidad } from "@/lib/citas/estados";

/**
 * Plantillas de correo (SPEC.md §15.2, PLAN.md §8).
 *
 * REGLA DE CONFIDENCIALIDAD, no negociable: un correo indica fecha, hora y
 * modalidad. NADA MÁS. Nunca el motivo de consulta, nunca contenido clínico,
 * nunca la palabra «psicología» ni «terapia» en el asunto.
 *
 * El motivo es concreto: el asunto de un correo aparece en la pantalla de
 * bloqueo de un teléfono, y ese teléfono puede estar sobre una mesa a la vista
 * de una pareja, un familiar o un compañero de trabajo. Que alguien esté en
 * tratamiento psicológico es información sensible por sí sola, aunque no se
 * diga nada de su contenido.
 *
 * Por eso el remitente también es neutro: el nombre de la plataforma, no el
 * del profesional ni el de la consulta.
 *
 * color-guard-archivo-exento: los colores van literales y en línea porque un
 * cliente de correo no resuelve variables CSS ni carga hojas de estilo. Aun
 * así son los mismos valores del sistema de diseño, y la prohibición del negro
 * sigue vigente aquí.
 */

export type DatosCita = {
  inicioISO: string;
  finISO: string;
  modalidad: Modalidad;
  lugar: string | null;
  zona: string;
};

export type Correo = { asunto: string; texto: string; html: string };

function bloqueDeCita(cita: DatosCita) {
  const fecha = capitalizar(fechaLarga(cita.inicioISO, cita.zona));
  const horas = rangoHorario(cita.inicioISO, cita.finISO, cita.zona);
  const donde = cita.lugar ? `\n${cita.lugar}` : "";
  return `${fecha}\n${horas} · ${MODALIDAD[cita.modalidad]}${donde}`;
}

/** Envoltorio HTML sobrio, con los colores de marca y sin imágenes externas. */
function envolver(titulo: string, cuerpo: string, cita?: DatosCita) {
  const bloque = cita
    ? `<div style="background:#EEF3FF;border-left:3px solid #2F49D4;border-radius:6px;padding:16px;margin:20px 0">
         <p style="margin:0;color:#16233A;font-size:17px;font-weight:600">
           ${capitalizar(fechaLarga(cita.inicioISO, cita.zona))}
         </p>
         <p style="margin:4px 0 0;color:#33415C;font-size:15px">
           ${rangoHorario(cita.inicioISO, cita.finISO, cita.zona)} · ${MODALIDAD[cita.modalidad]}
         </p>
         ${cita.lugar ? `<p style="margin:4px 0 0;color:#64748B;font-size:14px">${cita.lugar}</p>` : ""}
       </div>`
    : "";

  // Los colores van en línea y literales a propósito: el correo se abre fuera
  // de la aplicación, donde no existen ni las variables CSS ni la hoja de
  // estilos. Aun así son los mismos tokens del sistema.
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#F7F9FC;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE3ED;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px;color:#1C2C84;font-size:17px;font-weight:600">Psi</p>
    <h1 style="margin:0 0 12px;color:#16233A;font-size:21px;font-weight:600">${titulo}</h1>
    <p style="margin:0;color:#33415C;font-size:15px;line-height:1.6">${cuerpo}</p>
    ${bloque}
    <p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
      Puedes consultar y gestionar tus citas en tu espacio privado.
    </p>
  </div>
</body></html>`;
}

export function citaConfirmada(cita: DatosCita, nombre: string | null): Correo {
  const saludo = nombre ? `Hola ${nombre}: ` : "";
  return {
    asunto: `Tu cita del ${capitalizar(fechaLarga(cita.inicioISO, cita.zona))} está confirmada`,
    texto: `${saludo}tu cita quedó confirmada.\n\n${bloqueDeCita(cita)}\n\nPuedes consultarla en tu espacio privado.`,
    html: envolver(
      "Tu cita está confirmada",
      `${saludo}ya está todo listo.`,
      cita,
    ),
  };
}

export function citaRechazada(
  cita: DatosCita,
  nombre: string | null,
  motivo: string | null,
): Correo {
  const saludo = nombre ? `Hola ${nombre}: ` : "";
  const explicacion = motivo
    ? `Motivo: ${motivo}`
    : "Puedes proponer otro horario cuando quieras.";
  return {
    asunto: "No pudimos confirmar el horario que pediste",
    texto: `${saludo}el horario que propusiste no quedó disponible.\n\n${bloqueDeCita(cita)}\n\n${explicacion}`,
    html: envolver(
      "No pudimos confirmar ese horario",
      `${saludo}el horario que propusiste no quedó disponible. ${explicacion}`,
      cita,
    ),
  };
}

export function citaCancelada(cita: DatosCita, nombre: string | null): Correo {
  const saludo = nombre ? `Hola ${nombre}: ` : "";
  return {
    asunto: `Se canceló tu cita del ${capitalizar(fechaLarga(cita.inicioISO, cita.zona))}`,
    texto: `${saludo}la siguiente cita quedó cancelada.\n\n${bloqueDeCita(cita)}\n\nSi necesitas otro horario, puedes solicitarlo en tu espacio privado.`,
    html: envolver(
      "Tu cita fue cancelada",
      `${saludo}si necesitas otro horario, puedes solicitarlo en tu espacio privado.`,
      cita,
    ),
  };
}

export function recordatorio(cita: DatosCita, nombre: string | null): Correo {
  const saludo = nombre ? `Hola ${nombre}: ` : "";
  return {
    asunto: "Recordatorio de tu cita de mañana",
    texto: `${saludo}te recordamos tu cita.\n\n${bloqueDeCita(cita)}`,
    html: envolver("Recordatorio de tu cita", `${saludo}te esperamos.`, cita),
  };
}

/** Aviso al profesional. Aquí sí puede ir el nombre: es su propia agenda. */
export function nuevaSolicitud(
  cita: DatosCita,
  nombrePaciente: string,
): Correo {
  return {
    asunto: `Nueva solicitud de cita · ${nombrePaciente}`,
    texto: `${nombrePaciente} propuso un horario.\n\n${bloqueDeCita(cita)}\n\nPuedes confirmarla o rechazarla desde tu agenda.`,
    html: envolver(
      "Nueva solicitud de cita",
      `<strong>${nombrePaciente}</strong> propuso un horario. Puedes confirmarla o rechazarla desde tu agenda.`,
      cita,
    ),
  };
}
