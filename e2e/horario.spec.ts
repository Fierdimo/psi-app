import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * La jornada de la consulta.
 *
 * La duración de una cita la elegía quien la pedía, así que la agenda del
 * profesional la componían terceros. Esta pantalla es donde ahora la declara
 * él, y hasta hoy solo miraba: decía que para cambiar algo había que abrir la
 * base de datos.
 */
test.describe("Horario de la consulta", () => {
  test("el profesional declara su jornada y se le dice cuánta gente cabe", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/consulta");

    await page.getByLabel("Entrada").fill("08:00");
    await page.getByLabel("Salida").fill("16:00");
    await page.getByLabel("Empieza la pausa").fill("12:00");
    await page.getByLabel("Termina la pausa").fill("13:00");

    await page.getByRole("button", { name: /guardar el horario/i }).click();

    /*
     * El mensaje dice el NÚMERO, no «guardado».
     *
     * Ocho horas menos una de pausa, en bloques de una hora, son siete citas.
     * Es la cuenta con la que se entra a esta pantalla, y verla delata al
     * instante una pausa mal puesta o un bloque demasiado largo.
     */
    await expect(page.getByText(/7 citas por día de atención/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test("media pausa no se guarda: dejaría franjas fantasma", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/consulta");

    await page.getByLabel("Empieza la pausa").fill("12:00");
    await page.getByLabel("Termina la pausa").clear();

    await page.getByRole("button", { name: /guardar el horario/i }).click();

    await expect(
      page.getByText(/indica el principio y el final de la pausa/i),
    ).toBeVisible();
  });
});
