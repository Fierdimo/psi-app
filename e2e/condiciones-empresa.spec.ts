import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { rellenarIngreso } from "./ayudas";
import { CUENTAS } from "./preparar";

/**
 * Las condiciones que acepta una empresa, y por qué son bloqueantes.
 *
 * El consentimiento de la persona evaluada le dice que la empresa se obliga a
 * custodiar su informe. Un documento entre la persona y la consulta no puede
 * obligar a un tercero, así que esa obligación se crea aquí o no existe — y la
 * frase de aquel documento sería falsa.
 *
 * De ahí que la puerta sea bloqueante y no una casilla al pie de nada: lo que
 * se acepta incluye responder de un dato sensible de alguien que no está en la
 * sala.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("sin aceptar las condiciones, la empresa no entra a su área", async ({
  page,
}) => {
  const db = admin();

  const { data: cuenta } = await db
    .from("profiles")
    .select("id")
    .eq("role", "empresa")
    .limit(1)
    .single();

  // Punto de partida: como si acabara de registrarse.
  await db
    .from("consents")
    .delete()
    .eq("user_id", cuenta!.id)
    .eq("document_key", "condiciones_empresa");

  await page.goto("/ingresar");
  await rellenarIngreso(page, CUENTAS.empresa);

  await page.waitForURL(/\/condiciones/);
  await expect(
    page.getByRole("heading", { name: /condiciones de uso/i }),
  ).toBeVisible();

  /*
   * La obligación, repetida encima del botón.
   *
   * No basta con que esté cuarenta líneas más arriba: se acepta donde se
   * pulsa, y es lo único de este documento que compromete a la empresa con
   * alguien que no es ella.
   */
  const aceptar = page.locator("form").filter({
    has: page.getByRole("button", { name: /he leído y acepto/i }),
  });
  await expect(aceptar.getByText(/respondes de él/i)).toBeVisible();

  // Y no se puede rodear escribiendo la dirección.
  await page.goto("/empresa/evaluaciones");
  await expect(page).toHaveURL(/\/condiciones/);

  await page.getByRole("button", { name: /he leído y acepto/i }).click();
  await page.waitForURL(/\/empresa/);

  // Queda la evidencia, con su versión: un booleano no sirve para demostrar
  // qué redacción se aceptó.
  const { data: aceptacion } = await db
    .from("consents")
    .select("version, accepted_at")
    .eq("user_id", cuenta!.id)
    .eq("document_key", "condiciones_empresa")
    .maybeSingle();

  expect(aceptacion?.version).toBeTruthy();
  expect(aceptacion?.accepted_at).toBeTruthy();

  // Y aceptadas, no vuelve a preguntar.
  await page.goto("/empresa/evaluaciones");
  await expect(page).toHaveURL(/\/empresa\/evaluaciones/);
});
