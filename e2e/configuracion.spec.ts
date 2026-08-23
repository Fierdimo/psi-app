import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * La configuración del profesional, después de retirar la agenda.
 *
 * Era la pantalla de las reglas de la agenda —anticipación, duración del
 * bloque, jornada, pausa, días laborables— y sin citas ninguna de esas reglas
 * gobierna nada. Un ajuste que no cambia el comportamiento de nada es peor que
 * ninguno: alguien lo toca creyendo que sirve.
 *
 * Lo que queda es la condición de aplicación del instrumento: cuánto tiempo
 * hay para TERMINAR una prueba desde que se empieza.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test.describe.serial("Configuración del profesional", () => {
  test.afterAll(async () => {
    // Se deja como nace: sin límite. Otras pruebas responden pruebas enteras y
    // una ventana estrecha las cerraría a medio camino.
    await admin()
      .from("assessments")
      .update({ ventana_minutos: null })
      .eq("clave", "disc_dominancia");

    // Con `eq`: `safeupdate` rechaza los UPDATE sin WHERE, tenga la tabla una
    // fila o un millón.
    await admin()
      .from("clinic_settings")
      .update({ dias_para_empezar: 30 })
      .eq("id", true);
  });

  test("solo queda la ventana de cada prueba", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/consulta");

    await expect(
      page.getByRole("heading", { name: "Configuración" }),
    ).toBeVisible();
    await expect(
      page.getByText("Perfil DISC y dominancia cerebral"),
    ).toBeVisible();

    // Y lo de la agenda ya no está.
    await expect(page.getByText(/anticipación mínima/i)).toHaveCount(0);
    await expect(page.getByText(/duración de cada cita/i)).toHaveCount(0);
    await expect(page.getByText(/días laborables/i)).toHaveCount(0);

    /*
     * La distinción entre los dos plazos, a la vista.
     *
     * Es lo único de esta pantalla que se puede entender mal, y de forma cara:
     * quien crea que fija el plazo para EMPEZAR pondría treinta minutos y
     * dejaría fuera a todo el mundo.
     */
    await expect(page.getByText(/dos plazos distintos/i)).toBeVisible();

    // Los dos ajustes, y el general primero: puesto debajo de una lista que
    // puede crecer, parecería pertenecer a la última prueba de la lista.
    await expect(
      page.getByRole("heading", { name: /plazo para empezar/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/días para abrir el enlace/i)).toBeVisible();
    await expect(page.getByLabel(/minutos para terminar/i)).toBeVisible();
  });

  test("el plazo para empezar se cambia, y no toca lo ya enviado", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/consulta");

    await expect(page.getByText(/ahora mismo\s*30 días/i)).toBeVisible();

    const formPlazo = page.locator("form").filter({
      has: page.getByLabel(/días para abrir el enlace/i),
    });

    await page.getByLabel(/días para abrir el enlace/i).fill("7");
    await formPlazo.getByRole("button", { name: /guardar/i }).click();

    /*
     * El mensaje dice a qué NO afecta.
     *
     * Es la pregunta inmediata de quien acaba de acortar el plazo: «¿acabo de
     * cerrarle el enlace a los cuarenta que convocamos ayer?». La fecha se
     * estampa al crear cada evaluación, así que no.
     */
    await expect(
      page.getByText(/los ya enviados conservan la fecha/i),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText(/ahora mismo\s*7 días/i)).toBeVisible();

    // Y un valor imposible se rechaza con su motivo.
    await page.getByLabel(/días para abrir el enlace/i).fill("0");
    await formPlazo.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText(/al menos un día/i)).toBeVisible();
  });

  test("se fija el tiempo y se puede quitar", async ({ page }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto("/profesional/consulta");

    await expect(page.getByText(/ahora mismo\s*sin límite/i)).toBeVisible();

    /*
     * Cada formulario tiene su «Guardar».
     *
     * Desde que hay dos ajustes en la pantalla, un `getByRole('button')` suelto
     * resuelve a los dos y pulsa el que no era. Se acota al formulario que
     * contiene el campo, que es la forma de decir «este» sin depender del
     * orden en que estén pintados.
     */
    const suForm = page.locator("form").filter({
      has: page.getByLabel(/minutos para terminar/i),
    });

    await page.getByLabel(/minutos para terminar/i).fill("120");
    await suForm.getByRole("button", { name: /guardar/i }).click();

    await expect(
      page.getByText(/tendrá 120 minutos para terminar/i),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText(/ahora mismo\s*120 minutos/i)).toBeVisible();

    // Un valor imposible se rechaza con su motivo, no en silencio.
    await page.getByLabel(/minutos para terminar/i).fill("2");
    await suForm.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText(/entre 5 minutos y 24 horas/i)).toBeVisible();

    /*
     * Y vaciarlo significa «sin límite», no «cero».
     *
     * Un campo numérico vacío llega como cadena vacía y se convierte en 0 sin
     * rechistar: sin tratarlo aparte, dejarlo en blanco pediría una ventana de
     * cero minutos y la respuesta hablaría de un mínimo que nadie escribió.
     */
    await page.getByLabel(/minutos para terminar/i).fill("");
    await suForm.getByRole("button", { name: /guardar/i }).click();
    await expect(page.getByText(/deja de tener tiempo límite/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/ahora mismo\s*sin límite/i)).toBeVisible();
  });
});
