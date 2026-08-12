-- =============================================================================
-- 0001 · Perfiles y roles
--
-- PLAN.md §5.1, §6.1
--
-- Contiene la defensa más importante del proyecto: la imposibilidad de que un
-- paciente se conceda a sí mismo el rol de profesional.
-- =============================================================================

create type public.user_role as enum ('paciente', 'profesional');

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  role             public.user_role not null default 'paciente',
  nombre           text,
  apellidos        text,
  telefono         text,
  fecha_nacimiento date,
  documento        text,
  -- Zona IANA, no desplazamiento. Un offset no sobrevive al horario de verano
  -- ni a una mudanza de país (PLAN.md §10).
  timezone         text not null default 'America/Bogota',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is
  'Datos del usuario. Extiende auth.users, que solo guarda credenciales.';

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Todo usuario autenticado tiene perfil desde el instante en que se registra.
-- Sin esto existiría una ventana en la que hay sesión válida sin fila en
-- profiles, y toda política que consulte el rol fallaría de forma silenciosa.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, apellidos)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'nombre', ''),
    nullif(new.raw_user_meta_data ->> 'apellidos', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helper de rol.
--
-- SECURITY DEFINER es OBLIGATORIO aquí. Sin él, consultar profiles dentro de
-- una política definida sobre profiles provoca recursión infinita de RLS: la
-- política llama a la función, la función consulta la tabla, la tabla evalúa
-- la política. Es el error clásico de Supabase y aparece como un timeout
-- incomprensible, no como un mensaje útil.
-- -----------------------------------------------------------------------------
create or replace function public.is_professional()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'profesional'
  );
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;

create policy "perfil propio: lectura"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "perfil propio: actualizacion"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profesional: lee todos los perfiles"
  on public.profiles for select
  to authenticated
  using (public.is_professional());

-- =============================================================================
-- ANTIESCALADA DE PRIVILEGIOS
--
-- La política de arriba permite al paciente actualizar su propia fila. Sin lo
-- que sigue, «su propia fila» incluye la columna `role`, y cualquier paciente
-- podría concederse acceso a la agenda completa con una sola petición.
--
-- En vez de conceder UPDATE sobre la tabla y luego revocar la columna, se
-- concede únicamente la lista explícita de columnas editables. `role` no está
-- en la lista, así que no hay nada que revocar ni que olvidar revocar.
-- =============================================================================
revoke update on public.profiles from authenticated;

grant update (
  nombre,
  apellidos,
  telefono,
  fecha_nacimiento,
  documento,
  timezone
) on public.profiles to authenticated;

grant select on public.profiles to authenticated;
