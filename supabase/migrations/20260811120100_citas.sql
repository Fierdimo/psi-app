-- =============================================================================
-- 0002 · Citas
--
-- PLAN.md §5.2, SPEC.md §9.1
--
-- La asimetría del producto vive aquí: el paciente PIDE, el profesional
-- AUTORIZA. Ninguna acción del paciente produce por sí sola una cita
-- confirmada, y eso lo garantiza Postgres, no el frontend.
-- =============================================================================

create type public.appointment_status as enum (
  'solicitada',
  'confirmada',
  'reprogramacion_solicitada',
  'realizada',
  'cancelada',
  'rechazada',
  'no_asistio'
);

create type public.appointment_modality as enum ('presencial', 'virtual');

create table public.appointments (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.profiles (id) on delete cascade,
  professional_id    uuid not null references public.profiles (id),

  -- Siempre timestamptz. Jamás una hora local sin zona: es la causa número uno
  -- de citas perdidas en aplicaciones de agenda (PLAN.md §10).
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,

  modality           public.appointment_modality not null default 'presencial',
  location           text,
  meeting_url        text,
  status             public.appointment_status not null default 'solicitada',
  patient_note       text,

  -- Propuesta en curso durante una reprogramación, sin pisar la cita vigente.
  proposed_starts_at timestamptz,
  proposed_ends_at   timestamptz,

  created_by         uuid not null references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint fin_despues_de_inicio check (ends_at > starts_at),
  constraint propuesta_coherente check (
    (proposed_starts_at is null and proposed_ends_at is null)
    or (proposed_starts_at is not null and proposed_ends_at > proposed_starts_at)
  )
);

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Doble agendamiento: imposible, no improbable.
--
-- Una validación en la aplicación («¿hay algo a esa hora?» y luego insertar)
-- tiene una ventana de carrera entre la consulta y la escritura. Con dos
-- peticiones simultáneas, ambas ven el hueco libre y ambas escriben.
--
-- Esta restricción de exclusión lo resuelve en el único lugar donde puede
-- resolverse de verdad: la base rechaza la segunda escritura.
-- -----------------------------------------------------------------------------
create extension if not exists btree_gist;

alter table public.appointments
  add constraint sin_solapamiento
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('confirmada', 'realizada'));

-- Un paciente, una solicitud pendiente. Evita saturar la agenda del
-- profesional y hace el estado del sistema mucho más fácil de razonar.
create unique index una_solicitud_pendiente_por_paciente
  on public.appointments (patient_id)
  where status in ('solicitada', 'reprogramacion_solicitada');

create index appointments_patient_starts_idx
  on public.appointments (patient_id, starts_at desc);

create index appointments_professional_starts_idx
  on public.appointments (professional_id, starts_at desc);

-- -----------------------------------------------------------------------------
-- Historial de cambios de estado.
--
-- Sin interfaz en v1, pero no opcional: en contexto clínico hay que poder
-- responder quién cambió qué y cuándo. Lo escriben las funciones de §0004 en
-- la misma transacción que el cambio, así que no depende de que alguien se
-- acuerde de registrarlo.
-- -----------------------------------------------------------------------------
create table public.appointment_changes (
  id             bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  from_status    public.appointment_status,
  to_status      public.appointment_status not null,
  actor_id       uuid references public.profiles (id),
  reason         text,
  created_at     timestamptz not null default now()
);

create index appointment_changes_appointment_idx
  on public.appointment_changes (appointment_id, created_at desc);

-- =============================================================================
-- Row Level Security
--
-- Solo LECTURA por política. Las escrituras pasan por las funciones RPC de la
-- migración 0004, que validan la transición de estado y el rol. No se concede
-- insert, update ni delete directo a nadie.
-- =============================================================================
alter table public.appointments        enable row level security;
alter table public.appointment_changes enable row level security;

create policy "paciente: ve solo sus citas"
  on public.appointments for select
  to authenticated
  using (patient_id = (select auth.uid()));

create policy "profesional: ve todas las citas"
  on public.appointments for select
  to authenticated
  using (public.is_professional());

create policy "paciente: ve el historial de sus citas"
  on public.appointment_changes for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.patient_id = (select auth.uid())
    )
  );

create policy "profesional: ve todo el historial"
  on public.appointment_changes for select
  to authenticated
  using (public.is_professional());

grant select on public.appointments        to authenticated;
grant select on public.appointment_changes to authenticated;
