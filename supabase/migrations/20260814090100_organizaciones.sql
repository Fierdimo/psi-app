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
  'Empresa cliente que encarga evaluaciones. Sus empleados NO le pertenecen: '
  'la empresa ve lo que contrató, no a las personas.';

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- `profiles.organization_id` significa «administra esta empresa».
--
-- NO significa «trabaja aquí». Una persona evaluada por encargo de una empresa
-- no lleva esta columna: su vínculo con la empresa es la evaluación concreta
-- que se le encargó, y vive en la cita y en la asignación, no en su identidad.
--
-- La diferencia se nota el día que esa persona cambia de trabajo, o el día que
-- decide contratar una asesoría individual: su cuenta sigue siendo suya y su
-- historial no se parte en dos.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column organization_id uuid references public.organizations (id) on delete set null;

comment on column public.profiles.organization_id is
  'Empresa que este usuario ADMINISTRA (rol empresa). Nunca «dónde trabaja».';

create index profiles_organization_idx
  on public.profiles (organization_id)
  where organization_id is not null;

-- ANTIESCALADA, otra vez.
--
-- `organization_id` es tan sensible como `role`: quien pudiera editarlo se
-- metería en la empresa que quisiera y vería los informes que ella encargó.
-- La migración 0001 revocó UPDATE sobre la tabla y concedió una lista blanca
-- de columnas. Esta columna NO se añade a esa lista, así que ya nace protegida
-- y no hay nada que revocar. Se deja escrito para que quede constancia de que
-- fue una decisión y no un olvido.

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
  'Organización que administra el usuario actual, o null. Toda política de '
  'aislamiento entre empresas la usa; ninguna repite la subconsulta.';

-- -----------------------------------------------------------------------------
-- Alta de una empresa por sí misma.
--
-- El rol y la organización NO son autoasignables —esa es la defensa de 0001—,
-- así que una empresa no puede registrarse con un simple UPDATE. Esta función
-- es la única puerta, y comprueba lo que hay que comprobar antes de abrirla.
--
-- Que una empresa pueda darse de alta sola no la vuelve peligrosa: no obtiene
-- ningún dato por existir. Nada ocurre hasta que el profesional confirma una
-- cita, y las invitaciones a empleados solo salen con la cita confirmada. Lo
-- máximo que consigue una empresa falsa es ocupar una línea en la bandeja.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_empresa(
  p_nombre            text,
  p_nit               text default null,
  p_contacto_nombre   text default null,
  p_contacto_telefono text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rol public.user_role;
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para registrar una empresa.';
  end if;

  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'La empresa necesita un nombre.';
  end if;

  select role, organization_id into v_rol, v_org
  from public.profiles where id = v_uid;

  if v_org is not null then
    raise exception 'Esta cuenta ya administra una empresa.';
  end if;

  -- La cuenta del profesional es la que autoriza; no puede ser también cliente.
  if v_rol = 'profesional' then
    raise exception 'La cuenta del profesional no puede registrar una empresa.';
  end if;

  insert into public.organizations (nombre, nit, contacto_nombre, contacto_telefono)
  values (btrim(p_nombre), nullif(btrim(p_nit), ''), p_contacto_nombre, p_contacto_telefono)
  returning id into v_org;

  update public.profiles
  set role = 'empresa', organization_id = v_org
  where id = v_uid;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'empresa.registrada', 'organization', v_org::text,
          jsonb_build_object('nombre', btrim(p_nombre)));

  return v_org;
end;
$$;

revoke execute on function public.registrar_empresa(text, text, text, text) from public;
grant  execute on function public.registrar_empresa(text, text, text, text) to authenticated;

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

-- O es de una persona, o la encarga una empresa. Nunca las dos, nunca ninguna.
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

-- -----------------------------------------------------------------------------
-- El listado de personas de una empresa.
--
-- Existe porque una empresa encarga cien evaluaciones de una vez, y exigir que
-- las cien personas tengan cuenta ANTES de poder pedir la cita sería inviable:
-- habría que invitarlas a todas, esperar a que aceptaran, y solo entonces
-- agendar. El orden real es el contrario.
--
-- Aquí una persona es un nombre y un correo. La cuenta llega después, cuando
-- la cita se confirma y sale la invitación, y en ese momento se rellena
-- `profile_id`. Hasta entonces la fila existe y se puede convocar.
--
-- `profile_id` apunta a una cuenta que es de la PERSONA, no de la empresa: si
-- mañana cambia de trabajo o te contrata una asesoría individual, su cuenta y
-- su historial siguen siendo suyos. Esta tabla solo dice a quién mandó evaluar
-- cada empresa.
-- -----------------------------------------------------------------------------
create table public.organization_people (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nombre          text not null,
  apellidos       text,
  email           text not null,
  documento       text,
  cargo           text,
  -- Nulo hasta que la persona acepta la invitación y crea su cuenta.
  profile_id      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- La misma persona no se carga dos veces en la misma empresa. En dos
  -- empresas distintas sí: puede haber sido evaluada por las dos.
  constraint una_vez_por_empresa unique (organization_id, email)
);

create trigger organization_people_touch_updated_at
  before update on public.organization_people
  for each row execute function public.touch_updated_at();

create index organization_people_org_idx     on public.organization_people (organization_id);
create index organization_people_profile_idx on public.organization_people (profile_id)
  where profile_id is not null;

create table public.appointment_attendees (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  person_id      uuid not null references public.organization_people (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (appointment_id, person_id)
);

comment on table public.appointment_attendees is
  'Personas convocadas a una sesión de evaluación. Se convoca a alguien del '
  'listado de la empresa, tenga cuenta o no todavía.';

create index appointment_attendees_person_idx
  on public.appointment_attendees (person_id);

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
    select 1
    from public.appointment_attendees aa
    join public.organization_people p on p.id = aa.person_id
    where aa.appointment_id = p_appointment
      and p.profile_id = (select auth.uid())
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

create or replace function public.soy_esta_persona(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_people
    where id = p_person and profile_id = (select auth.uid())
  );
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.organizations          enable row level security;
alter table public.appointment_attendees  enable row level security;

create policy "empresa: ve la organizacion que administra"
  on public.organizations for select
  to authenticated
  using (id = public.mi_organizacion());

create policy "profesional: ve todas las organizaciones"
  on public.organizations for select
  to authenticated
  using (public.is_professional());

-- Una empresa ve las citas que ella encargó. Nunca las de otra, y nunca las
-- citas individuales de nadie.
create policy "empresa: ve las citas que encargo"
  on public.appointments for select
  to authenticated
  using (
    organization_id is not null
    and organization_id = public.mi_organizacion()
  );

-- Quien fue convocado ve esa cita. No hace falta ningún rol especial: basta
-- estar en la lista de convocados.
create policy "convocado: ve las citas a las que asiste"
  on public.appointments for select
  to authenticated
  using (public.asisto_a_cita(id));

create policy "convocado: se ve a si mismo"
  on public.appointment_attendees for select
  to authenticated
  using (public.soy_esta_persona(person_id));

create policy "empresa: ve los convocados de sus citas"
  on public.appointment_attendees for select
  to authenticated
  using (
    public.mi_organizacion() is not null
    and public.organizacion_de_cita(appointment_id) = public.mi_organizacion()
  );

create policy "profesional: ve todos los convocados"
  on public.appointment_attendees for select
  to authenticated
  using (public.is_professional());

-- Solo lectura, como el resto del módulo de citas: las escrituras pasan por
-- funciones que validan rol y transición (PLAN.md §6.2).
alter table public.organization_people enable row level security;

create policy "empresa: ve su propio listado"
  on public.organization_people for select
  to authenticated
  using (organization_id = public.mi_organizacion());

-- Cada quien se ve a sí mismo en el listado de la empresa que lo mandó
-- evaluar, y solo a sí mismo: la lista de compañeros no es asunto suyo.
create policy "persona: se ve a si misma"
  on public.organization_people for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "profesional: ve todos los listados"
  on public.organization_people for select
  to authenticated
  using (public.is_professional());

grant select on public.organization_people   to authenticated;
grant select on public.organizations         to authenticated;
grant select on public.appointment_attendees to authenticated;
