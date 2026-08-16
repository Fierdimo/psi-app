import { expect, test, type Page } from "@playwright/test";

import { entrarComo, guardarSeccion } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Calendario (F3).
 *
 * Las pruebas de zona horaria son las que más valor tienen aquí: es la parte
 * del sistema donde un error no produce una pantalla fea sino una sesión
 * perdida.
 */

/** Fecha dentro de la franja permitida, en formato del input date. */
function enDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function irAlCalendario(page: Page) {
  await page.goto("/calendario");
  await expect(
    page.getByRole("heading", { name: "Tu calendario" }),
  ).toBeVisible();
}

test.describe.serial("Vistas del calendario", () => {
  test("muestra la zona horaria activa y las citas del paciente", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await irAlCalendario(page);

    await expect(
      page.getByText("Hora de Bogotá", { exact: false }),
    ).toBeVisible();
    // La cita confirmada de la siembra aparece en el panel de próximas.
    await expect(page.getByText("Confirmada").first()).toBeVisible();
  });

  test("se puede cambiar de vista y la URL lo refleja", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    await irAlCalendario(page);

    await page.getByRole("link", { name: "Agenda", exact: true }).click();
    await expect(page).toHaveURL(/vista=agenda/);

    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/vista=semana/);

    await page.getByRole("link", { name: "Día", exact: true }).click();
    await expect(page).toHaveURL(/vista=dia/);
  });

  test("navegar entre periodos cambia el título y conserva la vista", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario?vista=mes");

    const titulo = page.getByRole("heading", { level: 2 }).first();
    const inicial = await titulo.textContent();

    await page.getByRole("link", { name: "Periodo siguiente" }).click();
    await expect(page).toHaveURL(/vista=mes/);
    await expect(titulo).not.toHaveText(inicial!);

    await page.getByRole("link", { name: "Hoy" }).click();
    await expect(titulo).toHaveText(inicial!);
  });
});

test.describe.serial("Solicitar una cita", () => {
  test("solicitar deja la cita como «por confirmar», no confirmada", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.otroPaciente);
    await page.goto("/calendario/solicitar");

    await page.getByLabel("Día").fill(enDias(10));
    await page.getByLabel("Hora de inicio").selectOption("11:00");
    await page.getByLabel("Modalidad").selectOption("virtual");

    await page.getByRole("button", { name: /solicitar cita/i }).click();

    await expect(page).toHaveURL(/solicitada=1/);
    await expect(page.getByText(/solicitud enviada/i)).toBeVisible();

    /*
     * Lo que de verdad se comprueba: que el paciente NO puede producir una
     * cita confirmada. Aunque la interfaz fallara, la función de Postgres crea
     * siempre en estado «solicitada».
     */
    await page.goto("/calendario?vista=agenda");
    await expect(page.getByText("Por confirmar").first()).toBeVisible();
  });

  test("no deja acumular dos solicitudes pendientes", async ({ page }) => {
    await entrarComo(page, CUENTAS.otroPaciente);
    await page.goto("/calendario/solicitar");

    await expect(
      page.getByText(/ya tienes una solicitud pendiente/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /solicitar cita/i }),
    ).toHaveCount(0);
  });

  test("la anticipación mínima se aplica en el servidor", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario/solicitar");

    // El input tiene `min`, pero la regla real vive en la base: se fuerza una
    // fecha de hoy saltándose la restricción del navegador.
    await page.getByLabel("Día").evaluate((el, valor) => {
      const input = el as HTMLInputElement;
      input.min = "";
      input.value = valor;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, enDias(0));

    await page.getByRole("button", { name: /solicitar cita/i }).click();

    await expect(page.getByText(/anticipación/i).first()).toBeVisible();
  });
});

test.describe.serial("Detalle y cancelación", () => {
  test("se puede cancelar una cita y deja de estar activa", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/calendario?vista=agenda");

    await page
      .getByRole("link", { name: /cita confirmada/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/calendario\/[0-9a-f-]{36}/);

    await page.getByRole("button", { name: /cancelar cita/i }).click();
    await page.getByRole("button", { name: /sí, cancelar la cita/i }).click();

    await expect(page).toHaveURL(/cancelada=1/);
    await expect(page.getByText(/cita cancelada/i).first()).toBeVisible();
  });

  test("una cita de otro paciente responde 404, no 403", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);

    // Identificador inexistente y ajeno se tratan igual: revelar la diferencia
    // permitiría confirmar qué citas existen en la plataforma.
    const respuesta = await page.request.get(
      "/calendario/00000000-0000-4000-8000-000000000000",
    );
    expect(respuesta.status()).toBe(404);
  });
});

test.describe("Zonas horarias", () => {
  /**
   * La prueba de mayor valor del calendario.
   *
   * Verifica el viaje completo: la hora se escribe en la zona del PERFIL, se
   * guarda en UTC y se vuelve a mostrar en la zona del perfil. Si alguna de
   * las tres etapas usara la zona del servidor o la del navegador, el
   * desplazamiento no sería el esperado — y ese error no se ve en pantalla,
   * se ve cuando alguien llega a su sesión con una hora de diferencia.
   *
   * Crea su propia cita en vez de reutilizar la de la siembra: depender de lo
   * que dejen otras pruebas es lo que la hacía fallar de forma intermitente.
   */
  test("la hora se guarda en la zona del perfil y se muestra en ella", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);

    await page.goto("/calendario/solicitar");
    await page.getByLabel("Día").fill(enDias(12));
    await page.getByLabel("Hora de inicio").selectOption("11:00");
    await page.getByRole("button", { name: /solicitar cita/i }).click();
    await expect(page).toHaveURL(/solicitada=1/);

    /*
     * Su cita, no la sesión de evaluación.
     *
     * En el calendario de la persona conviven ahora las dos, y las dos pueden
     * estar «solicitadas». El accesible de una evaluación empieza por
     * «Evaluación», así que basta con exigir que empiece por «Cita».
     */
    const cita = page.getByRole("link", { name: /^cita solicitada/i }).first();

    await page.goto("/calendario?vista=agenda");
    // Se compara el RANGO completo, no una hora suelta: «11:00» aparece
    // también como hora de fin del rango desplazado, y compararlo por separado
    // daría un falso negativo.
    await expect(cita).toContainText("11:00 – 12:00");

    await page.goto("/mis-datos");
    await page.getByLabel("Zona horaria").selectOption("America/Mexico_City");
    await guardarSeccion(page, /guardar preferencias/i);

    await page.goto("/calendario?vista=agenda");
    // Se compara con la etiqueta exacta que ve el usuario. La expresión
    // regular anterior aceptaba variantes sin tilde y por eso no detectó que la
    // cabecera decía «Bogota»; ahora una regresión de acentuación falla aquí.
    await expect(
      page.getByText("Hora de Ciudad de México", { exact: false }),
    ).toBeVisible();

    // Bogotá (GMT−5) y Ciudad de México (GMT−6) difieren exactamente una hora.
    await expect(cita).toContainText("10:00 – 11:00");

    await page.goto("/mis-datos");
    await page.getByLabel("Zona horaria").selectOption("America/Bogota");
    await guardarSeccion(page, /guardar preferencias/i);
  });
});
