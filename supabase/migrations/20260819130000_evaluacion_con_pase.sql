-- =============================================================================
-- 0037 · Responder con el pase, sin cuenta
--
-- Para una psicotécnica de selección, la persona evaluada es un candidato, no
-- un paciente: entra una vez, responde, y no vuelve. Obligarla a crear cuenta
-- —correo, contraseña, confirmar el correo— antes de poder empezar es tres
-- pantallas de fricción para algo que usa una sola vez, y cada pantalla pierde
-- gente en un proceso que la empresa quiere cerrar hoy.
--
-- EL TESTIGO PASA A SER LA CREDENCIAL. Quien tiene el enlace o escanea el QR
-- puede consentir y responder SU evaluación, sin `auth.uid()` de por medio.
--
-- QUÉ SE CEDE, dicho claro: se pierde el historial entre empresas. Hasta ahora
-- la invitación creaba cuenta para que la misma persona evaluada por tres
-- empresas fuera una sola, con su historia junta. Sin cuenta no hay a qué
-- enlazar: la misma persona evaluada dos veces son dos desconocidas, y el
-- profesional no puede comparar ni saber que ya la evaluó. Es una decisión
-- tomada a sabiendas.
--
-- LA DISCIPLINA QUE SOSTIENE ESTO: cada función resuelve el testigo a UNA
-- asignación y opera solo sobre ella. Ninguna acepta un identificador de
-- asignación desde fuera; si lo hiciera, el testigo de una persona serviría
-- para responder la prueba de otra.
-- =============================================================================

-- El consentimiento ya no siempre lo firma una cuenta.
alter table public.consents alter column user_id drop not null;

alter table public.consents
  add column if not exists person_id uuid
    references public.organization_people (id) on delete cascade;

alter table public.consents
  drop constraint if exists consentimiento_tiene_dueno,
  -- Un consentimiento sin dueño no es evidencia de nada. Con cuenta o con
  -- ficha, pero de alguien.
  add constraint consentimiento_tiene_dueno check (
    user_id is not null or person_id is not null
  );

comment on column public.consents.person_id is
  'La ficha de quien consintió cuando no tiene cuenta. La evidencia sigue '
  'atada a una persona concreta, que es lo que un consentimiento necesita.';

-- -----------------------------------------------------------------------------
-- Resolver el testigo
-- -----------------------------------------------------------------------------

create or replace function public.asignacion_de_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv    record;
  v_asig   uuid;
begin
  select * into v_inv
  from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  if v_inv is null then
    raise exception 'Este enlace no es válido.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Este enlace ya venció.'
      using hint = 'Pídele uno nuevo a la empresa que te convocó.';
  end if;

  /*
   * La evaluación viva de esa persona, la más reciente.
   *
   * Se busca por persona y no por la cita de la invitación: si la sesión se
   * aplazó y se creó otra, el enlace que ya está en el teléfono de alguien
   * tiene que seguir llevándole a su prueba. Lo que identifica es a la
   * persona, no la cita concreta.
   */
  select a.id into v_asig
  from public.assignments a
  where a.person_id = v_inv.person_id
    and a.status in ('asignada', 'en_curso')
  order by a.assigned_at desc
  limit 1;

  if v_asig is null then
    raise exception 'No tienes ninguna evaluación pendiente.'
      using hint = 'Puede que ya la hayas enviado.';
  end if;

  return v_asig;
end;
$$;

-- Nadie la llama desde fuera: es el resolutor que usan las demás.
revoke all on function public.asignacion_de_pase(text) from public;

-- -----------------------------------------------------------------------------
-- Lo que se puede hacer con un pase
-- -----------------------------------------------------------------------------

create or replace function public.evaluacion_de_pase(p_token text)
returns table (
  assignment_id uuid,
  estado        text,
  instrumento   text,
  clave         text,
  persona       text,
  empresa       text,
  consentimiento text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_de_pase(p_token);
begin
  return query
  select a.id,
         a.status::text,
         s.nombre,
         s.clave,
         trim(coalesce(op.nombre, '') || ' ' || coalesce(op.apellidos, '')),
         o.nombre,
         coalesce(public.consentimiento_de(a.id), 'sin_decidir')
  from public.assignments a
  join public.assessments s on s.id = a.assessment_id
  join public.organization_people op on op.id = a.person_id
  left join public.organizations o on o.id = a.organization_id
  where a.id = v_asig;
end;
$$;

grant execute on function public.evaluacion_de_pase(text) to anon, authenticated;

create or replace function public.consentir_con_pase(
  p_token    text,
  p_decision text,
  p_version  text default '1'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig    uuid := public.asignacion_de_pase(p_token);
  v_persona uuid;
begin
  if p_decision not in ('aceptado', 'rechazado') then
    raise exception 'Decisión no válida.';
  end if;

  select person_id into v_persona from public.assignments where id = v_asig;

  -- Repetir la misma decisión no escribe. Cambiarla SÍ, y sin borrar la
  -- anterior: la evidencia de que en su momento consintió no se destruye.
  if p_decision = 'aceptado'
     and public.consentimiento_de(v_asig) = 'aceptado' then
    return;
  end if;

  insert into public.consents
    (user_id, person_id, document_key, version, decision, assignment_id)
  values (null, v_persona, 'consentimiento_evaluacion', p_version,
          p_decision, v_asig);
end;
$$;

grant execute on function public.consentir_con_pase(text, text, text)
  to anon, authenticated;

create or replace function public.iniciar_con_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_de_pase(p_token);
begin
  if public.consentimiento_de(v_asig) is distinct from 'aceptado' then
    raise exception 'Primero tienes que aceptar el consentimiento.';
  end if;

  update public.assignments
  set status = 'en_curso',
      started_at = coalesce(started_at, now())
  where id = v_asig and status in ('asignada', 'en_curso');

  return v_asig;
end;
$$;

grant execute on function public.iniciar_con_pase(text) to anon, authenticated;

create or replace function public.responder_con_pase(
  p_token text,
  p_item  uuid,
  p_valor jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_de_pase(p_token);
begin
  if public.consentimiento_de(v_asig) is distinct from 'aceptado' then
    raise exception 'No has aceptado el consentimiento.';
  end if;

  /*
   * El ítem tiene que ser DEL instrumento de esta asignación.
   *
   * Sin esta comprobación, un testigo válido serviría para escribir respuestas
   * de cualquier prueba del catálogo: la función corre como definidora y ya no
   * hay RLS que lo impida.
   */
  if not exists (
    select 1 from public.assessment_items i
    join public.assignments a on a.assessment_id = i.assessment_id
    where i.id = p_item and a.id = v_asig
  ) then
    raise exception 'Esa pregunta no es de tu evaluación.';
  end if;

  insert into public.responses (assignment_id, item_id, valor)
  values (v_asig, p_item, p_valor)
  on conflict (assignment_id, item_id) do update set valor = excluded.valor;

  update public.assignments
  set status = 'en_curso'
  where id = v_asig and status = 'asignada';
end;
$$;

grant execute on function public.responder_con_pase(text, uuid, jsonb)
  to anon, authenticated;

create or replace function public.enviar_con_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_de_pase(p_token);
begin
  update public.assignments
  set status = 'enviada', submitted_at = now()
  where id = v_asig and status = 'en_curso';

  if not found then
    raise exception 'Esta evaluación no está en curso.';
  end if;

  return v_asig;
end;
$$;

grant execute on function public.enviar_con_pase(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Lo que el pase deja LEER
--
-- Las preguntas y las respuestas ya dadas, para poder seguir donde se dejó.
-- Va por función y no abriendo las tablas a `anon`: aquí el filtro es el
-- testigo, y una política de RLS no tiene forma de conocerlo.
-- -----------------------------------------------------------------------------

create or replace function public.preguntas_de_pase(p_token text)
returns table (
  id        uuid,
  posicion  integer,
  tipo      text,
  enunciado text,
  escala    text,
  opciones  jsonb,
  respuesta jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_de_pase(p_token);
begin
  return query
  select i.id, i.posicion, i.tipo::text, i.enunciado, i.escala, i.opciones,
         r.valor
  from public.assessment_items i
  join public.assignments a on a.assessment_id = i.assessment_id
  left join public.responses r
    on r.assignment_id = a.id and r.item_id = i.id
  where a.id = v_asig
  order by i.posicion;
end;
$$;

grant execute on function public.preguntas_de_pase(text) to anon, authenticated;
