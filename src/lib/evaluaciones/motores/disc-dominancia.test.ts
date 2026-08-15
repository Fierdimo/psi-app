import assert from "node:assert/strict";
import { test } from "node:test";

import type { Item, Texto } from "../motor.ts";
import { discDominancia } from "./disc-dominancia.ts";

/**
 * El calificador, contra el informe real de la consulta.
 *
 * Estas pruebas existen porque aquí se decide qué dice el informe de una
 * persona sobre la que alguien va a tomar una decisión de contratación. Un
 * error de un segmento cambia el patrón, y el patrón cambia los nueve
 * apartados.
 *
 * La referencia es el informe de muestra: segmentos 3-2-6-4, código «3264»,
 * «Patron del Especialista».
 */

const ESCALAS = ["I", "D", "S", "C"] as const;

/** 28 bloques con el mapa real: por posición I, D, S, C. */
function bloques(): Item[] {
  return Array.from({ length: 28 }, (_, n) => ({
    id: `b${n + 1}`,
    posicion: n + 1,
    tipo: "forced_choice",
    enunciado: `Bloque ${n + 1}`,
    escala: null,
    opciones: ESCALAS.map((escala, i) => ({
      id: "abcd"[i],
      texto: `${escala}${n + 1}`,
      escala,
    })),
  }));
}

/** 40 afirmaciones, diez por cuadrante. */
function afirmaciones(): Item[] {
  const out: Item[] = [];
  for (const cuadrante of ["A", "B", "C", "D"]) {
    for (let n = 1; n <= 10; n++) {
      out.push({
        id: `${cuadrante}${n}`,
        posicion: out.length + 29,
        tipo: "likert",
        enunciado: `${cuadrante} ${n}`,
        escala: cuadrante,
        opciones: [],
      });
    }
  }
  return out;
}

/** La opción de un bloque que tributa a esa escala. */
const opcionDe = (escala: string) => "abcd"[ESCALAS.indexOf(escala as never)];

/**
 * Construye respuestas que producen una diferencia dada por escala.
 *
 * Marcar «más» en una escala suma; marcar «menos» resta. Cada bloque admite
 * un «más» y un «menos», que es lo que hace ipsativo al instrumento.
 */
function respuestasDISC(
  mas: Record<string, number>,
  menos: Record<string, number>,
) {
  const pendienteMas = { ...mas };
  const pendienteMenos = { ...menos };

  return bloques().map((item) => {
    const conMas = ESCALAS.find((e) => (pendienteMas[e] ?? 0) > 0);
    if (conMas) pendienteMas[conMas] -= 1;

    const conMenos = ESCALAS.find(
      (e) => (pendienteMenos[e] ?? 0) > 0 && e !== conMas,
    );
    if (conMenos) pendienteMenos[conMenos] -= 1;

    return {
      item_id: item.id,
      valor: {
        mas: conMas ? opcionDe(conMas) : undefined,
        menos: conMenos ? opcionDe(conMenos) : undefined,
      },
    };
  });
}

const TEXTOS: Texto[] = [
  { parameter_key: "patron", nivel: "3264", cuerpo: "Patron del Especialista" },
  {
    parameter_key: "emociones",
    nivel: "Patron del Especialista",
    cuerpo: "Moderación calculada.",
  },
  { parameter_key: "D", nivel: "3", cuerpo: "Asertividad Situacional Baja." },
  { parameter_key: "cuadrante_a", nivel: "1", cuerpo: "El Arquitecto Lógico." },
  {
    parameter_key: "cuadrante_a",
    nivel: "2",
    cuerpo: "El Analista Ocasional.",
  },
  { parameter_key: "neurolateral", nivel: "1121", cuerpo: "Doble dominancia." },
];

const valor = (vs: ReturnType<typeof discDominancia.calificar>, k: string) =>
  vs.find((v) => v.parameter_key === k);

test("reproduce el perfil del informe de muestra: 3264, Especialista", () => {
  /*
   * Las diferencias que producen 3-2-6-4, según la tabla de segmentos:
   *   D: 3 más − 4 menos = −1 → 3
   *   I: 2 más − 6 menos = −4 → 2
   *   S: 7 más − 2 menos = +5 → 6
   *   C: 3 más − 2 menos = +1 → 4
   *
   * Los límites importan y son fáciles de equivocar: +1 cae en el segmento 4
   * y +2 ya cae en el 5. Escribir la prueba destapó justo esa confusión.
   */
  const valores = discDominancia.calificar({
    items: bloques(),
    respuestas: respuestasDISC(
      { D: 3, I: 2, S: 7, C: 3 },
      { D: 4, I: 6, S: 2, C: 2 },
    ),
    textos: TEXTOS,
  });

  assert.equal(valor(valores, "D")?.valor, 3, "D: diferencia -1 → segmento 3");
  assert.equal(valor(valores, "I")?.valor, 2, "I: diferencia -4 → segmento 2");
  assert.equal(valor(valores, "S")?.valor, 6, "S: diferencia +5 → segmento 6");
  assert.equal(valor(valores, "C")?.valor, 4, "C: diferencia +1 → segmento 4");

  assert.equal(valor(valores, "segmentos")?.valor, "3264");
  assert.equal(valor(valores, "patron")?.valor, "Patron del Especialista");

  // El apartado narrativo sale del PATRÓN, no de la puntuación.
  assert.equal(valor(valores, "emociones")?.sugerido, "Moderación calculada.");

  // Y la interpretación de la escala, de su segmento.
  assert.equal(valor(valores, "D")?.sugerido, "Asertividad Situacional Baja.");
});

test("el patrón casa aunque la hoja lo escriba en otra caja", () => {
  /*
   * La hoja guarda «Patron del Especialista» en la tabla de segmentos y
   * «PATRON DEL ESPECIALISTA» en la de textos. BUSCARV las casaba; una
   * comparación estricta no, y el informe salía sin sus nueve apartados con
   * todo lo demás correcto.
   */
  const valores = discDominancia.calificar({
    items: bloques(),
    respuestas: respuestasDISC(
      { D: 3, I: 2, S: 7, C: 3 },
      { D: 4, I: 6, S: 2, C: 2 },
    ),
    textos: [
      {
        parameter_key: "patron",
        nivel: "3264",
        cuerpo: "Patron del Especialista",
      },
      {
        parameter_key: "teme",
        nivel: "PATRON DEL ESPECIALISTA",
        cuerpo: "Los cambios; la desorganización.",
      },
    ],
  });

  assert.equal(
    valor(valores, "teme")?.sugerido,
    "Los cambios; la desorganización.",
  );
});

test("cada escala cuenta sus 28 bloques UNA vez", () => {
  // La hoja original suma K47 dos veces en D y K46 dos veces en I. Si eso se
  // hubiera copiado, marcar «más» en D en los 28 bloques daría 29.
  const valores = discDominancia.calificar({
    items: bloques(),
    respuestas: bloques().map((i) => ({
      item_id: i.id,
      valor: { mas: opcionDe("D"), menos: opcionDe("I") },
    })),
    textos: TEXTOS,
  });

  // 28 «más» y 0 «menos» en D: diferencia 28 → segmento 7, el tope.
  assert.equal(valor(valores, "D")?.valor, 7);
  // 0 «más» y 28 «menos» en I: diferencia -28 → segmento 1, el suelo.
  assert.equal(valor(valores, "I")?.valor, 1);
});

test("un código sin patrón conocido no inventa nada", () => {
  const valores = discDominancia.calificar({
    items: bloques(),
    respuestas: respuestasDISC({ D: 28 }, {}),
    textos: TEXTOS,
  });

  assert.equal(valor(valores, "patron")?.valor, null);

  // Los apartados siguen presentes y vacíos: la pantalla puede decir «esto no
  // se pudo determinar» en vez de que falten secciones sin explicación.
  assert.equal(valor(valores, "emociones")?.sugerido, undefined);
  assert.ok(valor(valores, "teme"), "el apartado existe aunque no tenga texto");
});

test("cada cuadrante suma sus diez afirmaciones, sobre 100", () => {
  const items = afirmaciones();

  // A todo 5 (máximo), B todo 4, C todo 3, D todo 1.
  const puntos: Record<string, number> = { A: 5, B: 4, C: 3, D: 1 };

  const valores = discDominancia.calificar({
    items,
    respuestas: items.map((i) => ({
      item_id: i.id,
      valor: puntos[i.escala!],
    })),
    textos: TEXTOS,
  });

  assert.equal(valor(valores, "cuadrante_a")?.valor, 100, "10 × 5 × 2");
  assert.equal(valor(valores, "cuadrante_b")?.valor, 80);
  assert.equal(valor(valores, "cuadrante_c")?.valor, 60);
  assert.equal(valor(valores, "cuadrante_d")?.valor, 20);

  // 100 y 80 son primarios (1), 60 secundario (2), 20 terciario (3).
  assert.equal(valor(valores, "neurolateral")?.valor, "1123");

  assert.equal(
    valor(valores, "cuadrante_a")?.sugerido,
    "El Arquitecto Lógico.",
    "el texto sale del NIVEL del cuadrante, no de su puntaje",
  );
});

test("los tramos de puntaje caen donde dice la hoja", () => {
  const items = afirmaciones().filter((i) => i.escala === "A");
  const puntajeDe = (porItem: number) =>
    discDominancia.calificar({
      items,
      respuestas: items.map((i) => ({ item_id: i.id, valor: porItem })),
      textos: TEXTOS,
    });

  /** El primer dígito del código neurolateral es el nivel del cuadrante A. */
  const nivelA = (vs: ReturnType<typeof discDominancia.calificar>) =>
    String(valor(vs, "neurolateral")?.valor ?? "")[0];

  // 40 → terciario, 60 → secundario, 80 → primario. Las fronteras exactas.
  assert.equal(valor(puntajeDe(2), "cuadrante_a")?.valor, 40);
  assert.equal(nivelA(puntajeDe(2)), "3");
  assert.equal(valor(puntajeDe(3), "cuadrante_a")?.valor, 60);
  assert.equal(nivelA(puntajeDe(3)), "2");
  assert.equal(valor(puntajeDe(4), "cuadrante_a")?.valor, 80);
  assert.equal(nivelA(puntajeDe(4)), "1");
});
