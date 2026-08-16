import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * El área de la empresa: listar, corregir y convocar.
 *
 * Hasta ahora una empresa solo podía AÑADIR: ni corregir un documento mal
 * escrito, ni quitar a quien se cargó por error, ni cambiar una solicitud
 * antes de que el profesional la respondiera. Un listado que solo crece no se
 * puede mantener.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const ORGANIZACION = "77777777-7777-7777-7777-777777777777";

test.describe.serial("Área de empresa", () => {
  test.beforeAll(async () => {
    // Doce personas más: con dos, el problema que el buscador resuelve no se
    // reproduce.
    const db = admin();
    await db.from("organization_people").delete().like("documento", "90000%");

    await db.from("organization_people").insert(
      Array.from({ length: 12 }, (_, i) => ({
        organization_id: ORGANIZACION,
        documento: `90000${String(i + 10)}`,
        nombre: "Persona",
        apellidos: `Número ${i + 1}`,
        email: `p${i + 1}@caribe.test`,
        cargo: "Operario",
        vinculo: "aspirante" as const,
      })),
    );
  });

  test("el listado es un listado: cargar abre un panel", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    // El formulario ya no vive incrustado encima de la tabla.
    await expect(page.getByLabel("Documento de identidad")).toHaveCount(0);

    await page.getByRole("link", { name: /cargar persona/i }).click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Documento de identidad")).toBeVisible();
  });

  test("se corrige a alguien del listado", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    await page
      .getByRole("link", { name: /^editar$/i })
      .nth(2)
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Cargo al que aspira").fill("Auxiliar de patio");
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(page).toHaveURL(/guardada=1/);
    await expect(page.getByText("Auxiliar de patio")).toBeVisible();
  });

  test("y se retira a quien se cargó por error", async ({ page }) => {
    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/personas");

    await page
      .getByRole("link", { name: /^editar$/i })
      .nth(3)
      .click();
    await page.getByRole("button", { name: /quitar del listado/i }).click();

    await expect(page).toHaveURL(/retirada=1/);
  });

  test("convocar se hace buscando, no recorriendo la lista", async ({
    page,
  }) => {
    /*
     * Con su propia persona, y no una de las de arriba: las pruebas anteriores
     * de este bloque retiran a alguien, y buscar un documento que otra prueba
     * pudo borrar hace fallar esta por un motivo que no es el suyo.
     */
    const db = admin();
    await db.from("organization_people").delete().eq("documento", "77712345");
    await db.from("organization_people").insert({
      organization_id: ORGANIZACION,
      documento: "77712345",
      nombre: "Rosalía",
      apellidos: "Buscada",
      email: "rosalia@caribe.test",
      cargo: "Almacén",
      vinculo: "aspirante",
    });

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/sesiones/nueva");

    /*
     * Con catorce personas, la lista de casillas obligaba a recorrerlas con la
     * vista. Se busca por documento porque es lo que distingue a dos que se
     * llaman igual.
     */
    await page.getByLabel("Buscar personas").fill("77712345");

    const opciones = page.locator("fieldset ul li button");
    await expect(opciones).toHaveCount(1);

    await opciones.first().click();

    // Lo elegido queda arriba y visible, con su aspa para quitarlo.
    await expect(page.getByText(/1 de \d+/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /quitar de la convocatoria/i }),
    ).toBeVisible();
  });

  test("con cien personas el formulario sigue cabiendo", async ({ page }) => {
    /*
     * El caso real es «encargo cien exámenes».
     *
     * Con la lista completa desplegada la pantalla era una lista de nombres y
     * el botón de enviar quedaba fuera; y elegirlas de una en una son cien
     * clics. Se comprueban las dos cosas: que se añaden en bloque y que lo
     * elegido no empuja la acción fuera de la vista.
     */
    const db = admin();
    await db.from("organization_people").delete().like("documento", "700000%");

    await db.from("organization_people").insert(
      Array.from({ length: 60 }, (_, i) => ({
        organization_id: ORGANIZACION,
        documento: `700000${String(i).padStart(3, "0")}`,
        nombre: "Aspirante",
        apellidos: `Número ${i + 1}`,
        email: `a${i}@caribe.test`,
        cargo: "Operario",
        vinculo: "aspirante" as const,
      })),
    );

    await entrarComo(page, CUENTAS.empresa);
    await page.goto("/empresa/sesiones/nueva");

    // Los resultados están acotados: no se pintan sesenta filas.
    await expect(page.locator("fieldset ul li")).toHaveCount(8);

    await page.getByRole("button", { name: /^añadir \d+ personas$/i }).click();

    await expect(page.getByText(/Convocadas \(\d+\)/)).toBeVisible();

    // Y lo que importa: la acción sigue alcanzable sin desplazarse.
    await expect(
      page.getByRole("button", { name: /enviar solicitud/i }),
    ).toBeInViewport();
  });
});
