import { expect, test } from "@playwright/test";

import { entrarComo, guardarSeccion } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Área privada del paciente y «Mis datos» (F2).
 */

test.describe.serial("Navegación privada", () => {
  test("todas las secciones del mapa son alcanzables", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);

    const secciones: [string, RegExp][] = [
      ["/calendario", /tu calendario/i],
      ["/resultados", /resultados de evaluaciones/i],
      ["/sesiones", /mis sesiones/i],
      ["/recursos", /recursos y tareas/i],
      ["/documentos", /documentos/i],
      ["/mis-datos", /mis datos/i],
    ];

    for (const [ruta, titulo] of secciones) {
      await page.goto(ruta);
      await expect(
        page.getByRole("heading", { level: 1, name: titulo }),
      ).toBeVisible();
    }
  });

  test("las secciones sin contenido explican qué vivirá ahí", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/recursos");

    await expect(page.getByText(/próximamente/i).first()).toBeVisible();
    // Nunca una fecha estimada: una promesa incumplida cuesta más que la ausencia.
    await expect(
      page.getByText(/\b(20\d{2}|enero|febrero|marzo)\b/i),
    ).toHaveCount(0);
  });
});

test.describe.serial("Mis datos", () => {
  test("los datos personales se guardan y persisten al recargar", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/mis-datos");

    await page.getByLabel("Nombre", { exact: true }).fill("Ana María");
    await page.getByLabel(/^Teléfono/).fill("+57 300 555 4433");
    await guardarSeccion(page, /guardar cambios/i);

    await page.reload();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
      "Ana María",
    );
    await expect(page.getByLabel(/^Teléfono/)).toHaveValue("+57 300 555 4433");
  });

  test("la zona horaria se guarda", async ({ page }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/mis-datos");

    await page.getByLabel("Zona horaria").selectOption("America/Mexico_City");
    await guardarSeccion(page, /guardar preferencias/i);

    await page.reload();
    await expect(page.getByLabel("Zona horaria")).toHaveValue(
      "America/Mexico_City",
    );

    // Se deja como estaba para no arrastrar estado a otras pruebas.
    await page.getByLabel("Zona horaria").selectOption("America/Bogota");
    await guardarSeccion(page, /guardar preferencias/i);
  });

  test("un teléfono inválido se rechaza con mensaje bajo el campo", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);
    await page.goto("/mis-datos");

    await page.getByLabel(/^Teléfono/).fill("abc");
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(page.getByText(/no es válido|solo admite/i)).toBeVisible();
  });
});

test.describe("Derechos sobre los datos", () => {
  test("la exportación entrega los datos propios y NINGUNO ajeno", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.paciente);

    const respuesta = await page.request.get("/mis-datos/exportar");
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-disposition"]).toContain("attachment");
    // Una copia de datos personales no debe quedar en ninguna caché.
    expect(respuesta.headers()["cache-control"]).toContain("no-store");

    const datos = await respuesta.json();
    expect(datos.cuenta.correo).toBe(CUENTAS.paciente.correo);
    expect(datos.perfil).not.toBeNull();

    /*
     * La comprobación que importa: el export usa el cliente del usuario, así
     * que RLS decide qué sale. Ana tiene dos citas en la siembra y Beto una.
     * Si aquí apareciera la de Beto, el fallo sería una fuga de datos clínicos.
     */
    expect(Array.isArray(datos.citas)).toBe(true);
    for (const cita of datos.citas) {
      expect(cita.patient_id).toBe(datos.cuenta.id);
    }
  });

  test("la solicitud de eliminación se registra y no se puede repetir", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.otroPaciente);
    await page.goto("/mis-datos");

    await page
      .getByRole("button", { name: /solicitar eliminación de mi cuenta/i })
      .click();

    // Sin la confirmación escrita no se envía nada.
    await page.getByRole("button", { name: /enviar solicitud/i }).click();

    /*
     * Hay que esperar al MENSAJE DE ERROR, no a la etiqueta del campo: la
     * etiqueta ya está en pantalla desde el principio, así que esperarla no
     * espera nada. Y esperar importa porque React reinicia el formulario
     * cuando la acción termina; escribir antes de ese reinicio borra el texto
     * y el segundo envío sale vacío.
     */
    await expect(
      page.getByRole("alert").filter({ hasText: /en mayúsculas/i }),
    ).toBeVisible();

    await page.getByLabel(/escribe eliminar/i).fill("ELIMINAR");
    await page.getByRole("button", { name: /enviar solicitud/i }).click();

    await expect(
      page.getByText(/solicitud de eliminación registrada/i),
    ).toBeVisible();

    // Al volver ya no se ofrece pedirlo otra vez: el trámite está abierto.
    await page.reload();
    await expect(
      page.getByRole("button", { name: /solicitar eliminación/i }),
    ).toHaveCount(0);
  });
});
