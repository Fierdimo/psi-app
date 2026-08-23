import { expect, type Page } from "@playwright/test";

export async function rellenarIngreso(
  page: Page,
  { correo, contrasena }: { correo: string; contrasena: string },
) {
  await page.getByLabel("Correo electrónico").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: /entrar/i }).click();
}

/**
 * Entra y, si aparece el consentimiento, lo acepta.
 *
 * Hay que ESPERAR a que la redirección termine antes de mirar la URL. Leerla
 * justo después del clic la pilla a medio camino, y el resultado es una prueba
 * que a veces pasa y a veces no.
 */
export async function entrarComo(
  page: Page,
  cuenta: { correo: string; contrasena: string },
  puerta: "/ingresar" | "/profesional" = "/ingresar",
) {
  await page.goto(puerta);
  await rellenarIngreso(page, cuenta);

  /*
   * Cada rol aterriza en SU sitio.
   *
   * La empresa entra a `/empresa`, que no estaba contemplado aquí: el ayudante
   * se quedaba esperando una dirección que nunca iba a llegar y el fallo
   * apuntaba a la prueba en vez de a esta línea.
   */
  await page.waitForURL(
    /\/(consentimiento|condiciones|panel|empresa|profesional\/solicitudes)/,
  );

  /*
   * Cada rol tiene su puerta, y las dos se cruzan igual.
   *
   * El paciente otorga el consentimiento de atención; la empresa acepta sus
   * condiciones de uso, donde vive la obligación de custodiar los informes.
   * Las dos son bloqueantes y las dos se aceptan con el mismo botón.
   */
  if (/\/(consentimiento|condiciones)/.test(page.url())) {
    await page.getByRole("button", { name: /he leído y acepto/i }).click();
  }

  await page.waitForURL(/\/(panel|empresa|profesional\/solicitudes)/);
}

/** Envía un formulario de «Mis datos» y espera su confirmación. */
export async function guardarSeccion(page: Page, boton: RegExp) {
  await page.getByRole("button", { name: boton }).click();
  await expect(page.getByText("Listo").first()).toBeVisible();
}
