-- =============================================================================
-- Pruebas de aislamiento entre organizaciones
--
-- SPEC.md §9.2 · PLAN.md §5.4
--
-- Estas son ahora las pruebas más importantes del proyecto, por encima incluso
-- de las de aislamiento entre pacientes. El dato que protegen es el resultado
-- psicológico de una persona identificada, y quien no debe verlo no es un
-- curioso cualquiera: es otra empresa cliente de la misma plataforma.
--
-- Como en rls.test.sql, no basta con leer las políticas. Hay que ponerse en el
-- lugar de quien intenta el acceso indebido y comprobar que la base lo niega.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(12);

-- Punto de partida limpio. Todo ocurre dentro de la transacción que se revierte
-- al final, así que la siembra sobrevive intacta.
delete from public.appointment_changes;
delete from public.appointment_attendees;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

-- -----------------------------------------------------------------------------
-- Fixtures: dos empresas rivales, un empleado en cada una, un paciente suelto
-- -----------------------------------------------------------------------------
\set acme    'aaaa0000-0000-4000-8000-000000000001'
\set globex  'bbbb0000-0000-4000-8000-000000000002'

\set jefe_acme    'aaaa1111-0000-4000-8000-000000000001'
\set emp_acme     'aaaa2222-0000-4000-8000-000000000002'
\set jefe_globex  'bbbb1111-0000-4000-8000-000000000003'
\set emp_globex   'bbbb2222-0000-4000-8000-000000000004'
\set paciente     'cccc0000-0000-4000-8000-000000000005'
\set doctor       'dddd0000-0000-4000-8000-000000000006'

insert into public.organizations (id, nombre) values
  (:'acme',   'Acme S.A.S'),
  (:'globex', 'Globex Ltda');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',    '', now(), now()),
  (:'emp_acme',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp@acme.test',     '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test',  '', now(), now()),
  (:'emp_globex',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp@globex.test',   '', now(), now()),
  (:'paciente',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'paciente@ej.test',  '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',    '', now(), now());

-- Roles y pertenencias: se asignan con privilegios de servidor, nunca por
-- interfaz. Es exactamente lo que las pruebas de más abajo comprueban que un
-- usuario no puede hacerse a sí mismo.
update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa',  organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empleado', organization_id = :'acme'   where id = :'emp_acme';
update public.profiles set role = 'empresa',  organization_id = :'globex' where id = :'jefe_globex';
update public.profiles set role = 'empleado', organization_id = :'globex' where id = :'emp_globex';

-- Una cita de evaluación por empresa, y una individual del paciente.
insert into public.appointments (id, organization_id, professional_id, starts_at, ends_at, status, created_by)
values
  ('11111111-0000-4000-8000-000000000001', :'acme',   :'doctor', now() + interval '7 days', now() + interval '7 days 2 hours', 'confirmada', :'jefe_acme'),
  ('22222222-0000-4000-8000-000000000002', :'globex', :'doctor', now() + interval '9 days', now() + interval '9 days 2 hours', 'confirmada', :'jefe_globex');

insert into public.appointments (patient_id, professional_id, starts_at, ends_at, status, created_by)
values (:'paciente', :'doctor', now() + interval '11 days', now() + interval '11 days 1 hour', 'confirmada', :'doctor');

insert into public.appointment_attendees (appointment_id, profile_id) values
  ('11111111-0000-4000-8000-000000000001', :'emp_acme'),
  ('22222222-0000-4000-8000-000000000002', :'emp_globex');

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- =============================================================================
-- UNA EMPRESA NO VE A LA OTRA
-- =============================================================================
select tests_como(:'jefe_acme');

select is(
  (select count(*)::int from public.appointments),
  1,
  'Acme ve exactamente una cita: la que contrató'
);

select is(
  (select count(*)::int from public.appointments where organization_id = :'globex'),
  0,
  'Acme NO puede leer las citas de Globex'
);

select is(
  (select count(*)::int from public.organizations),
  1,
  'Acme solo ve su propia organización'
);

select is(
  (select count(*)::int from public.appointment_attendees),
  1,
  'Acme ve a sus convocados, y solo a los suyos'
);

-- Una cita individual de un paciente no es asunto de ninguna empresa.
select is(
  (select count(*)::int from public.appointments where patient_id is not null),
  0,
  'Una empresa NO ve las citas individuales de los pacientes'
);

-- =============================================================================
-- ESCALADA DE ORGANIZACIÓN
--
-- El equivalente corporativo de concederse el rol de profesional: cambiarse de
-- empresa para leer los informes de sus empleados.
-- =============================================================================
select throws_ok(
  format('update public.profiles set organization_id = %L where id = %L', :'globex', :'jefe_acme'),
  '42501',
  null,
  'Un usuario NO puede cambiarse de organización'
);

select throws_ok(
  format('update public.profiles set role = ''profesional'' where id = %L', :'jefe_acme'),
  '42501',
  null,
  'Una empresa tampoco puede concederse el rol de profesional'
);

-- =============================================================================
-- EL EMPLEADO
-- =============================================================================
select tests_como(:'emp_acme');

select is(
  (select count(*)::int from public.appointments),
  1,
  'El empleado ve la cita a la que fue convocado'
);

select is(
  (select count(*)::int from public.appointments where organization_id = :'globex'),
  0,
  'El empleado NO ve las citas de otra empresa'
);

-- Ve su propia convocatoria, pero no la lista de sus compañeros: eso es cosa
-- de la empresa y del profesional.
select is(
  (select count(*)::int from public.appointment_attendees),
  1,
  'El empleado solo se ve a sí mismo en la lista de convocados'
);

-- =============================================================================
-- EL PACIENTE INDIVIDUAL SIGUE AISLADO
-- =============================================================================
select tests_como(:'paciente');

select is(
  (select count(*)::int from public.appointments),
  1,
  'El paciente individual sigue viendo solo su cita'
);

-- =============================================================================
-- EL PROFESIONAL VE TODO
-- =============================================================================
select tests_como(:'doctor');

select is(
  (select count(*)::int from public.appointments),
  3,
  'El profesional ve las tres citas: las dos corporativas y la individual'
);

select * from finish();
rollback;
