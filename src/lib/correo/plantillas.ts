import { capitalizar, fechaLarga, rangoHorario } from "@/lib/fechas/formato";
import { RESPONSABLE } from "@/lib/legal/responsable";
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

/**
 * Un archivo que viaja dentro del correo.
 *
 * Existe por el QR de la convocatoria, y hace falta que sea un ADJUNTO EN
 * LÍNEA y no un `data:` URI en el `src`: Gmail y Outlook bloquean las imágenes
 * en base64 embebidas, y el QR es justo lo que tiene que poder escanearse
 * desde el teléfono sin pulsar nada.
 *
 * Con `cid`, el HTML lo referencia como `cid:<ese valor>`.
 */
export type Adjunto = {
  nombre: string;
  /** Contenido en base64, SIN el prefijo `data:...;base64,`. */
  contenido: string;
  tipo: string;
  cid?: string;
};

export type Correo = {
  asunto: string;
  texto: string;
  html: string;
  adjuntos?: Adjunto[];
};

function bloqueDeCita(cita: DatosCita) {
  const fecha = capitalizar(fechaLarga(cita.inicioISO, cita.zona));
  const horas = rangoHorario(cita.inicioISO, cita.finISO, cita.zona);
  const donde = cita.lugar ? `\n${cita.lugar}` : "";
  return `${fecha}\n${horas} · ${MODALIDAD[cita.modalidad]}${donde}`;
}

/** Envoltorio HTML sobrio, con los colores de marca y sin imágenes externas. */
/*
 * El pie por defecto habla de «tus citas en tu espacio privado», y eso no vale
 * para todos: a quien recibe una invitación todavía no le existe ese espacio
 * —lo crea con ese mismo correo—. Se vio al poder abrir el correo de verdad,
 * no leyendo el código.
 */
function envolver(
  titulo: string,
  cuerpo: string,
  cita?: DatosCita,
  pie?: string,
) {
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
    <p style="margin:0 0 20px;color:#1C2C84;font-size:17px;font-weight:600">JBR Psicometrías</p>
    <h1 style="margin:0 0 12px;color:#16233A;font-size:21px;font-weight:600">${titulo}</h1>
    <p style="margin:0;color:#33415C;font-size:15px;line-height:1.6">${cuerpo}</p>
    ${bloque}
    ${
      pie ??
      `<p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
      Puedes consultar y gestionar tus citas en tu espacio privado.
    </p>`
    }
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

/*
 * Avisos a una EMPRESA sobre la sesión que encargó.
 *
 * No valen los de arriba: hablan de «tu cita» y de «tu espacio privado», y
 * quien recibe esto no viene a que le atiendan — manda a varias personas a que
 * las evalúen. Tampoco se nombra a ninguna de ellas: la empresa ya sabe a
 * quién convocó, y un asunto con nombres propios acaba reenviado.
 */
export function sesionConfirmada(
  cita: DatosCita,
  contacto: string | null,
  cuantos: number,
): Correo {
  const saludo = contacto ? `Hola ${contacto}: ` : "";
  const gente = cuantos === 1 ? "1 persona" : `${cuantos} personas`;
  return {
    asunto: `Sesión de evaluación confirmada para el ${fechaLarga(cita.inicioISO, cita.zona)}`,
    texto: `${saludo}la sesión de evaluación que solicitaron quedó confirmada para ${gente}.\n\n${bloqueDeCita(cita)}\n\nCada persona convocada recibirá su propio enlace para activar su acceso.`,
    html: envolver(
      "Sesión de evaluación confirmada",
      `${saludo}la sesión quedó confirmada para ${gente}. Cada persona convocada recibirá su propio enlace.`,
      cita,
    ),
  };
}

export function sesionRechazada(
  cita: DatosCita,
  contacto: string | null,
  motivo: string | null,
): Correo {
  const saludo = contacto ? `Hola ${contacto}: ` : "";
  const explicacion = motivo
    ? `Motivo: ${motivo}`
    : "Pueden proponer otro horario cuando quieran.";
  return {
    asunto: "No pudimos confirmar el horario de la sesión",
    texto: `${saludo}el horario propuesto para la sesión de evaluación no quedó disponible.\n\n${bloqueDeCita(cita)}\n\n${explicacion}`,
    html: envolver(
      "No pudimos confirmar ese horario",
      `${saludo}el horario propuesto no quedó disponible. ${explicacion}`,
      cita,
    ),
  };
}

export function sesionCancelada(
  cita: DatosCita,
  contacto: string | null,
): Correo {
  const saludo = contacto ? `Hola ${contacto}: ` : "";
  return {
    asunto: `Se canceló la sesión del ${fechaLarga(cita.inicioISO, cita.zona)}`,
    texto: `${saludo}la sesión de evaluación quedó cancelada.\n\n${bloqueDeCita(cita)}`,
    html: envolver(
      "La sesión fue cancelada",
      `${saludo}la sesión de evaluación quedó cancelada.`,
      cita,
    ),
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

/**
 * Invitación a una sesión de evaluación encargada por una empresa.
 *
 * Aquí la regla de confidencialidad se aplica al revés que en el resto: la
 * empresa que encarga la evaluación SÍ se nombra, porque quien recibe este
 * correo tiene derecho a saber quién pidió evaluarle antes de aceptar nada.
 * Ocultarlo sería pedirle que se presente a algo sin decirle de parte de quién.
 *
 * Lo que sigue sin aparecer es qué se va a evaluar: ni el instrumento, ni el
 * cargo, ni nada que en la pantalla de bloqueo de un teléfono revele que la
 * persona está en un proceso de selección. Eso puede costarle el empleo que
 * tiene, y es exactamente el daño que estas plantillas existen para evitar.
 */
export function invitacionEvaluacion(
  cita: DatosCita,
  datos: { nombre: string | null; empresa: string; enlace: string },
): Correo {
  const saludo = datos.nombre ? `Hola ${datos.nombre}: ` : "";
  const cuerpo =
    `${saludo}${datos.empresa} te ha convocado a una sesión con el profesional. ` +
    `Antes de la fecha necesitas activar tu acceso, leer las condiciones y dar tu consentimiento.`;

  const texto = [
    cuerpo,
    "",
    bloqueDeCita(cita),
    "",
    "Activa tu acceso aquí:",
    datos.enlace,
    "",
    "Si no reconoces esta convocatoria, no hagas nada: sin tu consentimiento no se te evalúa.",
  ].join("\n");

  const html = envolver(
    "Te han convocado a una sesión",
    `${cuerpo}<br><br>
     <a href="${datos.enlace}" style="display:inline-block;background:#2F49D4;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500">Activar mi acceso</a>
     <br><br>
     <span style="color:#64748B;font-size:13px">Si no reconoces esta convocatoria, no hagas nada: sin tu consentimiento no se te evalúa.</span>`,
    cita,
    `<p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
       El enlace es solo tuyo: no lo reenvíes.
     </p>`,
  );

  return {
    asunto: `Te han convocado a una sesión · ${datos.empresa}`,
    texto,
    html,
  };
}

/**
 * El informe de una evaluación, camino de la empresa que la encargó.
 *
 * NO lleva el informe dentro. Lleva el aviso y el enlace, y por dos motivos:
 * el correo viaja por servidores que no controlamos y un perfil psicológico
 * con nombre y cédula no debería ir en el cuerpo de un mensaje; y en la
 * plataforma el informe está siempre al día, mientras que una copia en un
 * correo se queda congelada aunque después se corrija.
 *
 * El asunto tampoco dice nada del contenido: puede quedar a la vista en la
 * pantalla de un teléfono que esté mirando otra persona.
 */
export function informeListo(
  persona: string,
  instrumento: string,
  enlace: string,
  /** Si el PDF va adjunto, el texto deja de mandar a la plataforma a buscarlo. */
  conAdjunto = false,
): Correo {
  const titulo = "Ya está disponible un informe";

  return {
    asunto: "Informe disponible · JBR Psicometrías",
    texto: conAdjunto
      ? `El informe de ${persona} (${instrumento}) va adjunto a este correo.\n\n` +
        `También queda en tu espacio de empresa, donde está siempre al día si ` +
        `se corrige:\n${enlace}\n\n` +
        `Recuerda que respondes de este documento: úsalo solo para el proceso ` +
        `que motivó la evaluación y no lo difundas fuera de él.`
      : `El informe de ${persona} (${instrumento}) ya está disponible ` +
        `en tu espacio de empresa.\n\n${enlace}\n\n` +
        `Si necesitas comentarlo, escríbenos.`,
    html: envolver(
      titulo,
      conAdjunto
        ? `El informe de <strong>${persona}</strong> (${instrumento}) va ` +
            `adjunto a este correo.`
        : `El informe de <strong>${persona}</strong> (${instrumento}) ya está ` +
            `disponible en tu espacio de empresa.`,
      undefined,
      /*
       * El recordatorio de custodia, en cada informe.
       *
       * No crea la obligación —esa se acepta al contratar, en las condiciones
       * de uso— pero la mantiene a la vista de quien abre el documento, que es
       * el momento en que importa. Una obligación firmada hace seis meses y no
       * repetida nunca es una obligación que nadie recuerda tener.
       */
      `<p style="margin:20px 0 0"><a href="${enlace}" style="display:inline-block;background:#2440C4;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">Ver el informe</a></p>
    <p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
      El informe no viaja en este correo: se consulta en la plataforma, donde
      está siempre al día.
    </p>
    <p style="margin:12px 0 0;color:#64748B;font-size:13px;line-height:1.5">
      Recuerda que respondes de este documento: úsalo solo para el proceso que
      motivó la evaluación y no lo difundas fuera de él.
    </p>`,
    ),
  };
}

/**
 * La convocatoria a una evaluación encargada por una empresa.
 *
 * Sustituye a `invitacionEvaluacion` para el modelo sin sesiones. Las
 * diferencias no son cosméticas:
 *
 *   · NO LLEVA FECHA NI HORA, porque no las hay. Se responde cuando se pueda,
 *     dentro del plazo del enlace.
 *   · NO INVITA A CREAR CUENTA. Quien responde no es usuario de la plataforma
 *     y no lo va a ser: el enlace es su única credencial, antes y después.
 *   · LLEVA EL QR EN LÍNEA. La convocatoria se reparte también en persona —un
 *     folio en la puerta de la planta— y ahí el enlace no se teclea.
 *
 * Lo que no cambia es la regla del asunto: dice quién convoca y nada del
 * contenido de la prueba.
 */
export function convocatoriaEvaluacion(datos: {
  nombre: string | null;
  empresa: string;
  instrumento: string;
  enlace: string;
  /** PNG del QR en base64, sin prefijo. Sin él, el correo sale solo con enlace. */
  qr: string | null;
  /**
   * Hasta cuándo vale el enlace, y en qué zona decirlo.
   *
   * Iba escrito a mano —«caduca en 30 días»— y en cuanto el plazo pasó a ser
   * configurable esa frase se convirtió en una mentira esperando a ocurrir.
   * Ahora viaja la fecha que la base estampó al crear la evaluación.
   *
   * La zona es la de la EMPRESA que convoca. No se sabe la de la persona —no
   * tiene cuenta, no ha dicho dónde está— y la de su empleador es la mejor
   * aproximación disponible: la convocó para su proceso.
   */
  venceISO: string;
  zona: string;
}): Correo {
  const limite = capitalizar(fechaLarga(datos.venceISO, datos.zona));
  const saludo = datos.nombre ? `Hola ${datos.nombre}: ` : "";
  const cuerpo =
    `${saludo}${datos.empresa} te ha pedido completar una evaluación. ` +
    `Antes de empezar leerás las condiciones y decidirás si aceptas; ` +
    `sin tu consentimiento no se te evalúa.`;

  const texto = [
    cuerpo,
    "",
    "Entra aquí cuando puedas dedicarle un rato sin interrupciones:",
    datos.enlace,
    "",
    `El enlace es solo tuyo: no lo reenvíes. Tienes hasta el ${limite}.`,
  ].join("\n");

  /*
   * El QR va DEBAJO del botón, no en su lugar.
   *
   * Quien abre el correo en el teléfono pulsa; quien lo recibe impreso escanea.
   * Poner solo el QR obligaría al primero a apuntar su propio teléfono a su
   * propia pantalla, que es la clase de detalle que solo se ve probándolo.
   */
  const bloqueQr = datos.qr
    ? `<br><br>
       <p style="margin:0 0 8px;color:#64748B;font-size:13px">O escanea este código:</p>
       <img src="cid:qr-evaluacion" width="160" height="160" alt="Código QR con tu enlace de acceso"
            style="display:block;border:1px solid #E2E8F0;border-radius:8px;background:#FFFFFF;padding:8px">`
    : "";

  const html = envolver(
    "Tienes una evaluación pendiente",
    `${cuerpo}<br><br>
     <a href="${datos.enlace}" style="display:inline-block;background:#2F49D4;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500">Empezar mi evaluación</a>
     ${bloqueQr}
     <br><br>
     <span style="color:#64748B;font-size:13px">Si no reconoces esta convocatoria, no hagas nada: sin tu consentimiento no se te evalúa.</span>`,
    undefined,
    `<p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
       El enlace es solo tuyo: no lo reenvíes. Tienes hasta el ${limite}.
     </p>`,
  );

  return {
    asunto: `Tu evaluación · ${datos.empresa}`,
    texto,
    html,
    adjuntos: datos.qr
      ? [
          {
            nombre: "acceso.png",
            contenido: datos.qr,
            tipo: "image/png",
            cid: "qr-evaluacion",
          },
        ]
      : undefined,
  };
}

/**
 * La resolución de una compra de usos, camino de la empresa.
 *
 * Sale en los dos sentidos —autorizada y rechazada— porque el silencio es
 * peor que un no: entre pedir y resolver hay un pago que ocurre fuera de la
 * plataforma, y quien lo hizo necesita saber que llegó.
 *
 * El motivo del rechazo va ENTERO en el correo, no un «entra a verlo». Es lo
 * único que permite corregir y volver a intentarlo, y obligar a entrar para
 * leer una línea es hacer trabajar a alguien por nada.
 */
export function usosResueltos(datos: {
  cantidad: number;
  autorizada: boolean;
  motivo?: string | null;
  enlace: string;
}): Correo {
  const cuantos = `${datos.cantidad} ${datos.cantidad === 1 ? "uso" : "usos"}`;

  if (datos.autorizada) {
    return {
      asunto: "Tus usos ya están disponibles · JBR Psicometrías",
      texto:
        `Confirmamos tu pago y añadimos ${cuantos} a tu saldo. ` +
        `Ya puedes encargar evaluaciones desde tu espacio de empresa.\n\n` +
        `${datos.enlace}`,
      html: envolver(
        "Tus usos ya están disponibles",
        `Confirmamos tu pago y añadimos <strong>${cuantos}</strong> a tu saldo. ` +
          `Ya puedes encargar evaluaciones.`,
        undefined,
        `<p style="margin:20px 0 0"><a href="${datos.enlace}" style="display:inline-block;background:#2440C4;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">Encargar una evaluación</a></p>`,
      ),
    };
  }

  const motivo = datos.motivo?.trim() || "No se indicó un motivo.";

  return {
    asunto: "Sobre tu solicitud de usos · JBR Psicometrías",
    texto:
      `No pudimos autorizar tu solicitud de ${cuantos}.\n\n${motivo}\n\n` +
      `Si crees que hay un error, respóndenos a este correo.`,
    html: envolver(
      "Sobre tu solicitud de usos",
      `No pudimos autorizar tu solicitud de <strong>${cuantos}</strong>.` +
        `<br><br><span style="color:#16233A">${motivo}</span>`,
      undefined,
      `<p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
         Si crees que hay un error, respóndenos a este correo y lo revisamos.
       </p>`,
    ),
  };
}

/**
 * El acuse de recibo, para quien acaba de responder la prueba.
 *
 * NO LLEVA RESULTADOS, y ese es todo el sentido de esta plantilla. Antes salía
 * de aquí el mismo PDF que iba a la empresa; ahora sale la confirmación de que
 * la prueba está completa y la indicación de con quién sigue el proceso.
 *
 * El motivo es el destinatario, no el pudor: esta dirección la escribió la
 * empresa al convocar, y en un proceso de selección puede ser un buzón
 * corporativo que también lee quien decide. Un perfil psicométrico interpretado
 * a solas, recién salido de la prueba y sin nadie que lo lea contigo, es
 * además la peor manera de recibirlo.
 *
 * Lo que sí se conserva es la vía: el pie deja a la vista la dirección por la
 * que cualquiera puede pedir sus datos. No enviarlos de oficio no es lo mismo
 * que negarlos, y esa diferencia es justo la que hay que dejar escrita.
 *
 * Por eso el asunto tampoco dice de qué va la prueba, como en el resto.
 */
export function evaluacionRecibida(
  nombre: string | null,
  empresa: string,
): Correo {
  const saludo = nombre ? `Hola ${nombre}: ` : "";
  const cuerpo =
    `${saludo}hemos recibido tus respuestas y tu evaluación quedó ` +
    `completa. Gracias por el tiempo que le dedicaste; no tienes que hacer ` +
    `nada más por esta vía.`;

  const siguiente =
    `Los resultados se remitieron a ${empresa}, que fue quien encargó la ` +
    `evaluación y con quien continúa tu proceso. Para conocer los siguientes ` +
    `pasos o los plazos, dirígete a ellos por el canal en el que te venían ` +
    `atendiendo.`;

  return {
    asunto: `Recibimos tus respuestas · ${empresa}`,
    texto: [
      cuerpo,
      "",
      siguiente,
      "",
      "Si quieres consultar tus datos personales o ejercer tus derechos sobre",
      `ellos, escríbenos a ${RESPONSABLE.correo}.`,
    ].join("\n"),
    html: envolver(
      "Evaluación completada",
      `${cuerpo}<br><br>${siguiente}`,
      undefined,
      `<p style="margin:20px 0 0;color:#64748B;font-size:13px;line-height:1.5">
         Si quieres consultar tus datos personales o ejercer tus derechos sobre
         ellos, escríbenos a ${RESPONSABLE.correo}.
       </p>`,
    ),
  };
}
