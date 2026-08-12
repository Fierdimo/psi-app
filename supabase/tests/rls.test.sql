-- =============================================================================
-- Pruebas de Row Level Security
--
-- PLAN.md §12.1 — «la prueba más importante del proyecto».
--
-- Una política que nunca se probó suplantando a un atacante no está
-- verificada: está escrita. Estas pruebas se ponen en el lugar de un paciente
-- real e intentan explícitamente el acceso indebido.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(11);

-- -----------------------------------------------------------------------------
-- Punto de partida limpio.
--
-- La base local viene sembrada (supabase/seed.sql). Sin esto, las aserciones
-- de conteo medirían siembra más fixtures y la prueba diría cosas distintas
-- según cuándo se corrió `db:reset`. Todo ocurre dentro de la transacción que
-- se revierte al final, así que la siembra sobrevive intacta.
--
-- El orden importa: appointments.professional_id no tiene ON DELETE CASCADE
-- —a propósito, no queremos que borrar un perfil evapore historial clínico—
-- así que las citas se borran antes que los perfiles.
-- -----------------------------------------------------------------------------
delete from public.appointment_changes;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
\set ana    'aaaaaaaa-0000-4000-8000-000000000001'
\set beto   'bbbbbbbb-0000-4000-8000-000000000002'
\set doctor 'cccccccc-0000-4000-8000-000000000003'

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'ana',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@ejemplo.test',    '', now(), now()),
  (:'beto',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@ejemplo.test',   '', now(), now()),
  (:'doctor', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ejemplo.test', '', now(), now());

-- El trigger handle_new_user ya creó los tres perfiles.
select is(
  (select count(*)::int from public.profiles),
  3,
  'El trigger crea un perfil por cada usuario registrado'
);

-- El rol de profesional se asigna por migración de datos, nunca por interfaz.
update public.profiles set role = 'profesional' where id = :'doctor';

-- Citas de cada paciente, creadas con privilegios de servidor.
insert into public.appointments (patient_id, professional_id, starts_at, ends_at, status, created_by)
values
  (:'ana',  :'doctor', now() + interval '7 days', now() + interval '7 days 1 hour', 'confirmada', :'doctor'),
  (:'beto', :'doctor', now() + interval '8 days', now() + interval '8 days 1 hour', 'confirmada', :'doctor');

-- -----------------------------------------------------------------------------
-- Suplantación de sesión
-- -----------------------------------------------------------------------------
create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- =============================================================================
-- AISLAMIENTO ENTRE PACIENTES
-- =============================================================================
select tests_como(:'ana');

select is(
  (select count(*)::int from public.appointments),
  1,
  'Ana ve exactamente una cita: la suya'
);

select is(
  (select count(*)::int from public.appointments where patient_id = :'beto'),
  0,
  'Ana NO puede leer las citas de Beto'
);

select is(
  (select count(*)::int from public.profiles),
  1,
  'Ana solo ve su propio perfil'
);

-- =============================================================================
-- ESCALADA DE PRIVILEGIOS
--
-- El fallo que convertiría el portal en una brecha de historia clínica.
-- =============================================================================
select throws_ok(
  format('update public.profiles set role = ''profesional'' where id = %L', :'ana'),
  '42501',
  null,
  'Ana NO puede concederse el rol de profesional'
);

select lives_ok(
  format('update public.profiles set nombre = ''Ana María'' where id = %L', :'ana'),
  'Ana SÍ puede editar sus propios datos personales'
);

-- =============================================================================
-- ESCRITURA DIRECTA DE CITAS
--
-- Las citas solo se modifican por las funciones de transición. Ni siquiera
-- sobre su propia cita puede el paciente escribir directamente.
-- =============================================================================
select throws_ok(
  'update public.appointments set status = ''confirmada''',
  '42501',
  null,
  'Un paciente no puede hacer UPDATE directo sobre una cita'
);

select throws_ok(
  format(
    'insert into public.appointments (patient_id, professional_id, starts_at, ends_at, status, created_by)
     values (%L, %L, now() + interval ''3 days'', now() + interval ''3 days 1 hour'', ''confirmada'', %L)',
    :'ana', :'doctor', :'ana'
  ),
  '42501',
  null,
  'Un paciente no puede insertar una cita ya confirmada'
);

-- =============================================================================
-- AUTORIZACIÓN DE CITAS
--
-- El corazón del producto: el paciente pide, el profesional autoriza.
-- =============================================================================
select throws_ok(
  format('select public.confirmar_cita(%L)',
    (select id from public.appointments limit 1)),
  'P0001',
  'Solo el profesional puede confirmar citas.',
  'Un paciente no puede confirmar su propia cita'
);

-- =============================================================================
-- EL PROFESIONAL SÍ VE TODO
-- =============================================================================
select tests_como(:'doctor');

select is(
  (select count(*)::int from public.appointments),
  2,
  'El profesional ve las citas de todos sus pacientes'
);

select is(
  (select count(*)::int from public.profiles),
  3,
  'El profesional ve todos los perfiles'
);

select * from finish();
rollback;
