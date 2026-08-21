import type { CitaConPaciente } from "./estados";

/**
 * Un día de una sesión de empresa, con el tramo que ocupa ESE día.
 *
 * Lo devuelve `jornadas_de_sesion`, agrupando por la hora de cada convocado.
 */
export type Jornada = {
  appointment_id: string;
  dia: string;
  desde: string;
  hasta: string;
  personas: number;
};

/**
 * Una cita tal y como la ve el calendario, ya repartida por jornadas.
 *
 * `jornadaFinal` es falso en todas menos la última de una sesión repartida, y
 * lo necesita quien ofrezca CERRARLA: «asistió / no asistió» cierra la sesión
 * entera, así que ofrecerlo en la fila del lunes la daría por terminada con la
 * gente del miércoles todavía sin pasar.
 *
 * Opcional porque quien no pasa por `porJornadas` no reparte nada: una lista de
 * citas individuales no tiene jornadas intermedias que proteger. Ausente vale
 * lo mismo que verdadero, y quien lo lee compara contra `false` a propósito.
 */
export type CitaEnJornada<T extends CitaConPaciente = CitaConPaciente> = T & {
  jornadaFinal?: boolean;
};

/**
 * Una sesión repartida en varios días, como una entrada por día.
 *
 * EL PROBLEMA. `appointments.starts_at` y `ends_at` son el primero y el último
 * de la tanda. Con quince personas repartidas del lunes al miércoles eso es
 * «lunes 08:00 – miércoles 11:00», y las tres vistas del calendario agrupan por
 * el día de `starts_at`: la sesión salía solo el lunes, y el martes y el
 * miércoles la agenda se daba por libre teniendo gente citada. Es el fallo que
 * hace que el profesional acepte otra cosa encima.
 *
 * LA FORMA DE ARREGLARLO. No se tocan las vistas: se les da una entrada por
 * jornada, cada una con las horas reales de ese día. `VistaMes`, `VistaSemana`
 * y `AgendaLista` siguen haciendo lo único que hacen —agrupar por el día de
 * `starts_at`— y ahora aciertan. Las tres comparten el `id`, así que las tres
 * llevan a la misma ficha, que es lo que se espera al pulsarlas.
 *
 * Lo que NO tiene jornadas pasa intacto: las citas individuales no tienen
 * convocados, y una sesión que todavía nadie ha organizado conserva la fecha
 * que propuso la empresa, que es justo lo que hay que ver para decidir.
 */
export function porJornadas<T extends CitaConPaciente>(
  citas: T[],
  jornadas: Jornada[],
): CitaEnJornada<T>[] {
  const porCita = new Map<string, Jornada[]>();
  for (const j of jornadas) {
    porCita.set(j.appointment_id, [
      ...(porCita.get(j.appointment_id) ?? []),
      j,
    ]);
  }

  const expandidas: CitaEnJornada<T>[] = citas.flatMap((cita) => {
    const suyas = porCita.get(cita.id);
    if (!suyas || suyas.length === 0) return [{ ...cita, jornadaFinal: true }];

    const enOrden = [...suyas].sort(
      (a, b) => Date.parse(a.desde) - Date.parse(b.desde),
    );

    return enOrden.map((j, i) => ({
      ...cita,
      starts_at: j.desde,
      ends_at: j.hasta,
      /*
       * Ojo: se compara contra las jornadas DEL PERIODO, no contra todas.
       *
       * Mirando la semana del lunes, la última que se ve es la del viernes
       * aunque la tanda siga el lunes siguiente. Por eso se contrasta también
       * con el fin real de la cita: si la sesión termina más tarde de lo que
       * este periodo alcanza a ver, ninguna de estas es la final.
       */
      jornadaFinal:
        i === enOrden.length - 1 &&
        Date.parse(j.hasta) >= Date.parse(cita.ends_at),
    }));
  });

  return expandidas.sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  );
}
