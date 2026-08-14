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
      page.getByRole("heading", { level: 1, name: /banquez/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Crear cuenta" }).first().click();
    await expect(page).toHaveURL(/\/registro/);
  });

  /*
   * La landing tiene que LEERSE sin JavaScript.
   *
   * Esto no es purismo: cuando la entrada se animaba desde JavaScript, el
   * contenido se servía en `opacity: 0` y bastaba con que el guion no llegara
   * a ejecutarse —al enseñar el sitio por un túnel de desarrollo— para que la
   * página apareciera EN BLANCO con todo el texto dentro del HTML. La suite no
   * lo detectó porque el navegador de las pruebas siempre ejecuta el guion.
   */
  test.describe("sin JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("la landing se lee entera", async ({ page }) => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", { level: 1, name: /banquez/i }),
      ).toBeVisible();
      // Una de cada banda, incluida la última, que es la que más lejos queda
      // del pliegue y la primera en desaparecer si algo vuelve a esconderse.
      await expect(
        page.getByText(/Me destaco por hacer las cosas/),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Hablemos de lo que necesitas/ }),
      ).toBeVisible();

      // La entrada es una animación CSS con `fill-mode: backwards`: mientras
      // corre su retraso, el bloque sigue en el primer fotograma y por tanto
      // en opacidad 0. Eso es correcto —termina visible—, así que lo que hay
      // que comprobar es el estado FINAL, no un instante intermedio.
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished)),
      );

      const invisibles = await page.locator("main *").evaluateAll(
        (els) =>
          els.filter((el) => {
            const opacidad = Number.parseFloat(getComputedStyle(el).opacity);
            return opacidad < 0.1 && (el.textContent ?? "").trim().length > 20;
          }).length,
      );
      expect(invisibles).toBe(0);
    });
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
    // Cuenta reservada: ver la nota en preparar.ts.
    await rellenarIngreso(page, CUENTAS.sinConsentimiento);

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
    await rellenarIngreso(page, CUENTAS.sinConsentimiento);
    await page.getByRole("button", { name: /he leído y acepto/i }).click();

    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Carmen",
    );

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

  /*
   * El consentimiento informado lo otorga el paciente AL profesional. Pedírselo
   * al profesional es pedirle que se autorice a sí mismo, y durante un tiempo
   * la plataforma se lo pidió: la puerta se aplicaba a todos los roles.
   */
  test("al profesional NO se le pide el consentimiento informado", async ({
    page,
  }) => {
    await page.goto("/profesional");
    await rellenarIngreso(page, CUENTAS.profesional);
    await page.waitForURL(/\/profesional\/agenda/);

    // Ni de camino, ni entrando a la pantalla a propósito.
    await page.goto("/consentimiento");
    await expect(page).toHaveURL(/\/profesional\/agenda/);
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
