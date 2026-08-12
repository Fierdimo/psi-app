-- =============================================================================
-- 0006 · Preferencias de notificación y solicitud de eliminación de cuenta
--
-- SPEC.md §7.5 · PLAN.md §14
--
-- El derecho de acceso, rectificación y supresión tiene que existir en la
-- interfaz, no solo en una política que nadie lee. Bajo habeas data no es una
-- cortesía: es el mecanismo por el que el titular ejerce sus derechos.
-- =============================================================================

alter table public.profiles
  add column recordatorios_email boolean not null default true;

comment on column public.profiles.recordatorios_email is
  'Si recibe el recordatorio automático 24 h antes de cada cita.';

-- La lista de columnas editables se amplía de forma explícita. `role` sigue
-- fuera, que es justamente el punto de conceder por columnas (ver 0001).
grant update (recordatorios_email) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Solicitudes de eliminación de cuenta.
--
-- No se borra al instante y la interfaz lo explica. Motivo real: el profesional
-- puede tener la obligación legal de conservar parte de la historia clínica
-- durante un plazo determinado. Esa tensión entre el derecho de supresión y el
-- deber de conservación la resuelve el profesional con su asesor legal, no un
-- botón. Lo que la plataforma garantiza es que la solicitud queda registrada,
-- fechada y visible para quien debe atenderla.
-- -----------------------------------------------------------------------------
create type public.deletion_status as enum ('solicitada', 'atendida', 'rechazada');

create table public.account_deletion_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       public.deletion_status not null default 'solicitada',
  motivo       text,
  nota_interna text,
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id)
);

-- Una solicitud abierta por persona: pedirlo dos veces no crea dos trámites.
create unique index una_solicitud_de_eliminacion_abierta
  on public.account_deletion_requests (user_id)
  where status = 'solicitada';

alter table public.account_deletion_requests enable row level security;

create policy "solicitud propia: lectura"
  on public.account_deletion_requests for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "solicitud propia: creacion"
  on public.account_deletion_requests for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    -- Nadie crea una solicitud ya resuelta.
    and status = 'solicitada'
  );

create policy "profesional: lee las solicitudes"
  on public.account_deletion_requests for select
  to authenticated
  using (public.is_professional());

grant select, insert on public.account_deletion_requests to authenticated;

-- El paciente crea y consulta, pero NO retira ni edita: una vez pedida, la
-- solicitud es un hecho registrado. Retirarla se hace hablando con la consulta,
-- y entonces el profesional la marca como rechazada dejando constancia.
