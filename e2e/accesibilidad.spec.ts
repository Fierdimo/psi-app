import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Auditoría automática de accesibilidad (PLAN.md §12.1).
 *
 * Lo que axe detecta —contraste, etiquetas ausentes, estructura, roles mal
 * puestos— es el suelo, no el techo: no comprueba si el recorrido con teclado
 * tiene sentido ni si un lector de pantalla entiende el calendario. Esa parte
 * sigue necesitando una revisión a mano, anotada en el README.
 *
 * Lo que sí garantiza es que una regresión evidente no llegue a producción sin
 * que nadie se entere.
 */

const REGLAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function auditar(page: Page, ruta: string) {
  await page.goto(ruta);
  const { violations } = await new AxeBuilder({ page })
    .withTags(REGLAS)
    .analyze();

  // Se listan con detalle: «hay 3 violaciones» no le sirve a nadie para
  // arreglarlas.
  const resumen = violations.map(
    (v) => `${v.id} (${v.impact}) · ${v.help} · ${v.nodes.length} nodo(s)`,
  );

  expect(resumen, `Accesibilidad en ${ruta}`).toEqual([]);
}

test.describe("Accesibilidad · páginas públicas", () => {
  for (const ruta of [
    "/",
    "/ingresar",
    "/registro",
    "/recuperar",
    "/privacidad",
    "/terminos",
    "/consentimiento-informado",
    "/profesional",
  ]) {
    test(`sin violaciones en ${ruta}`, async ({ page }) => {
      await auditar(page, ruta);
    });
  }
});

test.describe.serial("Accesibilidad · área del paciente", () => {
  test("panel, calendario y mis datos", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);

    for (const ruta of [
      "/panel",
      "/calendario",
      "/calendario?vista=agenda",
      "/calendario?vista=semana",
      "/solicitar-cita",
      "/mis-datos",
      "/documentos",
    ]) {
      await auditar(page, ruta);
    }
  });
});

test.describe.serial("Accesibilidad · área del profesional", () => {
  test("agenda, nueva cita y pacientes", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");

    for (const ruta of [
      "/profesional/agenda",
      "/profesional/agenda?vista=mes",
      "/profesional/agenda/nueva",
      "/profesional/pacientes",
    ]) {
      await auditar(page, ruta);
    }
  });
});
