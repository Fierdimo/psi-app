import { NextResponse } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Derecho de acceso: descarga de todos los datos propios (SPEC.md §7.5).
 *
 * Se consulta con el cliente del usuario, no con la clave de servicio. Así RLS
 * decide qué sale: si una política estuviera mal, el export mostraría de menos,
 * nunca de más. Con la clave de servicio un fallo de filtro exportaría datos
 * ajenos, que es la peor manera posible de fallar en esta funcionalidad.
 */
export async function GET() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const [perfil, citas, cambios, consentimientos] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("appointments").select("*").order("starts_at"),
    supabase.from("appointment_changes").select("*").order("created_at"),
    supabase.from("consents").select("*").order("accepted_at"),
  ]);

  const exportacion = {
    generado_en: new Date().toISOString(),
    aviso:
      "Copia de los datos que la plataforma guarda sobre ti. No incluye las notas clínicas de tu profesional, que no se almacenan aquí y están protegidas por el secreto profesional.",
    cuenta: {
      id: user.id,
      correo: user.email,
      creada_en: user.created_at,
      correo_confirmado_en: user.email_confirmed_at ?? null,
      ultimo_ingreso: user.last_sign_in_at ?? null,
    },
    perfil: perfil.data ?? null,
    // Las dos clases se separan a propósito. RLS devuelve tanto las citas
    // propias como las sesiones de evaluación a las que una empresa convocó a
    // esta persona: las dos son suyas y las dos deben aparecer, pero
    // mezclarlas en una sola lista haría creer que pidió una consulta cuando
    // en realidad la mandó evaluar su empresa.
    citas: (citas.data ?? []).filter((c) => c.organization_id === null),
    sesiones_de_evaluacion: (citas.data ?? []).filter(
      (c) => c.organization_id !== null,
    ),
    historial_de_citas: cambios.data ?? [],
    consentimientos: consentimientos.data ?? [],
  };

  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(exportacion, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mis-datos-${fecha}.json"`,
      // Una copia de datos personales no debe quedar en ninguna caché.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
