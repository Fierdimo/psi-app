import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrarComo } from "./ayudas";
import { CUENTAS } from "./preparar";

const SESION = "88888888-0000-4000-8000-0000000000aa";

/**
 * A qué hora se atiende a cada convocado.
 *
 * La hora que pide la empresa es una propuesta. Lo que se comprueba es que el
 * profesional pueda moverla en un gesto —«empiezo a las dos»— y retocar a una
 * persona suelta sin deshacer el resto.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Un martes lejano: la consulta atiende de lunes a viernes. */
function martesQueViene(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

test.describe.serial("Organizar el día", () => {
  test.beforeAll(async () => {
    const db = admin();
    await db
      .from("appointments")
      .update({ status: "solicitada" })
      .eq("id", SESION);
    await db
      .from("appointment_attendees")
      .update({ starts_at: null, ends_at: null })
      .eq("appointment_id", SESION);
  });

  test("una hora coloca a todos, y se puede retocar a uno", async ({
    page,
  }) => {
    test.setTimeout(120000);

    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto(`/profesional/citas/${SESION}`);

    await page.getByLabel("Día").fill(martesQueViene());

    const empezar = page.getByLabel(/empezar a las/i);
    await expect(empezar).toBeEnabled({ timeout: 20000 });

    /*
     * Un solo control resuelve el caso normal.
     *
     * Se elige la última hora posible menos una, para que quepan los dos
     * convocados y quede demostrado que la propuesta de la empresa no manda.
     */
    const horas = await empezar.locator("option").allTextContents();
    const elegida = horas[horas.length - 2];
    await empezar.selectOption({ label: elegida });

    // Cada persona muestra SU hora, y son seguidas.
    const filas = page.getByRole("combobox", { name: /^hora de /i });
    await expect(filas).toHaveCount(2);
    expect(await filas.first().inputValue()).not.toBe("");
    expect(await filas.nth(1).inputValue()).not.toBe("");

    await page.getByRole("button", { name: /guardar el horario/i }).click();
    await expect(
      page.getByText(/personas citadas|persona citada/i),
    ).toBeVisible({ timeout: 20000 });

    // Y queda escrito con la hora de cada uno, no con un bloque para todos.
    const db = admin();
    const { data } = await db
      .from("appointment_attendees")
      .select("starts_at")
      .eq("appointment_id", SESION);

    const horasGuardadas = (data ?? []).map((a) => a.starts_at);
    expect(horasGuardadas.filter(Boolean)).toHaveLength(2);
    expect(new Set(horasGuardadas).size).toBe(2);
  });

  test("un día que no se atiende lo dice, en vez de quedarse en blanco", async ({
    page,
  }) => {
    await entrarComo(page, CUENTAS.profesional, "/profesional");
    await page.goto(`/profesional/citas/${SESION}`);

    const sabado = new Date(martesQueViene());
    sabado.setDate(sabado.getDate() + 4);

    await page.getByLabel("Día").fill(sabado.toISOString().slice(0, 10));

    await expect(page.getByText(/ese día no atiendes/i)).toBeVisible({
      timeout: 20000,
    });
  });
});
