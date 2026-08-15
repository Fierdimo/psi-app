import { NextResponse, type NextRequest } from "next/server";

import { avisarAlTitular } from "@/lib/correo/avisos";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Envío de los recordatorios de cita.
 *
 * Lo invoca un proceso programado, no una persona. Quién lo programa depende
 * del hosting —`pg_cron` + `pg_net` en Supabase gestionado, un cron del sistema
 * en un VPS— y por eso la aplicación expone un endpoint en vez de depender de
 * un mecanismo concreto: cambiar de hosting no obliga a reescribir esto.
 *
 * Protegido por un secreto compartido en la cabecera `authorization`. Sin él
 * cualquiera podría provocar una tanda de correos a los pacientes.
 */
export async function POST(request: NextRequest) {
  const secreto = process.env.TAREAS_SECRETO;

  // Sin secreto configurado el endpoint queda cerrado, no abierto. Un fallo de
  // configuración no debe convertirse en una puerta sin llave.
  if (!secreto) {
    console.error("[tareas] falta TAREAS_SECRETO; endpoint deshabilitado");
    return NextResponse.json({ error: "No disponible" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = crearClienteAdmin();

  const { data: pendientes, error } = await admin.rpc("citas_para_recordar", {
    p_horas_antes: 24,
  });

  if (error) {
    console.error("[tareas] no se pudieron leer las citas", error.message);
    return NextResponse.json({ error: "Error al consultar" }, { status: 500 });
  }

  let enviados = 0;

  for (const fila of (pendientes ?? []) as { appointment_id: string }[]) {
    await avisarAlTitular(fila.appointment_id, { tipo: "recordatorio" });
    // Se marca después de enviar: si algo falla, el siguiente pase reintenta.
    await admin.rpc("marcar_recordatorio_enviado", {
      p_appointment_id: fila.appointment_id,
    });
    enviados += 1;
  }

  return NextResponse.json({ revisadas: pendientes?.length ?? 0, enviados });
}
