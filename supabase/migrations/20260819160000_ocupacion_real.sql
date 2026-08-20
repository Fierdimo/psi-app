-- =============================================================================
-- 0040 · Qué está ocupado de verdad
--
-- `franjas_del_dia` marcaba ocupada una franja si se solapaba con el rango de
-- una CITA. Eso era cierto cuando una sesión de empresa ocupaba un bloque
-- macizo, y dejó de serlo en cuanto cada convocado tiene su propia hora:
--
--   · Una sesión de 8 a 12 con tres personas a las 8, 9 y 11 marcaba ocupado
--     también las 10 —un hueco dejado a propósito—, así que otra empresa no
--     podía entrar ahí. La agenda se bloqueaba sola.
--   · Y al organizar una sesión, sus propias personas marcaban sus franjas
--     como ocupadas, de modo que mover a alguien de las 9 a las 10 era
--     imposible: las 10 parecían tomadas por él mismo.
--
-- Ahora la ocupación se mide donde de verdad está: la hora de cada persona
-- para las sesiones de empresa, y el rango de la cita para las individuales,
-- que no tienen convocados.
--
-- VARIAS EMPRESAS EL MISMO DÍA es el caso que esto habilita. Antes, la primera
-- sesión confirmada se comía el día entero aunque solo usara tres bloques.
-- =============================================================================

/*
 * La versión anterior se retira, no se reemplaza.
 *
 * `create or replace` no puede cambiar la lista de parámetros: dejaría las dos
 * conviviendo, y como ambas tienen valores por defecto, llamar con un solo
 * argumento pasa a ser ambiguo y Postgres lo rechaza. El error habla de
 * «función no única» y no de la migración que lo causó.
 */
drop function if exists public.franjas_del_dia(date, text);

create or replace function public.franjas_del_dia(
  p_fecha  date,
  p_zona   text default 'America/Bogota',
  p_excepto uuid default null
)
returns table (inicio timestamptz, fin timestamptz, ocupada boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ajustes record;
  v_dia     smallint;
begin
  select * into v_ajustes from public.clinic_settings;

  v_dia := extract(isodow from p_fecha)::smallint;

  if not (v_dia = any(v_ajustes.dias_laborables)) then
    return;
  end if;

  return query
  with rejilla as (
    select gs as inicio,
           gs + make_interval(mins => v_ajustes.default_duration_minutes) as fin
    from generate_series(
      (p_fecha + v_ajustes.jornada_inicio) at time zone p_zona,
      (p_fecha + v_ajustes.jornada_fin) at time zone p_zona
        - make_interval(mins => v_ajustes.default_duration_minutes),
      make_interval(mins => v_ajustes.default_duration_minutes)
    ) as gs
  ),
  /*
   * Lo que de verdad ocupa la agenda.
   *
   * Se excluye la sesión que se está organizando: si no, las horas de sus
   * propios convocados salen tomadas y no hay forma de moverlos.
   */
  ocupado as (
    -- Citas individuales: no tienen convocados, así que ocupan su rango.
    select a.starts_at as desde, a.ends_at as hasta
    from public.appointments a
    where a.status in ('confirmada', 'realizada')
      and a.organization_id is null
      and (p_excepto is null or a.id <> p_excepto)

    union all

    -- Sesiones de empresa: ocupa la hora de CADA persona, no el bloque entero.
    select aa.starts_at, aa.ends_at
    from public.appointment_attendees aa
    join public.appointments a on a.id = aa.appointment_id
    where a.status in ('confirmada', 'realizada')
      and aa.starts_at is not null
      and (p_excepto is null or a.id <> p_excepto)
  )
  select r.inicio,
         r.fin,
         exists (
           select 1 from ocupado o
           where tstzrange(o.desde, o.hasta) && tstzrange(r.inicio, r.fin)
         )
  from rejilla r
  where
    v_ajustes.pausa_inicio is null
    or not (
      tstzrange(r.inicio, r.fin)
      && tstzrange(
           (p_fecha + v_ajustes.pausa_inicio) at time zone p_zona,
           (p_fecha + v_ajustes.pausa_fin) at time zone p_zona
         )
    )
  order by r.inicio;
end;
$$;

comment on function public.franjas_del_dia(date, text, uuid) is
  'Las franjas de un día. Ocupadas según la hora de cada persona, no según el '
  'rango de la cita: así dos empresas caben el mismo día y los huecos que se '
  'dejan a propósito siguen siendo huecos.';

grant execute on function public.franjas_del_dia(date, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Y dos personas no pueden coincidir AUNQUE SEAN DE SESIONES DISTINTAS
--
-- `organizar_sesion` comprobaba los choques dentro de la misma sesión. Con dos
-- empresas el mismo día, el choque que importa es el de la agenda entera: el
-- profesional atiende de uno en uno, venga cada quien de donde venga.
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
  v_ajeno    record;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional organiza su día.';
  end if;

  select status into v_estado
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La sesión no existe.';
  end if;

  if v_estado in ('cancelada', 'rechazada', 'no_asistio') then
    raise exception 'Esta sesión ya no se organiza.';
  end if;

  select default_duration_minutes into v_duracion from public.clinic_settings;

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

  -- Dentro de la sesión.
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
   * Y contra el resto de la agenda.
   *
   * Con dos empresas el mismo día, el choque que importa ya no es el de dentro
   * de la sesión. Se dice CON QUIÉN choca y a qué hora, porque «hay un
   * conflicto» obliga a buscarlo a mano entre doce filas.
   */
  select op.nombre, aa.starts_at into v_ajeno
  from public.appointment_attendees mia
  join public.appointment_attendees aa
    on aa.appointment_id <> mia.appointment_id
   and aa.starts_at is not null
   and tstzrange(mia.starts_at, mia.ends_at) && tstzrange(aa.starts_at, aa.ends_at)
  join public.appointments otra on otra.id = aa.appointment_id
   and otra.status in ('confirmada', 'realizada')
  join public.organization_people op on op.id = mia.person_id
  where mia.appointment_id = p_appointment_id
    and mia.starts_at is not null
  limit 1;

  if v_ajeno.nombre is not null then
    raise exception '% coincide con otra cita ya confirmada.', v_ajeno.nombre
      using hint = 'Ese bloque está ocupado por otra sesión. Elige otra hora.';
  end if;

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
