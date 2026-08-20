import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

const SESION = "88888888-0000-4000-8000-0000000000aa";

/**
 * El tablero del día.
 *
 * Aceptar una solicitud de empresa era decir «sí» a un bloque de tres horas con
 * varios nombres dentro, sin saber si cabían ni en qué orden. Esto comprueba lo
 * que ahora se puede hacer antes de aceptar: ver los bloques del día, colocar a
 * cada persona, dejar huecos y pasar a alguien a otra fecha.
 */
function lunesQueViene(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + 7);
  return d.toISOString().slice(0, 10);
}

test.describe.serial("Organizar el día", () => {
  test("un día no laborable lo dice, en vez de quedarse vacío", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto(`/profesional/citas/${SESION}`);

    const sabado = new Date(lunesQueViene());
    sabado.setDate(sabado.getDate() + 5);

    await page
      .getByLabel(/día que estás organizando/i)
      .fill(sabado.toISOString().slice(0, 10));

    /*
     * Con margen: la rejilla se pide al servidor al cambiar de día, y la
     * primera vez que se toca esta ruta hay que compilarla. Cinco segundos
     * bastaban al correr la prueba sola y no al correr la suite entera, que es
     * el peor tipo de prueba: la que falla según con quién viaje.
     */
    await expect(page.getByText(/ese día no tiene bloques/i)).toBeVisible({
      timeout: 20000,
    });
  });

  test("coloca a una persona, deja el resto en hueco y lo guarda", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto(`/profesional/citas/${SESION}`);

    await page.getByLabel(/día que estás organizando/i).fill(lunesQueViene());

    /*
     * Se comprueba que el resumen y la rejilla dicen lo mismo, no un número
     * concreto: la jornada es un ajuste y otra prueba puede haberla cambiado.
     * Un número escrito aquí ataría esta prueba al orden de ejecución.
     */
    const bloques = page.getByRole("combobox", { name: /quién va a las/i });
    await expect(bloques.first()).toBeVisible({ timeout: 15000 });

    const cuantos = await bloques.count();
    expect(cuantos).toBeGreaterThan(1);
    await expect(
      page.getByText(new RegExp(`el día tiene ${cuantos} bloques`, "i")),
    ).toBeVisible();

    // Se coloca a una y se deja el bloque siguiente vacío a propósito.
    await bloques.first().selectOption({ index: 1 });
    await expect(page.getByText(/1 de 2 personas citadas/i)).toBeVisible();

    await page.getByRole("button", { name: /guardar el reparto/i }).click();
    await expect(page.getByText(/1 persona citada/i).first()).toBeVisible({
      timeout: 15000,
    });

    /*
     * Y quien se queda sin hora se ve.
     *
     * Esconderlo dejaría aceptar una sesión con más gente que bloques, que es
     * el error que este tablero existe para evitar.
     */
    await expect(page.getByText(/1 persona sin hora/i)).toBeVisible();
  });
});
