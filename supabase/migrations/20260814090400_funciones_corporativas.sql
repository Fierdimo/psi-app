-- =============================================================================
-- 0012 · Escrituras del circuito corporativo
--
-- SPEC.md §9.2 · PLAN.md §5.4
--
-- Cierra el circuito en la base: la empresa carga su gente, pide una sesión y
-- convoca; el profesional confirma y cierra registrando quién asistió.
--
-- Como todo el módulo de citas, ninguna transición se hace con UPDATE directo.
-- Y como enseñó el agujero de 0010, toda comparación que pueda tocar un NULL
-- se escribe para que su resultado sea verdadero o falso, nunca desconocido.
-- =============================================================================

-- Asistencia por persona. Nula mientras la sesión no se ha cerrado: no es que
-- no viniera, es que todavía no se sabe. Los tres estados son distintos y
-- confundirlos sería reportarle a la empresa una ausencia que nadie comprobó.
alter table public.appointment_attendees
  add column attended boolean;

comment on column public.appointment_attendees.attended is
  'null = sesión sin cerrar todavía. true/false = asistió o no.';

-- -----------------------------------------------------------------------------
-- Quién soy, en versión corporativa.
-- -----------------------------------------------------------------------------
create or replace function public.soy_empresa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'empresa'
      and organization_id is not null
  );
$$;

-- =============================================================================
-- LA EMPRESA CARGA SU GENTE
--
-- En bloque y no de una en una: el caso real son cien personas, y cien
-- llamadas separadas serían cien viajes de red y cien transacciones para algo
-- que es un solo acto.
-- =============================================================================
create or replace function public.cargar_personas(p_personas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.mi_organizacion();
  v_persona  jsonb;
  v_doc      text;
  v_email    text;
  v_cuantas  integer := 0;
begin
  if not public.soy_empresa() then
    raise exception 'Solo una cuenta de empresa puede cargar personal.';
  end if;

  if jsonb_typeof(p_personas) <> 'array' then
    raise exception 'Se esperaba una lista de personas.';
  end if;

  for v_persona in select * from jsonb_array_elements(p_personas)
  loop
    v_doc   := btrim(coalesce(v_persona ->> 'documento', ''));
    v_email := btrim(coalesce(v_persona ->> 'email', ''));

    if v_doc = '' then
      raise exception 'Cada persona necesita su documento de identidad.'
        using hint = 'Es lo que permite reconocerla si otra empresa ya la evaluó.';
    end if;

    if v_email = '' then
      raise exception 'Falta el correo de %, y sin él no se le puede invitar.', v_doc;
    end if;

    -- Volver a cargar el listado ACTUALIZA, no duplica ni falla. Una empresa
    -- que sube su nómina corregida no debería tener que borrar nada primero.
    insert into public.organization_people
      (organization_id, documento, nombre, apellidos, email, cargo)
    values (
      v_org, v_doc,
      btrim(coalesce(v_persona ->> 'nombre', '')),
      nullif(btrim(coalesce(v_persona ->> 'apellidos', '')), ''),
      v_email,
      nullif(btrim(coalesce(v_persona ->> 'cargo', '')), '')
    )
    on conflict (organization_id, documento) do update
      set nombre    = excluded.nombre,
          apellidos = excluded.apellidos,
          email     = excluded.email,
          cargo     = excluded.cargo;

    v_cuantas := v_cuantas + 1;
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), 'personal.cargado', 'organization', v_org::text,
          jsonb_build_object('cuantas', v_cuantas));

  return v_cuantas;
end;
$$;

-- =============================================================================
-- LA EMPRESA PIDE UNA SESIÓN DE EVALUACIÓN
--
-- Nace 'solicitada', como todo. Entre esto y la confirmación hay un trámite
-- —el pago— que ocurre fuera de la plataforma (SPEC §9.2), y por eso una
-- empresa no existe sin canal de contacto.
-- =============================================================================
create or replace function public.solicitar_cita_evaluacion(
  p_starts_at timestamptz,
  p_ends_at   timestamptz,
  p_personas  uuid[],
  p_nota      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org         uuid := public.mi_organizacion();
  v_profesional uuid := public.el_profesional();
  v_min_notice  integer;
  v_ajenas      integer;
  v_id          uuid;
begin
  if not public.soy_empresa() then
    raise exception 'Solo una cuenta de empresa puede solicitar una evaluación.';
  end if;

  if v_profesional is null then
    raise exception 'No hay un profesional configurado en la plataforma.';
  end if;

  if p_personas is null or array_length(p_personas, 1) is null then
    raise exception 'Hay que convocar al menos a una persona.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
  end if;

  select min_notice_hours into v_min_notice from public.clinic_settings;

  if p_starts_at < now() + make_interval(hours => v_min_notice) then
    raise exception 'Las citas deben solicitarse con al menos % horas de anticipación.', v_min_notice;
  end if;

  -- Nadie convoca a gente de otra empresa. Se comprueba contando las que NO
  -- son suyas en vez de confiar en que el cliente mandó lo correcto.
  select count(*) into v_ajenas
  from unnest(p_personas) as pedida(id)
  where not exists (
    select 1 from public.organization_people op
    where op.id = pedida.id and op.organization_id = v_org
  );

  if v_ajenas > 0 then
    raise exception 'Hay % persona(s) que no pertenecen a tu listado.', v_ajenas;
  end if;

  insert into public.appointments (
    organization_id, professional_id, starts_at, ends_at, modality,
    patient_note, status, created_by
  ) values (
    v_org, v_profesional, p_starts_at, p_ends_at, 'presencial',
    nullif(btrim(coalesce(p_nota, '')), ''), 'solicitada', (select auth.uid())
  )
  returning id into v_id;

  insert into public.appointment_attendees (appointment_id, person_id)
  select v_id, unnest(p_personas)
  on conflict do nothing;

  perform public.registrar_cambio_cita(v_id, null, 'solicitada', null);
  return v_id;
end;
$$;

-- =============================================================================
-- LA EMPRESA PIDE CAMBIAR LA FECHA
--
-- Hueco detectado en la auditoría: `solicitar_reprogramacion` solo entendía
-- citas individuales. Con cien personas convocadas, mover una sesión es lo que
-- más va a pasar.
-- =============================================================================
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
  v_uid     uuid := (select auth.uid());
  v_estado  public.appointment_status;
  v_patient uuid;
  v_org     uuid;
  v_puede   boolean;
begin
  select status, patient_id, organization_id
  into v_estado, v_patient, v_org
  from public.appointments
  where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe o no es tuya.';
  end if;

  -- Mismo cuidado que en `cancelar_cita`: cada rama devuelve verdadero o
  -- falso, nunca NULL.
  v_puede :=
        (v_patient is not null and v_patient is not distinct from v_uid)
     or (v_org is not null and v_org is not distinct from public.mi_organizacion());

  if not v_puede then
    raise exception 'La cita no existe o no es tuya.';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'Solo puedes pedir un cambio sobre una cita confirmada.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
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

-- =============================================================================
-- EL PROFESIONAL CIERRA LA SESIÓN, PERSONA POR PERSONA
--
-- El otro hueco de la auditoría: `cerrar_cita` recibe un único booleano, y en
-- una sesión de quince la asistencia es de cada una. Cerrar en bloque perdería
-- quién faltó, que es justo lo que hay que reportarle a la empresa.
-- =============================================================================
create or replace function public.cerrar_cita_evaluacion(
  p_appointment_id uuid,
  p_asistieron     uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
  v_nuevo  public.appointment_status;
  v_alguno boolean;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede cerrar una cita.';
  end if;

  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_org is null then
    raise exception 'Esta es una cita individual; ciérrala con cerrar_cita.';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'Solo se cierra una cita confirmada.';
  end if;

  update public.appointment_attendees
  set attended = (person_id = any(coalesce(p_asistieron, '{}'::uuid[])))
  where appointment_id = p_appointment_id;

  select exists (
    select 1 from public.appointment_attendees
    where appointment_id = p_appointment_id and attended
  ) into v_alguno;

  -- La sesión se dio si vino alguien. Que falten personas no la anula: las
  -- que sí vinieron respondieron, y su informe se produce igual.
  v_nuevo := case when v_alguno then 'realizada' else 'no_asistio' end;

  update public.appointments set status = v_nuevo where id = p_appointment_id;
  perform public.registrar_cambio_cita(p_appointment_id, v_estado, v_nuevo, null);
end;
$$;

-- `cerrar_cita` deja de aceptar citas de grupo: cerrarlas por ahí borraría la
-- asistencia individual sin avisar.
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
  v_org    uuid;
  v_nuevo  public.appointment_status;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede cerrar una cita.';
  end if;

  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_org is not null then
    raise exception 'Esta es una sesión de grupo; ciérrala con cerrar_cita_evaluacion.'
      using hint = 'La asistencia se registra persona por persona.';
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
-- Permisos
-- =============================================================================
revoke execute on function public.cargar_personas(jsonb) from public;
revoke execute on function public.solicitar_cita_evaluacion(timestamptz, timestamptz, uuid[], text) from public;
revoke execute on function public.solicitar_reprogramacion(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.cerrar_cita_evaluacion(uuid, uuid[]) from public;
revoke execute on function public.cerrar_cita(uuid, boolean) from public;

grant execute on function public.cargar_personas(jsonb) to authenticated;
grant execute on function public.solicitar_cita_evaluacion(timestamptz, timestamptz, uuid[], text) to authenticated;
grant execute on function public.solicitar_reprogramacion(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.cerrar_cita_evaluacion(uuid, uuid[]) to authenticated;
grant execute on function public.cerrar_cita(uuid, boolean) to authenticated;
