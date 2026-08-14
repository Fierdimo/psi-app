-- =============================================================================
-- 0009 · Organizaciones y citas de grupo
--
-- SPEC.md §3.1 y §9.2 · PLAN.md §5.4
--
-- El riesgo mayor de todo el proyecto vive aquí. Hasta ahora RLS respondía a
-- «cada quien ve lo suyo»; ahora hay un límite nuevo —la organización— y lo
-- que se filtraría en un error son resultados psicológicos de personas
-- identificadas ante una empresa que no las contrató.
-- =============================================================================

create table public.organizations (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  -- Identificación tributaria. Nulable a propósito: se puede empezar a
  -- trabajar con una empresa antes de tener su papeleo completo.
  nit               text,
  contacto_nombre   text,
  contacto_email    text,
  contacto_telefono text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.organizations is
  'Empresa cliente que contrata evaluaciones para sus empleados.';

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- La pertenencia va en `profiles`, no en una tabla de membresías.
--
-- Una tabla aparte permitiría que una persona perteneciera a varias empresas,
-- que hoy no ocurre y probablemente nunca ocurra: un empleado evaluado
-- pertenece a la empresa que lo mandó evaluar. A cambio, cada política de
-- aislamiento pasaría de un salto a dos.
--
-- Y en este módulo eso importa más que la flexibilidad: una política que
-- encadena tres subconsultas es una política que nadie vuelve a revisar, y
-- estas son justo las que no pueden estar mal.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column organization_id uuid references public.organizations (id) on delete set null;

create index profiles_organization_idx
  on public.profiles (organization_id)
  where organization_id is not null;

-- ANTIESCALADA, otra vez.
--
-- `organization_id` es tan sensible como `role`: quien pudiera editarlo se
-- metería en la empresa que quisiera y vería los informes de sus empleados.
-- La migración 0001 revocó UPDATE sobre la tabla y concedió una lista blanca
-- de columnas. Esta columna NO se añade a esa lista, así que ya nace protegida
-- y no hay nada que revocar. Se deja escrito para que quede constancia de que
-- fue una decisión y no un olvido.

-- -----------------------------------------------------------------------------
-- Helper de pertenencia.
--
-- SECURITY DEFINER por el mismo motivo que `is_professional()`: sin él,
-- consultar profiles dentro de una política sobre profiles entra en recursión
-- infinita de RLS y se manifiesta como un timeout incomprensible.
-- -----------------------------------------------------------------------------
create or replace function public.mi_organizacion()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = (select auth.uid());
$$;

comment on function public.mi_organizacion() is
  'Organización del usuario actual, o null. Toda política de aislamiento entre '
  'empresas la usa; ninguna repite la subconsulta.';

-- =============================================================================
-- Citas de grupo
--
-- Una cita de evaluación reúne a varios empleados. No se puede resolver
-- creando N citas simultáneas: la restricción de exclusión `sin_solapamiento`
-- de la migración 0002 las rechazaría, y esa restricción es correcta —existe
-- para que dos personas no ocupen la misma hora del profesional— así que se
-- queda intacta.
-- =============================================================================

-- Deja de ser obligatorio: una cita corporativa no tiene «un» paciente.
alter table public.appointments
  alter column patient_id drop not null;

alter table public.appointments
  add column organization_id uuid references public.organizations (id) on delete cascade;

-- O es de una persona, o es de una empresa. Nunca las dos, nunca ninguna.
alter table public.appointments
  add constraint destinatario_coherente check (
    (patient_id is not null and organization_id is null)
    or (patient_id is null and organization_id is not null)
  );

create index appointments_organization_starts_idx
  on public.appointments (organization_id, starts_at desc)
  where organization_id is not null;

-- El índice `una_solicitud_pendiente_por_paciente` de 0002 no necesita cambio:
-- en un índice único los NULL se consideran distintos entre sí, de modo que
-- las citas corporativas —que llevan `patient_id` nulo— no compiten por él. La
-- regla sigue aplicando donde se pensó: una persona, una solicitud pendiente.

create table public.appointment_attendees (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (appointment_id, profile_id)
);

comment on table public.appointment_attendees is
  'Empleados convocados a una cita de evaluación. Vacía para citas individuales.';

create index appointment_attendees_profile_idx
  on public.appointment_attendees (profile_id);

-- -----------------------------------------------------------------------------
-- Las dos funciones que rompen el ciclo entre `appointments` y
-- `appointment_attendees`.
--
-- Sin ellas hay recursión infinita, y no en teoría: se escribieron primero las
-- políticas con subconsultas cruzadas y Postgres respondió «infinite recursion
-- detected in policy for relation "appointments"», tumbando incluso las
-- pruebas de aislamiento entre pacientes que ya pasaban.
--
-- El ciclo era: leer una cita evalúa la política de asistentes, que lee citas,
-- que evalúa la política de asistentes. SECURITY DEFINER lo corta porque la
-- consulta de dentro no vuelve a pasar por RLS.
-- -----------------------------------------------------------------------------
create or replace function public.asisto_a_cita(p_appointment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.appointment_attendees
    where appointment_id = p_appointment
      and profile_id = (select auth.uid())
  );
$$;

create or replace function public.organizacion_de_cita(p_appointment uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.appointments where id = p_appointment;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.organizations          enable row level security;
alter table public.appointment_attendees  enable row level security;

create policy "empresa y empleado: ven su propia organizacion"
  on public.organizations for select
  to authenticated
  using (id = public.mi_organizacion());

create policy "profesional: ve todas las organizaciones"
  on public.organizations for select
  to authenticated
  using (public.is_professional());

-- Una empresa ve las citas que ella contrató. Nunca las de otra, y nunca las
-- citas individuales de nadie.
create policy "empresa: ve las citas de su organizacion"
  on public.appointments for select
  to authenticated
  using (
    organization_id is not null
    and organization_id = public.mi_organizacion()
  );

-- Un empleado ve la cita a la que fue convocado, y solo esa.
create policy "empleado: ve las citas a las que asiste"
  on public.appointments for select
  to authenticated
  using (public.asisto_a_cita(id));

create policy "asistente: se ve a si mismo"
  on public.appointment_attendees for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "empresa: ve los asistentes de sus citas"
  on public.appointment_attendees for select
  to authenticated
  using (
    public.mi_organizacion() is not null
    and public.organizacion_de_cita(appointment_id) = public.mi_organizacion()
  );

create policy "profesional: ve todos los asistentes"
  on public.appointment_attendees for select
  to authenticated
  using (public.is_professional());

-- Solo lectura, como el resto del módulo de citas: las escrituras pasan por
-- funciones que validan rol y transición (PLAN.md §6.2).
grant select on public.organizations         to authenticated;
grant select on public.appointment_attendees to authenticated;
