#!/usr/bin/env node
/**
 * Guardia de color (SPEC.md §2.1, PLAN.md §12.2).
 *
 * Hace cumplir dos reglas que de otro modo se erosionan en semanas:
 *
 *   1. NUNCA NEGRO. Ni #000, ni `black`, ni rgba(0,0,0,…), ni los casi-negros
 *      #111/#222. El neutro más oscuro de la app es #16233A (texto) y #101740
 *      (fondos). Un principio que depende de que cada quien lo recuerde al
 *      escribir CSS no sobrevive al tercer sprint.
 *
 *   2. UN SOLO ORIGEN DE COLOR. Ningún literal de color fuera de
 *      src/styles/tokens.css. Si un componente inventa su propio azul, el
 *      sistema deja de ser un sistema.
 *
 * Salida: código 1 y listado de infracciones con archivo:línea.
 */

import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TOKENS_FILE = "src/styles/tokens.css";

/** Negro y casi-negro, en cualquier notación. */
const BLACK_PATTERNS = [
  { re: /#000\b/gi, what: "#000" },
  { re: /#000000\b/gi, what: "#000000" },
  { re: /#111\b/gi, what: "#111 (casi-negro)" },
  { re: /#222\b/gi, what: "#222 (casi-negro)" },
  { re: /\brgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/gi, what: "rgb/rgba(0,0,0)" },
  { re: /(?<![\w-])black(?![\w-])/gi, what: "la palabra `black`" },
  {
    re: /\b(?:bg|text|border|ring|shadow|fill|stroke|from|via|to)-black\b/g,
    what: "utilidad -black de Tailwind",
  },
];

/** Cualquier literal de color. Solo permitido en tokens.css. */
const COLOR_LITERAL_PATTERNS = [
  { re: /#[0-9a-f]{3,8}\b/gi, what: "literal hexadecimal" },
  { re: /\brgba?\([^)]*\)/gi, what: "literal rgb/rgba" },
  { re: /\bhsla?\([^)]*\)/gi, what: "literal hsl/hsla" },
  { re: /\boklch\([^)]*\)/gi, what: "literal oklch" },
];

const violations = [];

/**
 * Neutraliza los comentarios conservando el número de líneas.
 *
 * Documentar «#C6D0DE da 1.56:1 y por eso no se usa» es exactamente el tipo de
 * comentario que queremos en el código: explica una decisión no obvia. Sería
 * absurdo que la guardia lo tratara como infracción. Se revisa el código, no
 * la prosa.
 */
function stripComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    "\n".repeat((block.match(/\n/g) ?? []).length),
  );

  return withoutBlocks
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line))
    .join("\n");
}

const IGNORE_MARKER = "color-guard-ignore";

/**
 * Exención de archivo completo para la regla 2.
 *
 * Existe por un caso real: las plantillas de correo. Un cliente de correo no
 * resuelve variables CSS ni carga hojas de estilo, así que los colores tienen
 * que ir literales y en línea. Marcar cada línea sería ruido.
 *
 * La regla 1 —NUNCA NEGRO— sigue aplicando también ahí: un correo tampoco
 * debe usar negro puro.
 */
const IGNORE_FILE_MARKER = "color-guard-archivo-exento";

function scan(file, patterns, rule) {
  const abs = resolve(ROOT, file);
  const source = readFileSync(abs, "utf8");

  // El marcador de excepción vive en un comentario, así que hay que buscarlo
  // en el original: para cuando los comentarios están neutralizados, ya no está.
  const raw = source.split("\n");
  const lines = stripComments(source).split("\n");

  const isIgnored = (i) =>
    raw[i]?.includes(IGNORE_MARKER) ||
    // También vale el marcador en el bloque de comentario inmediatamente
    // anterior, que es donde cabe explicar el porqué con holgura.
    raw
      .slice(Math.max(0, i - 4), i)
      .some((prev) => prev.includes(IGNORE_MARKER));

  lines.forEach((line, i) => {
    if (isIgnored(i)) return;

    for (const { re, what } of patterns) {
      re.lastIndex = 0;
      if (re.test(line)) {
        violations.push({
          file,
          line: i + 1,
          rule,
          what,
          text: line.trim().slice(0, 90),
        });
      }
    }
  });
}

const files = globSync("src/**/*.{ts,tsx,css}", { cwd: ROOT });

for (const file of files) {
  const normalized = file.split("\\").join("/");

  // Regla 1 aplica en todas partes, incluido tokens.css.
  scan(normalized, BLACK_PATTERNS, "NUNCA NEGRO");

  // Regla 2 exime al archivo de tokens —donde viven los colores— y a los
  // archivos que declaran su exención con justificación.
  const contenido = readFileSync(resolve(ROOT, normalized), "utf8");
  const exento =
    normalized === TOKENS_FILE || contenido.includes(IGNORE_FILE_MARKER);

  if (!exento) {
    scan(normalized, COLOR_LITERAL_PATTERNS, "COLOR FUERA DE TOKENS");
  }
}

if (violations.length === 0) {
  console.log(
    `✓ Guardia de color: ${files.length} archivos revisados, sin infracciones.`,
  );
  process.exit(0);
}

console.error(`\n✗ Guardia de color: ${violations.length} infracción(es).\n`);

for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    [${v.rule}] ${v.what}`);
  console.error(`    ${v.text}\n`);
}

console.error(
  "El color se define en src/styles/tokens.css y se consume por token.\n" +
    "Si una línea necesita una excepción real, añade el comentario\n" +
    "`color-guard-ignore` con la justificación.\n",
);

process.exit(1);
