-- =============================================================================
-- 0032 · Los pases existen desde que la sesión se confirma
--
-- Hasta ahora había un botón «Generar pases» porque el testigo solo existía en
-- claro el instante de emitirlo: en la base quedaba su hash y de ahí no se
-- volvía. Eso convertía cada consulta en un acto —y en testigos nuevos cada
-- vez, montones de invitaciones vivas para la misma persona.
--
-- SE REVIERTE ESA DECISIÓN, y conviene decir exactamente qué se pierde.
--
-- Antes: quien leyera la tabla —una copia de seguridad mal guardada, una
-- consulta de soporte— no podía entrar como nadie. Ahora sí puede, mientras la
-- invitación siga pendiente.
--
-- Lo que inclina la balanza es qué más hay en esta base. Aquí viven historias
-- clínicas, respuestas de pruebas psicológicas e informes de personas
-- identificadas. Quien consiga volcarla no necesita el testigo de nadie: ya
-- tiene lo que el testigo protegía. El hash defendía la puerta de una casa
-- cuyas paredes son de cristal.
--
-- A cambio se acota lo que se puede:
--
--   · El testigo se BORRA al aceptarse. Solo existen en claro los de las
--     invitaciones pendientes, que son las que aún no han servido para nada.
--   · Sigue caducando: treinta días tras la sesión.
--   · Solo se guarda para quien no tiene cuenta. Quien ya la tiene no necesita
--     ninguno y no se le crea.
--
-- Y se gana lo que se buscaba: una sesión confirmada trae sus pases hechos.
-- Nadie tiene que acordarse de generarlos, el enlace del correo y el del QR
-- son el mismo, y volver a mirar la pantalla no crea nada.
-- =============================================================================

alter table public.invitations add column if not exists token text;

comment on column public.invitations.token is
  'El testigo en claro, mientras la invitación siga pendiente. Se borra al '
  'aceptarla. Es lo que permite que el pase esté siempre a la vista sin '
  'generar uno nuevo cada vez que alguien abre la pantalla.';

-- Ya no se anota quién pidió los pases: no hay nada que pedir. Estaban ahí
-- desde que se confirmó la sesión, y registrar cada visita a una pantalla es
-- ruido que nadie va a leer.
drop table if exists public.access_passes_log;

-- -----------------------------------------------------------------------------
-- Crear lo que falte, sin repetir lo que ya está
-- -----------------------------------------------------------------------------

create or replace function public.preparar_invitaciones(p_appointment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fin   timestamptz;
  v_org   uuid;
  v_fila  record;
  v_token text;
  v_hechas integer := 0;
begin
  select ends_at, organization_id into v_fin, v_org
  from public.appointments where id = p_appointment_id;

  -- Sin empresa detrás no hay convocados que invitar.
  if v_org is null then
    return 0;
  end if;

  for v_fila in
    select op.id
    from public.appointment_attendees aa
    join public.organization_people op on op.id = aa.person_id
    where aa.appointment_id = p_appointment_id
      and op.profile_id is null
      and not exists (
        select 1 from public.invitations i
        where i.person_id = op.id
          and i.accepted_at is null
          and i.expires_at > now()
          and i.token is not null
      )
  loop
    v_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');

    insert into public.invitations
      (person_id, appointment_id, token, token_hash, expires_at)
    values (
      v_fila.id,
      p_appointment_id,
      v_token,
      -- El hash se conserva: es por donde `aceptar_invitacion` busca, y así esa
      -- función no cambia ni una línea.
      encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
      v_fin + interval '30 days'
    );

    v_hechas := v_hechas + 1;
  end loop;

  return v_hechas;
end;
$$;

comment on function public.preparar_invitaciones(uuid) is
  'Crea las invitaciones que falten para los convocados sin cuenta. '
  'Idempotente: a quien ya tiene una viva no se le crea otra.';

/*
 * Nadie con sesión la invoca: la llaman `confirmar_cita` y `emitir_invitaciones`
 * desde dentro. Se le deja al rol de servidor porque es quien tiene que poder
 * reparar una sesión que quedó sin accesos —y porque las pruebas montan
 * sesiones ya confirmadas, saltándose el camino que las prepara.
 */
revoke all on function public.preparar_invitaciones(uuid) from public;
grant execute on function public.preparar_invitaciones(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Confirmar deja la sesión lista
-- -----------------------------------------------------------------------------

create or replace function public.confirmar_cita(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado   public.appointment_status;
  v_inicio   timestamptz;
  v_prop_ini timestamptz;
  v_prop_fin timestamptz;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede confirmar citas.';
  end if;

  select status, starts_at, proposed_starts_at, proposed_ends_at
  into v_estado, v_inicio, v_prop_ini, v_prop_fin
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

-- -----------------------------------------------------------------------------
-- El testigo se borra al usarse
-- -----------------------------------------------------------------------------

create or replace function public.aceptar_invitacion(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_hash      text;
  v_inv       record;
  v_persona   record;
  v_mi_doc    text;
  v_otro      uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación.';
  end if;

  v_hash := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  select * into v_inv from public.invitations where token_hash = v_hash;

  if v_inv is null then
    raise exception 'Esta invitación no es válida.';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'Esta invitación ya fue aceptada.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Esta invitación ya venció.'
      using hint = 'Pídele a la empresa que solicite una nueva.';
  end if;

  select * into v_persona
  from public.organization_people where id = v_inv.person_id;

  if v_persona.profile_id is not null and v_persona.profile_id <> v_uid then
    raise exception 'Esta invitación pertenece a otra persona.';
  end if;

  select nullif(btrim(coalesce(documento, '')), '')
  into v_mi_doc from public.profiles where id = v_uid;

  -- La cédula de la cuenta y la de la ficha tienen que ser la misma persona.
  if v_mi_doc is not null and v_mi_doc <> btrim(v_persona.documento) then
    raise exception 'Tu cuenta está a nombre de otro documento de identidad.'
      using hint = 'Entra con la cuenta que corresponde a esta invitación.';
  end if;

  select id into v_otro
  from public.profiles
  where documento is not null
    and btrim(documento) = btrim(v_persona.documento)
    and id <> v_uid;

  if v_otro is not null then
    raise exception 'Ya existe una cuenta con ese documento de identidad.'
      using hint = 'Entra con ella y vuelve a abrir la invitación; tus resultados quedan juntos.';
  end if;

  if v_mi_doc is null then
    update public.profiles
    set documento = btrim(v_persona.documento)
    where id = v_uid;
  end if;

  update public.organization_people
  set profile_id = v_uid
  where id = v_inv.person_id;

  /*
   * Y el testigo desaparece.
   *
   * Ya cumplió: la ficha quedó enlazada a una cuenta y esta invitación no
   * vuelve a servir. Guardarlo en claro a partir de aquí sería riesgo sin
   * ninguna contrapartida. El hash se queda, que es lo que permite reconocer
   * un enlace viejo y responder «ya fue aceptada» en vez de «no es válida».
   */
  update public.invitations
  set accepted_at = now(), accepted_by = v_uid, token = null
  where id = v_inv.id;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'invitacion.aceptada', 'organization_people',
          v_inv.person_id::text,
          jsonb_build_object('organizacion', v_persona.organization_id));

  return v_inv.person_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Leer los pases: ya no crea nada
-- -----------------------------------------------------------------------------

drop function if exists public.pases_de_acceso(uuid);

create or replace function public.pases_de_acceso(p_appointment_id uuid)
returns table (
  person_id    uuid,
  nombre       text,
  apellidos    text,
  documento    text,
  email        text,
  tiene_cuenta boolean,
  token        text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
  v_mia    uuid := public.mi_organizacion();
begin
  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La sesión no existe.';
  end if;

  if v_org is null then
    raise exception 'Los pases son para sesiones de evaluación de una empresa.';
  end if;

  -- El profesional, o la empresa dueña. Se comprueba aquí porque dentro de una
  -- función `security definer` no rigen las políticas de la tabla.
  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esta sesión no es tuya.';
  end if;

  if v_estado not in ('confirmada', 'realizada') then
    raise exception 'La sesión debe estar confirmada para repartir accesos.'
      using hint = 'Hasta que el profesional la acepte, la fecha puede cambiar.';
  end if;

  return query
  select op.id,
         op.nombre,
         op.apellidos,
         op.documento,
         op.email,
         op.profile_id is not null,
         /*
          * El testigo de su invitación viva, si la tiene.
          *
          * Se toma la más reciente porque el modelo antiguo pudo dejar varias
          * —cada pulsación del botón creaba otra— y todas siguen siendo
          * válidas. La última es la que se enseña.
          */
         (
           select i.token
           from public.invitations i
           where i.person_id = op.id
             and i.accepted_at is null
             and i.expires_at > now()
             and i.token is not null
           order by i.created_at desc
           limit 1
         )
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  where aa.appointment_id = p_appointment_id
  order by op.nombre, op.apellidos;
end;
$$;

comment on function public.pases_de_acceso(uuid) is
  'Los accesos de los convocados de una sesión confirmada. Solo lee: las '
  'invitaciones se crean al confirmar la sesión.';

grant execute on function public.pases_de_acceso(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Emitir por correo: reutiliza el que ya existe
-- -----------------------------------------------------------------------------

create or replace function public.emitir_invitaciones(p_appointment_id uuid)
returns table (person_id uuid, nombre text, email text, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional emite invitaciones.';
  end if;

  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_org is null then
    raise exception 'Las invitaciones son para sesiones de evaluación.';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'La sesión debe estar confirmada antes de invitar.';
  end if;

  -- Por si la sesión se confirmó antes de que existieran los pases, o si
  -- alguien entró a la lista después.
  perform public.preparar_invitaciones(p_appointment_id);

  /*
   * Devuelve a TODOS los pendientes, no solo a los recién creados.
   *
   * Antes creaba un testigo por pulsación y devolvía únicamente esos, así que
   * la segunda vez no salía nadie y no había forma de reenviar un correo que
   * se perdió. Ahora el testigo es el mismo que enseña el QR: volver a pulsar
   * reenvía, que es justo lo que se quiere cuando alguien dice «no me llegó».
   */
  return query
  select op.id, op.nombre, op.email, i.token
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  join lateral (
    select i.token, i.created_at
    from public.invitations i
    where i.person_id = op.id
      and i.accepted_at is null
      and i.expires_at > now()
      and i.token is not null
    order by i.created_at desc
    limit 1
  ) i on true
  where aa.appointment_id = p_appointment_id
    and op.profile_id is null
    and op.email is not null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lo que ya estaba confirmado
--
-- Las sesiones en pie se quedan sin pases si no se las prepara: sus
-- invitaciones son del modelo viejo y no tienen testigo que enseñar. A las
-- pendientes sin testigo se les da uno nuevo, lo que invalida el enlace que
-- hubiera salido por correo — solo ocurre una vez, y hoy no hay ninguno vivo
-- fuera de las pruebas.
-- -----------------------------------------------------------------------------

do $$
declare
  v_cita uuid;
begin
  update public.invitations
  set expires_at = now()
  where accepted_at is null and token is null;

  for v_cita in
    select id from public.appointments
    where organization_id is not null
      and status in ('confirmada', 'realizada')
  loop
    perform public.preparar_invitaciones(v_cita);
  end loop;
end;
$$;
