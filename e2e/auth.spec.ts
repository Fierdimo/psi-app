import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo, rellenarIngreso } from "./ayudas";
import { CUENTAS } from "./preparar";

const MAILPIT = "http://127.0.0.1:54324";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Flujos de autenticación y separación de roles (F1).
 *
 * Estas pruebas verifican las decisiones de SPEC.md §5.1 que no se pueden
 * comprobar leyendo el código: que las dos puertas llevan a donde deben, que
 * entrar por la equivocada redirige en vez de fallar, y que el consentimiento
 * bloquea de verdad.
 */

test.describe("Acceso público", () => {
  test("la landing dice a qué viene y empuja a crear cuenta", async ({
    page,
  }) => {
    await page.goto("/");

    /*
     * El titular es lo que se ofrece, no quién lo firma.
     *
     * Antes encabezaba el nombre del profesional: una tarjeta de presentación
     * donde hacía falta una propuesta. Su nombre sigue en la página, debajo,
     * que es donde se lee cuando ya interesa lo que hay.
     */
    await expect(
      page.getByRole("heading", { level: 1, name: /evaluación psicotécnica/i }),
    ).toBeVisible();
    await expect(page.getByText(/Banquez/).first()).toBeVisible();

    await page
      .getByRole("link", { name: /crear cuenta de empresa/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/registro/);
  });

  test("la entrada de quien ya tiene cuenta está, y es discreta", async ({
    page,
  }) => {
    await page.goto("/");

    // Un enlace, no un botón: no compite con la acción que la página busca.
    const entrar = page.getByRole("link", { name: "Entrar" }).first();
    await expect(entrar).toBeVisible();
    await entrar.click();
    await expect(page).toHaveURL(/\/ingresar/);
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
        page.getByRole("heading", {
          level: 1,
          name: /evaluación psicotécnica/i,
        }),
      ).toBeVisible();
      // Una de cada banda, incluida la última, que es la que más lejos queda
      // del pliegue y la primera en desaparecer si algo vuelve a esconderse.
      await expect(
        page.getByText(/Lo que resuelvo para tu empresa/),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Cuéntame qué necesitas evaluar/ }),
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

test.describe("Registro", () => {
  /*
   * EL ALTA PÚBLICA ES SOLO DE EMPRESAS, y esta prueba existe para fijarlo.
   *
   * Estas dos comprobaciones eran del registro de un paciente: que exigía
   * documento de identidad, y que un documento repetido no se revelaba. Ese
   * formulario ya no existe — quien responde una evaluación no llega a tener
   * cuenta, así que no hay ninguna identidad que reconocer ni que proteger.
   */
  test("el registro pide los datos de una empresa, no los de una persona", async ({
    page,
  }) => {
    await page.goto("/registro");

    await expect(
      page.getByRole("heading", { name: /crear cuenta de empresa/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/para organizaciones que contratan evaluaciones/i),
    ).toBeVisible();

    await expect(page.getByLabel(/nombre de la empresa/i)).toBeVisible();

    // Y lo que era la identidad del paciente ya no se pide.
    await expect(page.getByLabel(/documento de identidad/i)).toHaveCount(0);
  });

  test("sin nombre de empresa no se crea la cuenta", async ({ page }) => {
    await page.goto("/registro");

    await page.getByLabel("Nombre", { exact: true }).fill("Sin");
    await page.getByLabel("Apellidos").fill("Empresa");
    await page
      .getByLabel("Correo electrónico")
      .fill("sin.empresa@ejemplo.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("psi-local-2026");
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    await expect(
      page.getByText(/escribe el nombre de la empresa/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/registro/);
  });

  /*
   * Un correo ya registrado NO se confirma como tal, ni aquí ni en el ingreso:
   * decirlo convertiría el registro en un detector de clientes de una consulta
   * de psicología. Y además no se puede distinguir aunque se quisiera — el
   * servidor de autenticación devuelve siempre el mismo error.
   */
  /*
   * EL REGISTRO COMPLETO, hasta ver qué cuenta quedó.
   *
   * Las demás comprueban el formulario; esta comprueba el RESULTADO, que es lo
   * único que responde de verdad a «¿solo se pueden crear cuentas de empresa?».
   * Recorre la verificación de correo entera porque la cuenta no existe del
   * todo hasta que se confirma.
   */
  test("registrarse crea una cuenta de empresa, con su organización", async ({
    page,
  }) => {
    const marca = Date.now();
    const correo = `alta-${marca}@ejemplo.test`;
    const nombreEmpresa = `Empresa De Prueba ${marca}`;

    await page.goto("/registro");
    await page.getByLabel(/nombre de la empresa/i).fill(nombreEmpresa);
    await page.getByLabel(/^NIT/).fill("900123456-7");
    await page.getByLabel("Nombre", { exact: true }).fill("Quien");
    await page.getByLabel("Apellidos").fill("Administra");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel("Contraseña", { exact: true }).fill("psi-local-2026");
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    await page.waitForURL(/\/verificar-correo/);

    /*
     * El enlace de confirmación, del buzón de desarrollo.
     *
     * Sin recorrerlo la cuenta se queda sin confirmar y no se puede comprobar
     * dónde aterriza, que es la mitad de lo que esta prueba afirma.
     */
    const enlace = await expect
      .poll(
        async () => {
          const r = await fetch(
            `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`,
          );
          const { messages } = await r.json();
          if (!messages?.length) return null;

          const detalle = await fetch(
            `${MAILPIT}/api/v1/message/${messages[0].ID}`,
          ).then((x) => x.json());

          return (
            (detalle.Text ?? detalle.HTML ?? "").match(
              /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/,
            )?.[0] ?? null
          );
        },
        { timeout: 20_000 },
      )
      .not.toBeNull()
      .then(async () => {
        const r = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`,
        );
        const { messages } = await r.json();
        const detalle = await fetch(
          `${MAILPIT}/api/v1/message/${messages[0].ID}`,
        ).then((x) => x.json());
        return (detalle.Text ?? detalle.HTML ?? "").match(
          /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/,
        )![0];
      });

    await page.goto(enlace.replace(/&amp;/g, "&"));

    /*
     * Aterriza en las condiciones de uso: es una cuenta de empresa y todavía
     * no las ha aceptado. Que llegue ahí y no al panel del paciente es la
     * afirmación.
     */
    await page.waitForURL(/\/(condiciones|empresa)/);

    const db = admin();
    const { data: cuenta } = await db
      .from("profiles")
      .select("id, role, organization_id, organizacion:organizations(nombre)")
      .eq("nombre", "Quien")
      .eq("apellidos", "Administra")
      .maybeSingle();

    expect(cuenta?.role).toBe("empresa");
    expect(cuenta?.organization_id).not.toBeNull();

    const org = Array.isArray(cuenta?.organizacion)
      ? cuenta?.organizacion[0]
      : cuenta?.organizacion;
    expect(org?.nombre).toBe(nombreEmpresa);

    // Se recoge, para que la siguiente ejecución encuentre la casa como la
    // dejó la siembra.
    await db.auth.admin.deleteUser(cuenta!.id);
    await db.from("organizations").delete().eq("id", cuenta!.organization_id!);
  });

  test("un correo ya registrado no se revela", async ({ page }) => {
    await page.goto("/registro");

    await page.getByLabel(/nombre de la empresa/i).fill("Otra Empresa S.A.S");
    await page.getByLabel("Nombre", { exact: true }).fill("Otra");
    await page.getByLabel("Apellidos").fill("Persona");
    // El correo de la empresa de la siembra, que ya tiene cuenta.
    await page.getByLabel("Correo electrónico").fill("empresa@psi.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("psi-local-2026");
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    /*
     * Con verificación de correo activada, Supabase responde igual exista o no
     * la cuenta, así que lo esperado es la pantalla de «revisa tu correo». Lo
     * que esta prueba fija es que NO aparezca nada que confirme la existencia.
     */
    await expect(page.getByText(/ya existe una cuenta/i)).toHaveCount(0);
    await expect(page.getByText(/correo ya registrado/i)).toHaveCount(0);
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
