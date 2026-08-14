-- =============================================================================
-- 0013 · Invitaciones
--
-- SPEC.md §9.2 · PLAN.md §5.4
--
-- La pieza que faltaba para que una persona cargada llegue a tener cuenta.
-- Sin esto, `organization_people.profile_id` no lo llena nadie y el listado se
-- queda en una lista de nombres.
--
-- Aquí se resuelve además el caso que dejamos anotado: si quien acepta YA
-- tiene cuenta —porque otra empresa lo evaluó antes— se enlaza a esa cuenta en
-- vez de crearle una segunda y partirle el historial en dos. La cédula es lo
-- que permite reconocerlo.
-- =============================================================================

create table public.invitations (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.organization_people (id) on delete cascade,
  -- La sesión que la motivó. `set null` y no cascada: si la cita se borrara,
  -- la invitación ya aceptada no debe desaparecer con ella.
  appointment_id uuid references public.appointments (id) on delete set null,

  -- NUNCA el testigo en claro.
  --
  -- Un testigo guardado tal cual es una contraseña guardada tal cual: quien
  -- lea la tabla —una copia de seguridad mal guardada, una consulta de
  -- soporte— puede entrar como cualquiera de las personas invitadas. Se guarda
  -- su SHA-256 y el original solo existe el rato que tarda en enviarse el
  -- correo.
  token_hash     text not null unique,

  expires_at     timestamptz not null,
  accepted_at    timestamptz,
  accepted_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.invitations is
  'Invitación para que una persona del listado cree o enlace su cuenta. '
  'Se guarda el hash del testigo, jamás el testigo.';

create index invitations_person_idx on public.invitations (person_id);

-- RLS sin una sola política de lectura, y es deliberado: nadie consulta esta
-- tabla por la API. Se entra por las funciones de más abajo o no se entra.
alter table public.invitations enable row level security;

-- =============================================================================
-- EMITIR
--
-- Devuelve los testigos EN CLARO una única vez, para que el servidor los ponga
-- en el correo. No vuelven a estar disponibles: en la tabla solo queda su hash.
--
-- Solo se emite para quien todavía no tiene cuenta. Quien ya la tiene —porque
-- otra empresa lo evaluó antes, o porque es paciente de la consulta— no
-- necesita crear nada: se le avisa y entra como siempre.
-- =============================================================================
-- Se recorre fila por fila y no con un INSERT ... RETURNING masivo por una
-- razón concreta: el testigo en claro tiene que existir ANTES de insertar,
-- porque lo que se guarda es su hash y de un hash no se vuelve. Un INSERT
-- masivo solo podría devolver lo almacenado, que es justo lo que no sirve
-- para el correo.
create or replace function public.emitir_invitaciones(p_appointment_id uuid)
returns table (person_id uuid, nombre text, email text, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
  v_fin    timestamptz;
  v_fila   record;
  v_token  text;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional emite invitaciones.';
  end if;

  select status, organization_id, ends_at
  into v_estado, v_org, v_fin
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

  for v_fila in
    select op.id, op.nombre, op.email
    from public.appointment_attendees aa
    join public.organization_people op on op.id = aa.person_id
    where aa.appointment_id = p_appointment_id
      and op.profile_id is null
      and not exists (
        select 1 from public.invitations i
        where i.person_id = op.id
          and i.accepted_at is null
          and i.expires_at > now()
      )
  loop
    v_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');

    insert into public.invitations (person_id, appointment_id, token_hash, expires_at)
    values (
      v_fila.id,
      p_appointment_id,
      encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
      v_fin + interval '30 days'
    );

    person_id := v_fila.id;
    nombre    := v_fila.nombre;
    email     := v_fila.email;
    token     := v_token;
    return next;
  end loop;
end;
$$;

-- =============================================================================
-- ACEPTAR
--
-- La llama la persona ya autenticada, sea con una cuenta recién creada o con
-- la que ya tenía. Aquí es donde se decide si su historial sigue siendo uno
-- solo o se parte en dos.
-- =============================================================================
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

  -- ¿Ya existe una cuenta con esa cédula, y no es esta? Entonces la persona
  -- tiene cuenta y llegó con otra. Se le dice, en vez de dejar que acabe con
  -- dos cuentas y el historial partido — que es justo lo que este modelo
  -- existe para evitar.
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

  update public.invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'invitacion.aceptada', 'organization_people',
          v_inv.person_id::text,
          jsonb_build_object('organizacion', v_persona.organization_id));

  return v_inv.person_id;
end;
$$;

revoke execute on function public.emitir_invitaciones(uuid) from public;
revoke execute on function public.aceptar_invitacion(text) from public;

grant execute on function public.emitir_invitaciones(uuid) to authenticated;
grant execute on function public.aceptar_invitacion(text) to authenticated;
