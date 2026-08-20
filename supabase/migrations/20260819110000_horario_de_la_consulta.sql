-- =============================================================================
-- 0035 · El horario de la consulta, y las franjas que salen de él
--
-- Hasta ahora la duración de una cita la elegía QUIEN LA PEDÍA: la empresa
-- abría el formulario y escribía dos horas, o cuarenta minutos, a su gusto. El
-- resultado es que la agenda del profesional la componían terceros, y no había
-- forma de responder a la pregunta que de verdad importa —«¿a cuánta gente
-- puedo atender el jueves?»— porque dependía de lo que cada quien hubiera
-- escrito.
--
-- Se invierte: el profesional declara su jornada y el tamaño de bloque, y de
-- ahí salen las franjas. Quien pide elige una franja existente, no inventa una.
--
-- LA PAUSA es opcional y es un hueco, no dos jornadas. Modelarla como «mañana y
-- tarde» habría obligado a duplicar cada regla; como intervalo excluido, la
-- generación de franjas la salta y no hay nada más que decir.
-- =============================================================================

alter table public.clinic_settings
  add column if not exists jornada_inicio  time not null default '08:00',
  add column if not exists jornada_fin     time not null default '17:00',
  add column if not exists pausa_inicio    time,
  add column if not exists pausa_fin       time,
  -- Días ISO: 1 lunes … 7 domingo. Por defecto, de lunes a viernes.
  add column if not exists dias_laborables smallint[] not null default '{1,2,3,4,5}';

alter table public.clinic_settings
  drop constraint if exists jornada_coherente,
  add constraint jornada_coherente check (jornada_fin > jornada_inicio);

alter table public.clinic_settings
  drop constraint if exists pausa_coherente,
  -- O no hay pausa, o tiene principio y fin, y cae DENTRO de la jornada. Una
  -- pausa a medio declarar dejaría franjas fantasma.
  add constraint pausa_coherente check (
    (pausa_inicio is null and pausa_fin is null)
    or (
      pausa_inicio is not null and pausa_fin is not null
      and pausa_fin > pausa_inicio
      and pausa_inicio >= jornada_inicio
      and pausa_fin <= jornada_fin
    )
  );

comment on column public.clinic_settings.dias_laborables is
  'Días ISO en que se atiende: 1 lunes … 7 domingo.';

comment on column public.clinic_settings.default_duration_minutes is
  'El tamaño de bloque de la agenda. Todas las franjas duran esto, y de aquí '
  'sale cuánta gente cabe en un día.';

-- -----------------------------------------------------------------------------
-- El profesional define su jornada
-- -----------------------------------------------------------------------------

create or replace function public.actualizar_horario(
  p_inicio    time,
  p_fin       time,
  p_duracion  integer,
  p_pausa_inicio time default null,
  p_pausa_fin    time default null,
  p_dias      smallint[] default '{1,2,3,4,5}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional define su horario.';
  end if;

  /*
   * El bloque tiene que dividir algo.
   *
   * Un bloque de tres horas en una jornada de dos no genera ninguna franja, y
   * la pantalla se quedaría vacía sin decir por qué. Se rechaza aquí, donde
   * todavía se puede explicar.
   */
  if p_duracion < 5 or p_duracion > 480 then
    raise exception 'La duración de un bloque va de 5 a 480 minutos.';
  end if;

  if p_dias is null or array_length(p_dias, 1) is null then
    raise exception 'Elige al menos un día de atención.'
      using hint = 'Sin días laborables no se puede agendar nada.';
  end if;

  /*
   * El `where` no es decorativo: sin él, Supabase rechaza la sentencia.
   *
   * El rol `authenticated` corre con la salvaguarda que prohíbe UPDATE sin
   * filtro —«UPDATE requires a WHERE clause»— pensada para que un descuido no
   * reescriba una tabla entera. Aquí la tabla tiene una sola fila por
   * construcción, así que la condición parece redundante y no lo es.
   *
   * No lo detectó ninguna prueba de base: ahí la sentencia corre con otro rol.
   * Se vio al pulsar el botón.
   */
  update public.clinic_settings
  set jornada_inicio = p_inicio,
      jornada_fin    = p_fin,
      default_duration_minutes = p_duracion,
      pausa_inicio   = p_pausa_inicio,
      pausa_fin      = p_pausa_fin,
      dias_laborables = p_dias
  where id;
end;
$$;

grant execute on function public.actualizar_horario(time, time, integer, time, time, smallint[])
  to authenticated;

-- -----------------------------------------------------------------------------
-- Las franjas de un día
-- -----------------------------------------------------------------------------

create or replace function public.franjas_del_dia(
  p_fecha date,
  p_zona  text default 'America/Bogota'
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

  -- Un día que la consulta no atiende no tiene franjas. Devolver las de una
  -- jornada imaginaria invitaría a agendar en domingo.
  if not (v_dia = any(v_ajustes.dias_laborables)) then
    return;
  end if;

  return query
  with rejilla as (
    /*
     * La rejilla se construye en la ZONA DE LA CONSULTA, no en UTC.
     *
     * Componer las horas en UTC y convertir después desplaza la jornada entera
     * los días de cambio de hora: la franja de las 8:00 aparecería a las 7:00.
     * Aquí no hay horario de verano, pero la zona es un ajuste y algún día
     * puede no serlo.
     */
    select gs as inicio,
           gs + make_interval(mins => v_ajustes.default_duration_minutes) as fin
    from generate_series(
      (p_fecha + v_ajustes.jornada_inicio) at time zone p_zona,
      (p_fecha + v_ajustes.jornada_fin) at time zone p_zona
        - make_interval(mins => v_ajustes.default_duration_minutes),
      make_interval(mins => v_ajustes.default_duration_minutes)
    ) as gs
  )
  select r.inicio,
         r.fin,
         exists (
           select 1 from public.appointments a
           where a.status in ('confirmada', 'realizada')
             and tstzrange(a.starts_at, a.ends_at) && tstzrange(r.inicio, r.fin)
         )
  from rejilla r
  where
    -- La pausa se salta entera: cualquier franja que la toque desaparece.
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

comment on function public.franjas_del_dia(date, text) is
  'Las franjas de un día según la jornada declarada, ya marcadas como ocupadas '
  'si se solapan con una cita en pie. Vacío si ese día no se atiende.';

grant execute on function public.franjas_del_dia(date, text) to authenticated;
