/**
 * La estructura del informe, sin nada de presentación.
 *
 * EXISTE PARA QUE LA PANTALLA Y EL PDF NO SE SEPAREN. El documento se dibuja
 * dos veces —una en HTML y otra con el generador de PDF, que no comparte ni
 * una etiqueta con el navegador— y dos implementaciones de un mismo documento
 * divergen al primer cambio: se añade un apartado a una y nadie se acuerda de
 * la otra. Entonces la empresa y la persona evaluada dejan de leer lo mismo,
 * que es justo lo que este proyecto lleva evitando desde el principio.
 *
 * Aquí vive lo que el informe DICE —qué bloques, en qué orden, con qué textos
 * y qué números— y en cada renderizador solo cómo se ve. Añadir una sección se
 * hace una vez y aparece en los dos.
 *
 * No importa React ni nada del servidor: es una función pura sobre los datos
 * que ya están calculados.
 */

/**
 * Los colores del documento, muestreados del PDF que se entrega.
 *
 * color-guard-archivo-exento: no son los del sistema de diseño y no deben
 * serlo. Aproximarlos con los tokens de estado —rojo de error para Dominancia,
 * verde de éxito para Serenidad— daría un documento PARECIDO al que la
 * consulta lleva años entregando, que en un entregable es peor que uno
 * distinto: nadie sabría si el que tiene delante es el bueno.
 *
 * Viven aquí y no en el componente porque el PDF los necesita igual, y dos
 * paletas para un mismo documento se separan a la primera corrección.
 */
export const COLORES = {
  azul: "#1C4587",
  tinta: "#16233A",
  blanco: "#FFFFFF",
  grisBanda: "#D9D9D9",
  rojo: "#EA4335",
  rojoSuave: "#F4CCCC",
  amarillo: "#FBBC04",
  amarilloSuave: "#FCE5CD",
  verde: "#34A853",
  verdeSuave: "#D9EAD3",
  azulClaro: "#4285F4",
  azulClaroSuave: "#C9DAF8",
} as const;

const ESCALAS = [
  { clave: "D", fuerte: COLORES.rojo, suave: COLORES.rojoSuave },
  { clave: "I", fuerte: COLORES.amarillo, suave: COLORES.amarilloSuave },
  { clave: "S", fuerte: COLORES.verde, suave: COLORES.verdeSuave },
  { clave: "C", fuerte: COLORES.azulClaro, suave: COLORES.azulClaroSuave },
] as const;

/*
 * Los cuadrantes, con el color que les toca EN LA IMAGEN del cerebro.
 *
 * No coincide con el del DISC y no es un error: en el dibujo el cuadrante A es
 * el rojo (superior izquierdo), el B el azul (inferior izquierdo), el C el
 * amarillo (inferior derecho) y el D el verde (superior derecho). Cambiarlos
 * dejaría los recuadros sin relación con el cerebro que tienen al lado.
 */
const CUADRANTES = [
  {
    clave: "cuadrante_a",
    letra: "A",
    subtitulo: "Superior izquierdo cerebral",
    fuerte: COLORES.rojo,
    suave: COLORES.rojoSuave,
  },
  {
    clave: "cuadrante_b",
    letra: "B",
    subtitulo: "Inferior izquierdo límbico",
    fuerte: COLORES.azulClaro,
    suave: COLORES.azulClaroSuave,
  },
  {
    clave: "cuadrante_c",
    letra: "C",
    subtitulo: "Derecho inferior límbico",
    fuerte: COLORES.amarillo,
    suave: COLORES.amarilloSuave,
  },
  {
    clave: "cuadrante_d",
    letra: "D",
    subtitulo: "Derecho superior cerebral",
    fuerte: COLORES.verde,
    suave: COLORES.verdeSuave,
  },
] as const;

/** Los nueve recuadros del perfil clásico, en el orden en que se leen. */
const APARTADOS = [
  "emociones",
  "meta",
  "juzga",
  "influye",
  "teme",
  "valor",
  "mas_efectivo",
  "abusa",
  "bajo_presion",
] as const;

export interface ParametroInforme {
  clave: string;
  etiqueta: string;
  kind: string;
  seccion: string | null;
}

export interface ValorInforme {
  parameter_key: string;
  valor: unknown;
  sugerido: string | null;
  nota: string | null;
}

export interface EvaluadoInforme {
  nombre: string;
  documento: string | null;
  empresa: string | null;
  fechaISO: string | null;
}

export type BloqueEscala = {
  clave: string;
  titulo: string;
  descripcion: string | null;
  claves: string | null;
  interpretacion: string | null;
  puntaje: number | null;
  tramo: string | null;
  fuerte: string;
  suave: string;
};

export type BloqueCuadrante = {
  clave: string;
  letra: string;
  titulo: string;
  subtitulo: string;
  descriptores: string | null;
  descripcion: string | null;
  interpretacion: string | null;
  puntaje: number | null;
  tramo: string | null;
  fuerte: string;
  suave: string;
};

export type Recuadro = { titulo: string; cuerpo: string };

export type EstructuraInforme = {
  patron: string | null;
  codigo: string | null;
  resumen: string | null;
  escalas: BloqueEscala[];
  recuadros: Recuadro[];
  cuadrantes: BloqueCuadrante[];
  neurolateral: Recuadro | null;
  recomendacion: string | null;
  hayDisc: boolean;
  hayCuadrantes: boolean;
};

const tramoDisc = (n: number) => (n <= 2 ? "Bajo" : n <= 5 ? "Medio" : "Alto");

export const tramoCuadrante = (n: number) =>
  n >= 80 ? "Primario" : n >= 60 ? "Secundario" : "Terciario";

export function estructuraDelInforme({
  parametros,
  valores,
  textosFijos,
}: {
  parametros: ParametroInforme[];
  valores: ValorInforme[];
  textosFijos: Record<string, string>;
}): EstructuraInforme {
  const porClave = new Map(valores.map((v) => [v.parameter_key, v]));

  /* Manda lo que escribió el profesional: la redacción del instrumento es su
     borrador, y si la corrigió, la corregida es la buena. */
  const cuerpo = (c: string) => {
    const v = porClave.get(c);
    return v?.nota ?? v?.sugerido ?? null;
  };

  const crudo = (c: string) => {
    const v = porClave.get(c)?.valor;
    return v === null || v === undefined
      ? null
      : String(v).replace(/^"|"$/g, "");
  };

  const numero = (c: string) => {
    const t = crudo(c);
    const n = t === null ? NaN : Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const etiqueta = (c: string) =>
    parametros.find((p) => p.clave === c)?.etiqueta ?? c;

  const escalas: BloqueEscala[] = ESCALAS.map(({ clave, fuerte, suave }) => {
    const puntaje = numero(clave);
    return {
      clave,
      titulo: etiqueta(clave),
      descripcion: textosFijos[clave] ?? null,
      claves: textosFijos[`claves_${clave}`] ?? null,
      interpretacion: cuerpo(clave),
      puntaje,
      tramo: puntaje === null ? null : tramoDisc(puntaje),
      fuerte,
      suave,
    };
  });

  const cuadrantes: BloqueCuadrante[] = CUADRANTES.map((c) => {
    const puntaje = numero(c.clave);
    return {
      clave: c.clave,
      letra: c.letra,
      titulo: `Cuadrante ${c.letra}`,
      subtitulo: c.subtitulo,
      descriptores: textosFijos[`descriptores_${c.clave}`] ?? null,
      descripcion: textosFijos[c.clave] ?? null,
      interpretacion: cuerpo(c.clave),
      puntaje,
      tramo: puntaje === null ? null : tramoCuadrante(puntaje),
      fuerte: c.fuerte,
      suave: c.suave,
    };
  });

  return {
    patron: crudo("patron") ? enTitulo(crudo("patron")!) : null,
    codigo: crudo("segmentos"),
    resumen: cuerpo("resumen"),
    escalas,
    recuadros: APARTADOS.filter((a) => cuerpo(a)).map((a) => ({
      titulo: etiqueta(a),
      cuerpo: cuerpo(a)!,
    })),
    cuadrantes,
    neurolateral: cuerpo("neurolateral")
      ? { titulo: etiqueta("neurolateral"), cuerpo: cuerpo("neurolateral")! }
      : null,
    recomendacion: cuerpo("recomendacion"),
    hayDisc: escalas.some((e) => e.puntaje !== null),
    hayCuadrantes: cuadrantes.some((c) => c.puntaje !== null),
  };
}

/** «PATRON DEL ESPECIALISTA» se lee mejor como «Patrón del Especialista». */
export function enTitulo(texto: string) {
  return texto
    .toLocaleLowerCase("es")
    .replace(/(^|\s)(\p{L})/gu, (_, s, l) => s + l.toLocaleUpperCase("es"))
    .replace(/^Patron\b/, "Patrón")
    .replace(/\bDel\b/g, "del");
}

/** La fecha del encabezado, en el formato del documento entregado. */
export function fechaDelInforme(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
