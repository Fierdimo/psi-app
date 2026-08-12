import { createClient } from "@supabase/supabase-js";

/**
 * Deja la base en un punto de partida conocido antes de cada ejecución.
 *
 * Concretamente borra los consentimientos de las cuentas de prueba: sin esto,
 * la primera ejecución verificaría que el consentimiento bloquea y la segunda
 * fallaría, porque Ana ya lo habría aceptado. Una prueba que solo pasa la
 * primera vez no es una prueba.
 *
 * Solo toca las tres cuentas ficticias de la siembra.
 */
export const CUENTAS = {
  paciente: { correo: "ana@psi.test", contrasena: "psi-local-2026" },
  otroPaciente: { correo: "beto@psi.test", contrasena: "psi-local-2026" },
  profesional: { correo: "profesional@psi.test", contrasena: "psi-local-2026" },
} as const;

const IDS_DE_PRUEBA = [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
  "33333333-3333-3333-3333-333333333333",
];

export default async function preparar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
        "Arranca la base con `pnpm db:start` y copia las claves a .env.local.",
    );
  }

  const admin = createClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /*
   * Espera a que la base responda.
   *
   * `supabase db reset` reinicia los contenedores, así que lanzar las pruebas
   * justo después las hace fallar en bloque por un motivo que no tiene nada
   * que ver con el código. Reintentar aquí evita perseguir fantasmas.
   */
  for (let intento = 1; ; intento++) {
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (!error) break;

    // Un error de permisos no se arregla esperando: significa que falta un
    // GRANT en seed.sql. Reintentarlo 30 veces solo retrasa el diagnóstico.
    if (error.code === "42501" || error.message.includes("permission denied")) {
      throw new Error(
        `El rol de servicio no puede leer profiles: ${error.message}. ` +
          "Revisa los GRANT de supabase/seed.sql.",
      );
    }

    if (intento >= 30) {
      throw new Error(
        `La base no respondió tras 30 intentos: ${error.message}. ` +
          "¿Está levantada? `pnpm db:start`",
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const limpiezas = await Promise.all([
    admin.from("consents").delete().in("user_id", IDS_DE_PRUEBA),
    admin
      .from("account_deletion_requests")
      .delete()
      .in("user_id", IDS_DE_PRUEBA),
    // Las pruebas de «Mis datos» editan nombre, teléfono y zona horaria.
    admin
      .from("profiles")
      .update({ timezone: "America/Bogota", recordatorios_email: true })
      .in("id", IDS_DE_PRUEBA),
    // Las del calendario crean, cancelan y reprograman citas.
    admin.from("appointments").delete().in("patient_id", IDS_DE_PRUEBA),
  ]);

  for (const { error } of limpiezas) {
    if (error) {
      throw new Error(`No se pudo preparar la base: ${error.message}`);
    }
  }

  const { error: errorCitas } = await admin.from("appointments").insert(
    CITAS_DE_PRUEBA.map((cita) => ({
      ...cita,
      professional_id: PROFESIONAL,
      created_by: cita.created_by ?? PROFESIONAL,
    })),
  );

  if (errorCitas) {
    throw new Error(`No se pudieron sembrar citas: ${errorCitas.message}`);
  }
}

const PROFESIONAL = "33333333-3333-3333-3333-333333333333";
const ANA = "11111111-1111-1111-1111-111111111111";

/** Instante fijo relativo a ahora, para que las citas nunca «caduquen». */
function enDias(dias: number, horaUTC: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  d.setUTCHours(horaUTC, 0, 0, 0);
  return d.toISOString();
}

/**
 * Citas de partida.
 *
 * Ana tiene una confirmada futura y una realizada pasada. Beto no tiene
 * ninguna, para que las pruebas que crean solicitudes empiecen de cero.
 */
export const CITAS_DE_PRUEBA = [
  {
    patient_id: ANA,
    starts_at: enDias(6, 15),
    ends_at: enDias(6, 16),
    modality: "presencial" as const,
    location: "Consultorio 402, Av. Principal 1234",
    status: "confirmada" as const,
    created_by: PROFESIONAL,
  },
  {
    patient_id: ANA,
    starts_at: enDias(-7, 15),
    ends_at: enDias(-7, 16),
    modality: "presencial" as const,
    location: "Consultorio 402, Av. Principal 1234",
    status: "realizada" as const,
    created_by: PROFESIONAL,
  },
];
