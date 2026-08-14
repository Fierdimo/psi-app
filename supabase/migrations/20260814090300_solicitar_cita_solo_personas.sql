-- =============================================================================
-- 0011 · `solicitar_cita` es para personas, no para cuentas de empresa
--
-- Hallazgo de la auditoría que siguió al agujero de `cancelar_cita`.
--
-- `solicitar_cita` nunca miró quién la llamaba: insertaba `patient_id = auth.uid()`
-- y punto. Con la llegada de las cuentas de empresa eso deja de ser inocuo,
-- porque una cuenta de empresa puede pedirse a sí misma una cita individual.
--
-- No filtra datos de nadie, así que no es un agujero de confidencialidad. Es
-- de integridad, y de los que se notan tarde: la cita aparecería en la agenda
-- del profesional con un «paciente» que NO figura en su listado de pacientes,
-- porque ese listado filtra por `role = 'paciente'`. Una cita de alguien que
-- no existe como paciente.
--
-- La regla, entonces: la cuenta de empresa gestiona evaluaciones; no pide
-- consultas individuales. Quien quiera atención personal usa una cuenta
-- personal — y si además fue evaluado por una empresa, esa misma cuenta le
-- sirve, que es justo lo que se ganó al no inventar un rol de empleado.
-- =============================================================================

create or replace function public.solicitar_cita(
  p_starts_at timestamptz,
  p_ends_at   timestamptz,
  p_modality  public.appointment_modality default 'presencial',
  p_note      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_profesional  uuid := public.el_profesional();
  v_rol          public.user_role;
  v_min_notice   integer;
  v_id           uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para solicitar una cita.';
  end if;

  select role into v_rol from public.profiles where id = v_uid;

  if v_rol = 'empresa' then
    raise exception 'Una cuenta de empresa no solicita consultas individuales.'
      using hint = 'Para evaluar a tu personal, solicita una cita de evaluación.';
  end if;

  if v_profesional is null then
    raise exception 'No hay un profesional configurado en la plataforma.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
  end if;

  select min_notice_hours into v_min_notice from public.clinic_settings;

  if p_starts_at < now() + make_interval(hours => v_min_notice) then
    raise exception 'Las citas deben solicitarse con al menos % horas de anticipación.', v_min_notice
      using hint = 'Elige un horario más adelante o comunícate directamente con la consulta.';
  end if;

  -- El estado inicial es SIEMPRE 'solicitada'. No existe ningún parámetro que
  -- permita a un paciente crear algo ya confirmado.
  insert into public.appointments (
    patient_id, professional_id, starts_at, ends_at, modality, patient_note,
    status, created_by
  ) values (
    v_uid, v_profesional, p_starts_at, p_ends_at, p_modality, nullif(p_note, ''),
    'solicitada', v_uid
  )
  returning id into v_id;

  perform public.registrar_cambio_cita(v_id, null, 'solicitada', null);
  return v_id;

exception
  when unique_violation then
    raise exception 'Ya tienes una solicitud pendiente de confirmación.'
      using hint = 'Espera la respuesta del profesional o retira la solicitud anterior.';
end;
$$;

revoke execute on function public.solicitar_cita(timestamptz, timestamptz, public.appointment_modality, text) from public;
grant  execute on function public.solicitar_cita(timestamptz, timestamptz, public.appointment_modality, text) to authenticated;
