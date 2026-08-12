import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * «Nunca negro», comprobado sobre lo que se RENDERIZA.
 *
 * La guardia de `pnpm check:colors` revisa el código fuente, y eso deja fuera
 * todo lo que llega por otra vía: un valor inicial del navegador, un estilo de
 * una dependencia, una regla que no se aplica por especificidad. De hecho el
 * fallo que originó esta prueba era exactamente eso — la raíz del documento
 * heredaba el negro del navegador porque el color se fijaba en `body` y no en
 * `html`.
 *
 * Aquí se mira el color calculado de cada elemento con texto visible.
 */

/** Un color se considera negro si es muy oscuro Y sin tinte apreciable. */
const LIMITE_CANAL = 26; // por debajo, cualquier canal es prácticamente negro
const TINTE_MINIMO = 12; // diferencia mínima entre el canal mayor y el menor

async function textosCasiNegros(page: Page) {
  return page.evaluate(
    ({ limite, tinte }) => {
      const problemas: { tag: string; texto: string; color: string }[] = [];

      for (const el of document.querySelectorAll("body *")) {
        const tieneTexto = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        );
        if (!tieneTexto) continue;

        const estilo = getComputedStyle(el);
        if (estilo.visibility === "hidden" || estilo.display === "none")
          continue;

        const canales = estilo.color.match(/\d+/g)?.slice(0, 3).map(Number);
        if (!canales) continue;

        const [r, g, b] = canales;
        const esOscuro = Math.max(r, g, b) < limite;
        const sinTinte = Math.max(r, g, b) - Math.min(r, g, b) < tinte;

        if (esOscuro && sinTinte) {
          problemas.push({
            tag: el.tagName.toLowerCase(),
            texto: (el.textContent ?? "").trim().slice(0, 40),
            color: estilo.color,
          });
        }
      }
      return problemas;
    },
    { limite: LIMITE_CANAL, tinte: TINTE_MINIMO },
  );
}

const PUBLICAS = ["/", "/ingresar", "/registro", "/privacidad", "/profesional"];
const PACIENTE = ["/panel", "/calendario", "/mis-datos", "/documentos"];
const PROFESIONAL = ["/profesional/agenda", "/profesional/pacientes"];

test.describe("Nunca negro · páginas públicas", () => {
  for (const ruta of PUBLICAS) {
    test(`sin texto negro en ${ruta}`, async ({ page }) => {
      await page.goto(ruta);
      expect(await textosCasiNegros(page), `Texto negro en ${ruta}`).toEqual(
        [],
      );
    });
  }
});

test.describe.serial("Nunca negro · áreas privadas", () => {
  test("área del paciente", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    for (const ruta of PACIENTE) {
      await page.goto(ruta);
      expect(await textosCasiNegros(page), `Texto negro en ${ruta}`).toEqual(
        [],
      );
    }
  });

  test("área del profesional", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    for (const ruta of PROFESIONAL) {
      await page.goto(ruta);
      expect(await textosCasiNegros(page), `Texto negro en ${ruta}`).toEqual(
        [],
      );
    }
  });
});

test("la página de error tampoco usa negro", async ({ page }) => {
  await page.goto("/ruta-que-no-existe");
  expect(await textosCasiNegros(page)).toEqual([]);
});
