-- =============================================================================
-- 0052 · Una sesión de empresa ocupa donde está su gente, no su envoltura
--
-- HALLAZGO AL CABLEAR «confirmar guarda el horario»: no se podía confirmar una
-- sesión repartida en varios días. Y el motivo no era nuevo.
--
-- `sin_solapamiento` (migración 0002) prohíbe que dos citas confirmadas del
-- profesional se solapen, comparando `tstzrange(starts_at, ends_at)`. Para una
-- cita individual eso es exactamente la ocupación. Para una sesión de empresa
-- es su ENVOLTURA: el primero y el último de la tanda, con todos los huecos
-- intermedios dentro.
--
-- Lo que eso impedía, comprobado contra la base:
--
--   · Dos empresas el mismo día. La 0040 dice haberlo habilitado —y arregló
--     `franjas_del_dia`, que es lo que se PINTA— pero la escritura seguía
--     rechazándose: la pantalla ofrecía el hueco y guardar fallaba.
--   · Cualquier cita individual dentro del bloque de una sesión, aunque cayera
--     en un hueco dejado a propósito.
--   · Y desde que una tanda se reparte en días, la envoltura va de lunes a
--     miércoles: confirmarla bloqueaba tres días enteros de agenda, o fallaba
--     contra lo que ya hubiera dentro.
--
-- LA REGLA DE VERDAD, la que nadie discute, es que el profesional atiende de
-- uno en uno. Para una cita individual la ocupa su rango; para una sesión de
-- empresa, la hora de CADA convocado. Es la misma corrección que la 0040 hizo
-- en la lectura, aplicada por fin a la escritura.
--
-- LO QUE SE PIERDE, dicho claro: entre citas individuales sigue habiendo una
-- restricción de exclusión, que es a prueba de carreras. Lo que involucra a una
-- sesión de empresa se comprueba dentro de las funciones, y ahí hay una ventana
-- entre la consulta y la escritura. Cerrarla del todo pide una restricción
-- sobre `appointment_attendees`, y esa tabla no sabe de qué estado está su
-- cita: los convocados de una sesión cancelada bloquearían horas que están
-- libres. Con un solo profesional escribiendo su propia agenda, la ventana es
-- teórica; el bloqueo que se quita era diario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La exclusión, solo entre citas individuales
-- -----------------------------------------------------------------------------

alter table public.appointments
  drop constraint if exists sin_solapamiento;

alter table public.appointments
  add constraint sin_solapamiento
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (
    status in ('confirmada', 'realizada')
    -- Una sesión de empresa no ocupa su envoltura. Ver la cabecera.
    and organization_id is null
  );

comment on constraint sin_solapamiento on public.appointments is
  'Dos citas individuales confirmadas no se solapan. Las de empresa quedan '
  'fuera a propósito: lo que ocupan es la hora de cada convocado, y eso vive '
  'en appointment_attendees.';

-- -----------------------------------------------------------------------------
-- Quién ocupa qué, en un solo sitio
--
-- Tres funciones necesitan la misma respuesta —«¿hay alguien a esta hora?»— y
-- escrita tres veces son tres sitios donde corregirla la próxima vez.
-- -----------------------------------------------------------------------------

create or replace function public.hay_ocupacion(
  p_desde   timestamptz,
  p_hasta   timestamptz,
  /** La cita que pregunta, para no chocar consigo misma. */
  p_excepto uuid default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- Devuelve CON QUIÉN choca, o nulo si está libre. El nombre importa: «hay un
  -- conflicto» obliga a buscarlo a mano entre doce filas.
  select quien from (
    -- Citas individuales: ocupan su rango entero.
    select coalesce(nullif(trim(p.nombre || ' ' || coalesce(p.apellidos, '')), ''),
                    -- Sin nombre en el perfil: se dice que hay alguien, no
                    -- quién. «Atiendes a otra cita» no es castellano.
                    'otra persona') as quien
    from public.appointments a
    left join public.profiles p on p.id = a.patient_id
    where a.status in ('confirmada', 'realizada')
      and a.organization_id is null
      and (p_excepto is null or a.id <> p_excepto)
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_desde, p_hasta)

    union all

    -- Sesiones de empresa: ocupa la hora de cada convocado, no el bloque.
    select op.nombre
    from public.appointment_attendees aa
    join public.appointments a on a.id = aa.appointment_id
    join public.organization_people op on op.id = aa.person_id
    where a.status in ('confirmada', 'realizada')
      and aa.starts_at is not null
      and (p_excepto is null or a.id <> p_excepto)
      and tstzrange(aa.starts_at, aa.ends_at) && tstzrange(p_desde, p_hasta)
  ) t
  limit 1;
$$;

comment on function public.hay_ocupacion(timestamptz, timestamptz, uuid) is
  'Con quién choca un tramo, o nulo si está libre. Mide la ocupación donde de '
  'verdad está: el rango en las citas individuales, la hora de cada persona en '
  'las sesiones de empresa.';

grant execute on function public.hay_ocupacion(timestamptz, timestamptz, uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Al repartir: también contra las citas individuales
--
-- La comprobación de `organizar_sesion` miraba a los convocados de otras
-- sesiones y se olvidaba de las citas de una persona. Mientras la restricción
-- de exclusión cubría la envoltura eso no se notaba; ahora es el único control
-- que queda, así que tiene que mirar las dos cosas.
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
   * Y contra el resto de la agenda: otras sesiones Y citas individuales.
   *
   * Se dice quién de los MÍOS choca y con quién, porque con doce filas «hay un
   * conflicto» deja el trabajo de encontrarlo a quien lo lee.
   */
  select op.nombre as mio, o.quien as ajeno
  into v_ajeno
  from public.appointment_attendees mia
  join public.organization_people op on op.id = mia.person_id
  -- En lateral y no dos veces en la consulta: se pregunta una vez por persona.
  cross join lateral public.hay_ocupacion(
    mia.starts_at, mia.ends_at, p_appointment_id
  ) as o(quien)
  where mia.appointment_id = p_appointment_id
    and mia.starts_at is not null
    and o.quien is not null
  limit 1;

  if v_ajeno.mio is not null then
    raise exception '% coincide con %, que ya está confirmada.',
      v_ajeno.mio, v_ajeno.ajeno
      using hint = 'Ese bloque está ocupado. Elige otra hora para esa persona.';
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

grant execute on function public.organizar_sesion(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Y al crear o confirmar una cita individual, que no caiga sobre un convocado
--
-- La restricción ya no ve las sesiones de empresa, así que este es el control
-- que queda en el otro sentido. `franjas_del_dia` ya no ofrecía esos bloques;
-- esto impide llegar por otra puerta.
-- -----------------------------------------------------------------------------

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
  v_id    uuid;
  v_quien text;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede agendar directamente.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
  end if;

  v_quien := public.hay_ocupacion(p_starts_at, p_ends_at);

  if v_quien is not null then
    raise exception 'A esa hora ya atiendes a %.', v_quien
      using hint = 'Elige otro bloque.';
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

grant execute on function public.agendar_cita(uuid, timestamptz, timestamptz, public.appointment_modality, text) to authenticated;

create or replace function public.confirmar_cita(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado   public.appointment_status;
  v_inicio   timestamptz;
  v_fin      timestamptz;
  v_prop_ini timestamptz;
  v_prop_fin timestamptz;
  v_org      uuid;
  v_quien    text;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede confirmar citas.';
  end if;

  select status, starts_at, ends_at, proposed_starts_at, proposed_ends_at,
         organization_id
  into v_estado, v_inicio, v_fin, v_prop_ini, v_prop_fin, v_org
  from public.appointments
  where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_estado not in ('solicitada', 'reprogramacion_solicitada') then
    raise exception 'Solo se confirma una cita solicitada o con cambio pedido.';
  end if;

  -- Al confirmar una reprogramación, la fecha que cuenta es la propuesta.
  if coalesce(v_prop_ini, v_inicio) <= now() then
    raise exception 'Esa fecha ya pasó; no se puede confirmar.'
      using hint = 'Acuerda una fecha nueva con reagendar_solicitud y confirma después.';
  end if;

  /*
   * Solo para las individuales.
   *
   * En una sesión de empresa, el rango es la envoltura de la tanda y sus
   * huecos son de otros a propósito: comprobarlo aquí rechazaría justo el caso
   * que la 0040 vino a permitir. Lo suyo ya lo valida `organizar_sesion`,
   * persona a persona, antes de llegar aquí.
   */
  if v_org is null then
    v_quien := public.hay_ocupacion(
      coalesce(v_prop_ini, v_inicio),
      coalesce(v_prop_fin, v_fin),
      p_appointment_id
    );

    if v_quien is not null then
      raise exception 'A esa hora ya atiendes a %.', v_quien
        using hint = 'Pide otro horario antes de confirmar.';
    end if;
  end if;

  update public.appointments
  set starts_at = coalesce(v_prop_ini, starts_at),
      ends_at   = coalesce(v_prop_fin, ends_at),
      proposed_starts_at = null,
      proposed_ends_at = null,
      status = 'confirmada'
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(p_appointment_id, v_estado, 'confirmada', null);

  /*
   * Los pases se preparan aquí, y esto NO es enviar correos.
   *
   * La distinción de siempre se mantiene: confirmar acepta la sesión, emitir
   * avisa a la gente. Lo que cambia es que ahora los accesos ya existen cuando
   * alguien va a buscarlos, en vez de fabricarse al mirarlos.
   */
  perform public.preparar_invitaciones(p_appointment_id);
end;
$$;

grant execute on function public.confirmar_cita(uuid) to authenticated;
