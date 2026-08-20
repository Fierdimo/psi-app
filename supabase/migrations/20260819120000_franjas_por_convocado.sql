-- =============================================================================
-- 0036 · Cada convocado tiene su franja
--
-- Una sesión de empresa era UNA cita con varios asistentes y un solo par de
-- horas para todos. Con ese modelo no hay dónde escribir lo que el cliente
-- pide: colocar a cada persona en su bloque, dejar huecos a propósito, o —el
-- caso que lo motivó— aplazar a tres del jueves al viernes por una urgencia y
-- dejar a los otros donde estaban.
--
-- La cita pasa a ser el ENCARGO —quién lo pidió, para qué, en qué estado— y la
-- hora de cada persona vive en su fila de convocados. La cita conserva un
-- inicio y un fin, pero como envoltura: se recalculan a partir de las franjas
-- para que la agenda siga sabiendo qué ocupa el día sin mirar dentro.
--
-- Las franjas nacen VACÍAS. Una solicitud recién llegada no tiene reparto
-- todavía, y fingir uno automático haría que el profesional aceptara un plan
-- que no ha visto.
-- =============================================================================

alter table public.appointment_attendees
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

alter table public.appointment_attendees
  drop constraint if exists franja_coherente,
  -- O sin franja, o completa. Media franja no se puede pintar ni respetar.
  add constraint franja_coherente check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  );

create index if not exists appointment_attendees_franja_idx
  on public.appointment_attendees (starts_at)
  where starts_at is not null;

comment on column public.appointment_attendees.starts_at is
  'La hora de ESTA persona. Nula mientras el profesional no haya organizado el '
  'día: una solicitud recién llegada no tiene reparto todavía.';

-- -----------------------------------------------------------------------------
-- Organizar el día
-- -----------------------------------------------------------------------------

create or replace function public.organizar_sesion(
  p_appointment_id uuid,
  p_reparto jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duracion integer;
  v_estado   public.appointment_status;
  v_fila     record;
  v_choques  integer;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional organiza su día.';
  end if;

  select status into v_estado
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La sesión no existe.';
  end if;

  /*
   * Se puede organizar ANTES y DESPUÉS de aceptar.
   *
   * Antes, porque el reparto es justo lo que se mira para decidir si cabe.
   * Después, porque el motivo por el que se mueve gente —una urgencia, una
   * ausencia— aparece casi siempre con la sesión ya confirmada. Lo que no se
   * organiza es lo que ya no va a ocurrir.
   */
  if v_estado in ('cancelada', 'rechazada', 'no_asistio') then
    raise exception 'Esta sesión ya no se organiza.';
  end if;

  select default_duration_minutes into v_duracion from public.clinic_settings;

  -- Se limpia el reparto anterior: lo que llega es el plan completo, no un
  -- parche. Así, quitarle la franja a alguien es mandarlo sin hora, y no hace
  -- falta una operación aparte para borrar.
  update public.appointment_attendees
  set starts_at = null, ends_at = null
  where appointment_id = p_appointment_id;

  for v_fila in
    select (x->>'persona')::uuid as persona,
           (x->>'inicio')::timestamptz as inicio
    from jsonb_array_elements(coalesce(p_reparto, '[]'::jsonb)) as x
  loop
    if v_fila.inicio is null then
      continue;
    end if;

    update public.appointment_attendees
    set starts_at = v_fila.inicio,
        ends_at   = v_fila.inicio + make_interval(mins => v_duracion)
    where appointment_id = p_appointment_id
      and person_id = v_fila.persona;

    if not found then
      raise exception 'Esa persona no está convocada a esta sesión.';
    end if;
  end loop;

  /*
   * Dos personas no pueden ocupar la misma franja.
   *
   * El profesional atiende de uno en uno: es la premisa de la que sale la
   * cuenta de «cuánta gente cabe en un día». Se comprueba al final y no dentro
   * del bucle porque el plan llega entero y el orden en que venga no importa.
   */
  select count(*) into v_choques
  from public.appointment_attendees a
  join public.appointment_attendees b
    on a.appointment_id = b.appointment_id
   and a.person_id < b.person_id
   and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)
  where a.appointment_id = p_appointment_id
    and a.starts_at is not null
    and b.starts_at is not null;

  if v_choques > 0 then
    raise exception 'Hay % personas puestas a la misma hora.', v_choques + 1
      using hint = 'Atiendes de una en una: cada bloque admite a una persona.';
  end if;

  /*
   * La envoltura de la cita se recalcula.
   *
   * La agenda, los recordatorios y la comprobación de solapamiento miran
   * `appointments.starts_at`. Si el reparto se sale del día original —porque se
   * aplazó a alguien— y la envoltura no se mueve, la cita aparecería en el
   * calendario un día y la gente se presentaría otro.
   *
   * Sin nadie colocado, se deja como estaba: es una solicitud sin organizar,
   * no una cita sin hora.
   */
  update public.appointments a
  set starts_at = coalesce(f.desde, a.starts_at),
      ends_at   = coalesce(f.hasta, a.ends_at),
      updated_at = now()
  from (
    select min(starts_at) as desde, max(ends_at) as hasta
    from public.appointment_attendees
    where appointment_id = p_appointment_id and starts_at is not null
  ) f
  where a.id = p_appointment_id;
end;
$$;

comment on function public.organizar_sesion(uuid, jsonb) is
  'Coloca a cada convocado en su franja. Recibe el plan completo: quien no '
  'aparezca queda sin hora. Recalcula la envoltura de la cita.';

grant execute on function public.organizar_sesion(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- El reparto, para pintarlo
-- -----------------------------------------------------------------------------

create or replace function public.reparto_de_sesion(p_appointment_id uuid)
returns table (
  person_id uuid,
  nombre    text,
  apellidos text,
  documento text,
  starts_at timestamptz,
  ends_at   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_mia uuid := public.mi_organizacion();
begin
  select organization_id into v_org
  from public.appointments where id = p_appointment_id;

  if v_org is null then
    raise exception 'Esta sesión no es de una empresa.';
  end if;

  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esta sesión no es tuya.';
  end if;

  return query
  select op.id, op.nombre, op.apellidos, op.documento, aa.starts_at, aa.ends_at
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  where aa.appointment_id = p_appointment_id
  -- Los que ya tienen hora, en orden; los que no, al final por nombre. Quien
  -- organiza necesita ver de un vistazo a quién le falta sitio.
  order by aa.starts_at nulls last, op.nombre, op.apellidos;
end;
$$;

grant execute on function public.reparto_de_sesion(uuid) to authenticated;
