import {
  type Entrada,
  type MotorDePrueba,
  type Valor,
  registrar,
  texto,
} from "../motor.ts";

/**
 * Perfil DISC y dominancia cerebral.
 *
 * La baremación se leyó de la hoja de cálculo de la consulta y está escrita
 * aquí, no en datos, porque son números y no palabras: cambiarla cambia el
 * resultado de una persona.
 *
 * ---------------------------------------------------------------------------
 * DÓNDE ESTE CÓDIGO SE APARTA DE LA HOJA, Y POR QUÉ
 *
 * Se reproduce su método en todo salvo en tres erratas de transcripción. No
 * son criterios psicométricos —esos no se tocan— sino celdas mal escritas:
 *
 *   1. La fórmula de D suma la celda K47 dos veces y la de I suma K46 dos
 *      veces: 29 sumandos donde el instrumento tiene 28 bloques. Aquí cada
 *      escala cuenta sus 28 bloques una sola vez.
 *
 *   2. El cuadrante C lee dos veces su sexto ítem y nunca lee el décimo; el
 *      cuadrante D está corrido una columna, así que se come el último ítem de
 *      C y pierde el suyo. Aquí cada cuadrante suma sus diez afirmaciones,
 *      que es lo que dicen los enunciados.
 *
 *   3. La búsqueda del perfil neurolateral consulta una celda VACÍA en vez de
 *      la que guarda el código, y por eso el informe de muestra imprime «#N/A»
 *      justo debajo de su propio código. Aquí se consulta el código.
 *
 * Todo lo demás —tabla de segmentos, códigos, patrones, rangos— es idéntico.
 * ---------------------------------------------------------------------------
 */

const ESCALAS = ["D", "I", "S", "C"] as const;
const CUADRANTES = ["A", "B", "C", "D"] as const;

/**
 * De la diferencia entre «más» y «menos» al segmento 1..7.
 *
 * La hoja lo expresa como cincuenta y seis condiciones encadenadas, una por
 * cada diferencia posible de -28 a 28. Son estos siete tramos.
 */
function segmento(diferencia: number): number {
  if (diferencia <= -8) return 1;
  if (diferencia <= -4) return 2;
  if (diferencia <= -1) return 3;
  if (diferencia <= 1) return 4; // 0 y 1
  if (diferencia <= 4) return 5;
  if (diferencia <= 8) return 6;
  return 7;
}

/** Los tres tramos del cuadrante cerebral, sobre 100. */
function nivelCuadrante(puntaje: number): number {
  if (puntaje >= 80) return 1; // primario
  if (puntaje >= 60) return 2; // secundario
  return 3; // terciario
}

/**
 * Lo que marcó la persona en un bloque de elección forzada.
 *
 * La hoja lo codifica como 1 = «la que MÁS me describe» y 2 = «la que MENOS».
 * Se conserva esa codificación para que un informe de hoy y uno de hace dos
 * años digan lo mismo.
 */
interface Marca {
  mas?: string;
  menos?: string;
}

export const discDominancia: MotorDePrueba = {
  clave: "disc_dominancia",

  calificar({ items, respuestas, textos }: Entrada): Valor[] {
    const porItem = new Map(respuestas.map((r) => [r.item_id, r.valor]));
    const salida: Valor[] = [];

    // =======================================================================
    // DISC
    // =======================================================================
    const mas: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
    const menos: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };

    for (const item of items) {
      if (item.tipo !== "forced_choice") continue;

      const marca = (porItem.get(item.id) ?? {}) as Marca;
      for (const opcion of item.opciones) {
        if (!opcion.escala) continue;
        if (marca.mas === opcion.id) mas[opcion.escala] += 1;
        if (marca.menos === opcion.id) menos[opcion.escala] += 1;
      }
    }

    const segmentos: Record<string, number> = {};

    for (const escala of ESCALAS) {
      const s = segmento(mas[escala] - menos[escala]);
      segmentos[escala] = s;
      salida.push({
        parameter_key: escala,
        valor: s,
        sugerido: texto(textos, escala, s),
      });
    }

    // El código es la concatenación de los cuatro segmentos, en orden DISC.
    const codigo = ESCALAS.map((e) => segmentos[e]).join("");
    salida.push({ parameter_key: "segmentos", valor: codigo });

    const patron = texto(textos, "patron", codigo);
    salida.push({ parameter_key: "patron", valor: patron ?? null });

    /*
     * Los nueve apartados del informe salen del patrón, no de las
     * puntuaciones. Si el código no tiene patrón conocido —le pasa a 345 de
     * los 2401 posibles— se devuelven vacíos EN VEZ de omitirlos: la pantalla
     * debe poder decir «esto no se pudo determinar» y que el profesional lo
     * redacte, que es mejor que un informe al que le faltan secciones sin
     * explicación.
     */
    const APARTADOS = [
      "resumen",
      "emociones",
      "meta",
      "juzga",
      "influye",
      "valor",
      "abusa",
      "bajo_presion",
      "teme",
      "mas_efectivo",
    ];

    for (const clave of APARTADOS) {
      salida.push({
        parameter_key: clave,
        valor: null,
        sugerido: patron ? texto(textos, clave, patron) : undefined,
      });
    }

    // =======================================================================
    // Dominancia cerebral
    // =======================================================================
    const niveles: number[] = [];

    for (const cuadrante of CUADRANTES) {
      const suma = items
        .filter((i) => i.tipo === "likert" && i.escala === cuadrante)
        .reduce((total, item) => {
          const v = Number(porItem.get(item.id) ?? 0);
          return total + (Number.isFinite(v) ? v : 0);
        }, 0);

      // Diez afirmaciones de 1 a 5: por dos, la escala queda sobre 100.
      const puntaje = suma * 2;
      const nivel = nivelCuadrante(puntaje);
      niveles.push(nivel);

      salida.push({
        parameter_key: `cuadrante_${cuadrante.toLowerCase()}`,
        valor: puntaje,
        sugerido: texto(textos, `cuadrante_${cuadrante.toLowerCase()}`, nivel),
      });
    }

    const codigoNeuro = niveles.join("");
    salida.push({
      parameter_key: "neurolateral",
      valor: codigoNeuro,
      sugerido: texto(textos, "neurolateral", codigoNeuro),
    });

    return salida;
  },
};

registrar(discDominancia);
