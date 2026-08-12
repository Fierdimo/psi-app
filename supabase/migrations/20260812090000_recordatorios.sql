-- =============================================================================
-- 0007 · Recordatorios de cita
--
-- PLAN.md §8 · SPEC.md §7.5 (preferencia `recordatorios_email`)
--
-- El aviso 24 h antes es lo que evita la mayoría de las ausencias. Aquí vive
-- la parte que SÍ es portable: qué citas toca recordar y cómo no repetirse.
-- Quién dispara el proceso depende del hosting y se conecta al desplegar
-- (ver README): `pg_cron` + `pg_net` en Supabase gestionado, o un cron del
-- sistema llamando al mismo endpoint en un VPS.
-- =============================================================================

alter table public.appointments
  add column reminder_sent_at timestamptz;

comment on column public.appointments.reminder_sent_at is
  'Cuándo se envió el recordatorio. Marcarlo es lo que impide enviarlo dos veces.';

-- -----------------------------------------------------------------------------
-- Citas que toca recordar.
--
-- Condiciones, todas necesarias:
--   · confirmada (no se recuerda algo que aún no es un compromiso),
--   · empieza dentro de la ventana de aviso y todavía no ha empezado,
--   · el paciente no ha desactivado los recordatorios,
--   · no se ha enviado ya.
--
-- Devuelve solo identificadores: el contenido del correo lo compone la
-- aplicación, que es donde vive el formato de fecha por zona horaria.
-- -----------------------------------------------------------------------------
create or replace function public.citas_para_recordar(
  p_horas_antes integer default 24
)
returns table (appointment_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.appointments a
  join public.profiles p on p.id = a.patient_id
  where a.status = 'confirmada'
    and a.reminder_sent_at is null
    and p.recordatorios_email
    and a.starts_at > now()
    and a.starts_at <= now() + make_interval(hours => p_horas_antes)
  order by a.starts_at;
$$;

-- Marca el envío. Se llama después de enviar, no antes: si el correo falla, el
-- siguiente pase lo reintenta en vez de darlo por hecho.
create or replace function public.marcar_recordatorio_enviado(p_appointment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.appointments
  set reminder_sent_at = now()
  where id = p_appointment_id and reminder_sent_at is null;
$$;

-- Ninguna de las dos se expone a sesiones de usuario: las invoca el proceso
-- programado con la clave de servicio.
revoke execute on function public.citas_para_recordar(integer) from public, authenticated;
revoke execute on function public.marcar_recordatorio_enviado(uuid) from public, authenticated;
grant execute on function public.citas_para_recordar(integer) to service_role;
grant execute on function public.marcar_recordatorio_enviado(uuid) to service_role;
