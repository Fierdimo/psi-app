-- =============================================================================
-- 0003 · Consentimientos y auditoría
--
-- PLAN.md §5.3, §14 · SPEC.md §6.1
--
-- Requisito de habeas data, no funcionalidad opcional.
-- =============================================================================

create table public.consents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,

  -- 'consentimiento_informado' | 'privacidad' | 'terminos'
  document_key text not null,

  -- La VERSIÓN es el punto entero de esta tabla. Un booleano «aceptó = true»
  -- no sirve como evidencia: si el texto del consentimiento cambia, hay que
  -- poder demostrar qué redacción exacta aceptó cada persona y cuándo.
  version      text not null,

  accepted_at  timestamptz not null default now(),
  ip           inet,
  user_agent   text,

  unique (user_id, document_key, version)
);

alter table public.consents enable row level security;

create policy "consentimiento propio: lectura"
  on public.consents for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profesional: lee consentimientos"
  on public.consents for select
  to authenticated
  using (public.is_professional());

-- El registro lo escribe el servidor (service role), nunca el cliente: la IP y
-- el agente deben venir de la petición real, no de lo que el navegador declare.
grant select on public.consents to authenticated;

-- -----------------------------------------------------------------------------
-- Registro de auditoría.
--
-- Solo escritura desde el servidor y lectura para el profesional. Un paciente
-- no necesita verlo y exponerlo abriría un canal para inferir actividad ajena.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index audit_log_actor_idx  on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "profesional: lee la auditoria"
  on public.audit_log for select
  to authenticated
  using (public.is_professional());

grant select on public.audit_log to authenticated;
