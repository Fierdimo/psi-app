import { expect, test } from "@playwright/test";

import { entrarComo, rellenarIngreso } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Flujos de autenticación y separación de roles (F1).
 *
 * Estas pruebas verifican las decisiones de SPEC.md §5.1 que no se pueden
 * comprobar leyendo el código: que las dos puertas llevan a donde deben, que
 * entrar por la equivocada redirige en vez de fallar, y que el consentimiento
 * bloquea de verdad.
 */

test.describe("Acceso público", () => {
  test("la landing presenta al profesional y ofrece crear cuenta", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /elena herrera/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Crear cuenta" }).first().click();
    await expect(page).toHaveURL(/\/registro/);
  });

  test("las páginas legales son accesibles sin sesión", async ({ page }) => {
    for (const ruta of [
      "/privacidad",
      "/terminos",
      "/consentimiento-informado",
    ]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("una ruta privada sin sesión lleva a la puerta del paciente", async ({
    page,
  }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/ingresar\?siguiente=%2Fpanel/);
  });

  test("una ruta del profesional sin sesión lleva a SU puerta, no a la del paciente", async ({
    page,
  }) => {
    await page.goto("/profesional/agenda");
    await expect(page).toHaveURL(/\/profesional\?siguiente=/);
  });
});

test.describe("Credenciales", () => {
  test("un correo que no existe y una contraseña mala dan el MISMO mensaje", async ({
    page,
  }) => {
    await page.goto("/ingresar");
    await rellenarIngreso(page, {
      correo: "nadie@ejemplo.test",
      contrasena: "contrasena-inventada-1",
    });
    const inexistente = await page
      .getByText(/correo o contraseña incorrectos/i)
      .textContent();

    await page.goto("/ingresar");
    await rellenarIngreso(page, {
      correo: CUENTAS.paciente.correo,
      contrasena: "contrasena-equivocada-1",
    });
    const contrasenaMala = await page
      .getByText(/correo o contraseña incorrectos/i)
      .textContent();

    // Si difirieran, el formulario serviría para averiguar qué correos tienen
    // cuenta en una consulta de psicología.
    expect(inexistente).toBe(contrasenaMala);
  });
});

test.describe.serial("Consentimiento y roles", () => {
  test("el consentimiento bloquea el acceso al panel", async ({ page }) => {
    await page.goto("/ingresar");
    await rellenarIngreso(page, CUENTAS.paciente);

    await expect(page).toHaveURL(/\/consentimiento/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /consentimiento informado/i,
      }),
    ).toBeVisible();

    // Intentar saltárselo por URL directa devuelve a la misma pantalla.
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/consentimiento/);
  });

  test("al aceptarlo se entra al panel y no vuelve a pedirse", async ({
    page,
  }) => {
    await page.goto("/ingresar");
    await rellenarIngreso(page, CUENTAS.paciente);
    await page.getByRole("button", { name: /he leído y acepto/i }).click();

    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ana");

    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel/);
  });

  test("un paciente que va al área del profesional acaba en su panel, sin error", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/profesional/agenda");

    await expect(page).toHaveURL(/\/panel/);

    // Ni una palabra sobre permisos o roles. Decir «no tienes permisos de
    // profesional» convertiría la ruta en un detector de cuentas
    // privilegiadas: bastaría probarla con cada correo para saber cuál manda.
    await expect(
      page.getByText(/no tienes permiso|acceso denegado|no autorizado/i),
    ).toHaveCount(0);
  });

  test("el profesional entra por su puerta y llega a la agenda", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await expect(page).toHaveURL(/\/profesional\/agenda/);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  });

  test("el profesional que entra por la puerta del paciente también llega a su agenda", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/ingresar");
    await expect(page).toHaveURL(/\/profesional\/agenda/);
  });

  test("cerrar sesión devuelve a la entrada y corta el acceso", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.getByRole("button", { name: /cerrar sesión/i }).click();

    await expect(page).toHaveURL(/\/ingresar/);
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/ingresar\?siguiente=/);
  });
});
