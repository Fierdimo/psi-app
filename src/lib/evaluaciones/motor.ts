/**
 * El contrato de un motor de prueba.
 *
 * La plataforma parte cada instrumento en dos mitades: sus ítems son DATOS
 * —viven en la base, los dibuja un único ejecutor— y su calificación es
 * CÓDIGO, un módulo registrado aquí por clave.
 *
 * La frontera está donde está por una razón concreta. Expresar una elección
 * forzada con conteos, tabla de segmentos y búsqueda de patrón como «reglas en
 * datos» acaba siendo inventar un lenguaje de programación en JSON: sin tipos,
 * sin pruebas y sin poder leerlo. En cambio los TEXTOS sí son datos, porque el
 * profesional querrá corregir una redacción sin esperar un despliegue.
 *
 * Regla práctica para saber de qué lado cae algo: si al cambiarlo cambia el
 * NÚMERO, es motor; si solo cambia la PALABRA, es dato.
 */

/** Una opción dentro de un ítem. `escala` dice a qué constructo tributa. */
export interface Opcion {
  id: string;
  texto: string;
  escala: string | null;
}

export interface Item {
  id: string;
  posicion: number;
  tipo: string;
  enunciado: string;
  /** La subescala del ítem entero, cuando la escala no es de cada opción. */
  escala: string | null;
  opciones: Opcion[];
}

/** Lo que respondió la persona. La forma del valor depende del tipo de ítem. */
export interface Respuesta {
  item_id: string;
  valor: unknown;
}

/**
 * Un texto normalizado del instrumento.
 *
 * `nivel` hace doble papel a propósito: en un parámetro de escala guarda el
 * tramo («3»), y en uno narrativo el patrón al que pertenece. Es la misma
 * pregunta —¿cuál de las variantes de este parámetro toca?— y no merecía dos
 * tablas.
 */
export interface Texto {
  parameter_key: string;
  nivel: string | null;
  cuerpo: string;
}

export interface Valor {
  parameter_key: string;
  valor: unknown;
  /** Redacción que PROPONE el motor. El profesional la corrige y firma. */
  sugerido?: string;
}

export interface Entrada {
  items: Item[];
  respuestas: Respuesta[];
  textos: Texto[];
}

export interface MotorDePrueba {
  clave: string;
  calificar(entrada: Entrada): Valor[];
}

const REGISTRO = new Map<string, MotorDePrueba>();

export function registrar(motor: MotorDePrueba) {
  REGISTRO.set(motor.clave, motor);
}

/**
 * Falla en vez de devolver nada.
 *
 * Una asignación cuyo motor no existe es un instrumento que se cargó en la
 * base sin su código: seguir adelante produciría un informe vacío con
 * apariencia de correcto, que es justo lo que no puede pasar aquí.
 */
export function motorDe(clave: string): MotorDePrueba {
  const motor = REGISTRO.get(clave);
  if (!motor) {
    throw new Error(
      `No hay motor registrado para «${clave}». El instrumento existe en la ` +
        `base pero nadie sabe puntuarlo.`,
    );
  }
  return motor;
}

/**
 * Busca un texto por parámetro y nivel. Ausente devuelve `undefined`.
 *
 * El nivel se compara SIN distinguir mayúsculas, y no es un capricho: en la
 * hoja de la consulta el patrón se guarda como «Patron del Especialista» en la
 * tabla de segmentos y como «PATRON DEL ESPECIALISTA» en la de textos. Excel
 * las casaba porque su BUSCARV ignora las mayúsculas; una comparación estricta
 * no, y el informe salía sin sus nueve apartados —con el resto correcto, que
 * es lo que lo hacía difícil de ver—.
 */
export function texto(
  textos: Texto[],
  parameter_key: string,
  nivel?: string | number | null,
): string | undefined {
  const buscado =
    nivel === undefined || nivel === null ? null : String(nivel).toLowerCase();

  return textos.find(
    (t) =>
      t.parameter_key === parameter_key &&
      (t.nivel === null || t.nivel === undefined
        ? null
        : t.nivel.toLowerCase()) === buscado,
  )?.cuerpo;
}
