-- =============================================================================
-- 0004 · Funciones de transición de estado de una cita
--
-- PLAN.md §6.2
--
-- Las citas NO se modifican con UPDATE directo: las políticas de RLS solo
-- conceden SELECT. Toda transición pasa por estas funciones, que en una sola
-- transacción:
--
--   1. verifican quién llama y con qué rol,
--   2. validan que la transición sea legal desde el estado actual,
--   3. aplican el cambio,
--   4. escriben el historial y la auditoría.
--
-- Consecuencia: un estado inválido no es un bug posible. Es un error de la
-- base de datos. Y la auditoría no depende de que nadie se acuerde de
-- registrarla, porque ocurre en la misma transacción que el cambio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Parámetros de la consulta.
--
-- Fila única. El margen de anticipación y la política de cancelación son
-- decisiones del profesional que aún están abiertas (SPEC.md §9.3), así que
-- viven en datos y no incrustadas en el código.
-- -----------------------------------------------------------------------------
create table public.clinic_settings (
  id                       boolean primary key default true,
  min_notice_hours         integer not null default 24,
  default_duration_minutes integer not null default 60,
  cancellation_policy      text,

  constraint fila_unica check (id)
);

insert into public.clinic_settings (id) values (true);

alter table public.clinic_settings enable row level security;

create policy "cualquiera autenticado lee los parametros"
  on public.clinic_settings for select
  to authenticated
  using (true);

grant select on public.clinic_settings to authenticated;

-- -----------------------------------------------------------------------------
-- En v1 hay un solo profesional. Esta función es el punto único que habrá que
-- cambiar cuando deje de ser cierto — mucho mejor que descubrir el supuesto
-- disperso por seis funciones.
-- -----------------------------------------------------------------------------
create or replace function public.el_profesional()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where role = 'profesional' order by created_at limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Registro conjunto de historial y auditoría.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_cambio_cita(
  p_appointment_id uuid,
  p_from           public.appointment_status,
  p_to             public.appointment_status,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.appointment_changes (
    appointment_id, from_status, to_status, actor_id, reason
  ) values (
    p_appointment_id, p_from, p_to, (select auth.uid()), p_reason
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (
    (select auth.uid()),
    'cita.' || p_to::text,
    'appointment',
    p_appointment_id::text,
    jsonb_build_object('from', p_from, 'to', p_to, 'reason', p_reason)
  );
end;
$$;

revoke execute on function public.registrar_cambio_cita(uuid, public.appointment_status, public.appointment_status, text) from public;

-- =============================================================================
-- PACIENTE
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
  v_min_notice   integer;
  v_id           uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para solicitar una cita.';
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

create or replace function public.solicitar_reprogramacion(
  p_appointment_id uuid,
  p_starts_at      timestamptz,
  p_ends_at        timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estado public.appointment_status;
begin
  select status into v_estado
  from public.appointments
  where id = p_appointment_id and patient_id = v_uid;

  if v_estado is null then
    raise exception 'La cita no existe o no es tuya.';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'Solo puedes pedir un cambio sobre una cita confirmada.';
  end if;

  update public.appointments
  set status = 'reprogramacion_solicitada',
      proposed_starts_at = p_starts_at,
      proposed_ends_at = p_ends_at
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(
    p_appointment_id, v_estado, 'reprogramacion_solicitada', null
  );
end;
$$;

create or replace function public.cancelar_cita(
  p_appointment_id uuid,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_estado    public.appointment_status;
  v_es_propia boolean;
begin
  select status, (patient_id = v_uid)
  into v_estado, v_es_propia
  from public.appointments
  where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  -- Cancelar lo puede hacer el dueño de la cita o el profesional.
  if not v_es_propia and not public.is_professional() then
    raise exception 'No puedes cancelar una cita que no es tuya.';
  end if;

  if v_estado in ('cancelada', 'rechazada', 'realizada', 'no_asistio') then
    raise exception 'Esta cita ya está cerrada y no puede cancelarse.';
  end if;

  update public.appointments
  set status = 'cancelada',
      proposed_starts_at = null,
      proposed_ends_at = null
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(p_appointment_id, v_estado, 'cancelada', p_reason);
end;
$$;

-- =============================================================================
-- PROFESIONAL
--
-- Estas cuatro funciones son la razón de que la asimetría del producto sea
-- real: solo ellas llevan una cita a 'confirmada', y todas empiezan
-- verificando el rol.
-- =============================================================================

create or replace function public.confirmar_cita(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado   public.appointment_status;
  v_prop_ini timestamptz;
  v_prop_fin timestamptz;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede confirmar citas.';
  end if;

  select status, proposed_starts_at, proposed_ends_at
  into v_estado, v_prop_ini, v_prop_fin
  from public.appointments
  where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_estado not in ('solicitada', 'reprogramacion_solicitada') then
    raise exception 'Solo se confirma una cita solicitada o con cambio pedido.';
  end if;

  -- Al confirmar una reprogramación, la propuesta pasa a ser la cita.
  update public.appointments
  set starts_at = coalesce(v_prop_ini, starts_at),
      ends_at   = coalesce(v_prop_fin, ends_at),
      proposed_starts_at = null,
      proposed_ends_at = null,
      status = 'confirmada'
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(p_appointment_id, v_estado, 'confirmada', null);
end;
$$;

create or replace function public.rechazar_cita(
  p_appointment_id uuid,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede rechazar solicitudes.';
  end if;

  select status into v_estado from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_estado not in ('solicitada', 'reprogramacion_solicitada') then
    raise exception 'Solo se rechaza una solicitud pendiente.';
  end if;

  update public.appointments
  set status = 'rechazada', proposed_starts_at = null, proposed_ends_at = null
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(p_appointment_id, v_estado, 'rechazada', p_reason);
end;
$$;

create or replace function public.agendar_cita(
  p_patient_id uuid,
  p_starts_at  timestamptz,
  p_ends_at    timestamptz,
  p_modality   public.appointment_modality default 'presencial',
  p_location   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede agendar directamente.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
  end if;

  -- El profesional sí crea citas ya confirmadas: es quien autoriza.
  insert into public.appointments (
    patient_id, professional_id, starts_at, ends_at, modality, location,
    status, created_by
  ) values (
    p_patient_id, public.el_profesional(), p_starts_at, p_ends_at, p_modality,
    nullif(p_location, ''), 'confirmada', (select auth.uid())
  )
  returning id into v_id;

  perform public.registrar_cambio_cita(v_id, null, 'confirmada', null);
  return v_id;
end;
$$;

create or replace function public.cerrar_cita(
  p_appointment_id uuid,
  p_asistio        boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_nuevo  public.appointment_status;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede cerrar una cita.';
  end if;

  select status into v_estado from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'Solo se cierra una cita confirmada.';
  end if;

  v_nuevo := case when p_asistio then 'realizada' else 'no_asistio' end;

  update public.appointments set status = v_nuevo where id = p_appointment_id;
  perform public.registrar_cambio_cita(p_appointment_id, v_estado, v_nuevo, null);
end;
$$;

-- =============================================================================
-- Permisos de ejecución.
--
-- Se revoca de `public` (que incluye a los anónimos) y se concede solo a
-- sesiones autenticadas. El control de rol lo hace cada función por dentro.
-- =============================================================================
revoke execute on function public.solicitar_cita(timestamptz, timestamptz, public.appointment_modality, text) from public;
revoke execute on function public.solicitar_reprogramacion(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.cancelar_cita(uuid, text) from public;
revoke execute on function public.confirmar_cita(uuid) from public;
revoke execute on function public.rechazar_cita(uuid, text) from public;
revoke execute on function public.agendar_cita(uuid, timestamptz, timestamptz, public.appointment_modality, text) from public;
revoke execute on function public.cerrar_cita(uuid, boolean) from public;

grant execute on function public.solicitar_cita(timestamptz, timestamptz, public.appointment_modality, text) to authenticated;
grant execute on function public.solicitar_reprogramacion(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancelar_cita(uuid, text) to authenticated;
grant execute on function public.confirmar_cita(uuid) to authenticated;
grant execute on function public.rechazar_cita(uuid, text) to authenticated;
grant execute on function public.agendar_cita(uuid, timestamptz, timestamptz, public.appointment_modality, text) to authenticated;
grant execute on function public.cerrar_cita(uuid, boolean) to authenticated;
