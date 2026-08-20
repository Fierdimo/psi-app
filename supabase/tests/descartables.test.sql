-- =============================================================================
-- Las evaluaciones de empresa son descartables
--
-- Tres reglas que salen de la misma idea: la evaluación que encarga una
-- empresa vive atada a ESA convocatoria, no a la persona ni a su cuenta.
--
--  1. No aparece en el perfil de quien sí tiene cuenta.
--  2. Dos empresas pueden convocar a la misma persona a la vez, y cada pase
--     abre la evaluación de SU empresa.
--  3. La misma persona puede repetir el mismo instrumento para otra empresa.
--
-- La segunda es la que importa de verdad: antes el pase resolvía a «la
-- evaluación viva más reciente» y el enlace de una empresa abría la prueba de
-- la otra, con el informe saliendo hacia quien no era.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(7);

delete from public.responses;
delete from public.assignments;
delete from public.appointment_changes;
delete from public.invitations;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set acme    'aaaa0000-0000-4000-8000-000000000d01'
\set globex  'bbbb0000-0000-4000-8000-000000000d02'
\set jefe_a  'aaaa1111-0000-4000-8000-000000000d03'
\set jefe_g  'bbbb1111-0000-4000-8000-000000000d04'
\set persona 'cccc1111-0000-4000-8000-000000000d05'
\set doctor  'dddd1111-0000-4000-8000-000000000d06'

insert into public.organizations (id, nombre, contacto_telefono) values
  (:'acme',   'Acme S.A.S',  '3001112233'),
  (:'globex', 'Globex Ltda', '3004445566');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_a',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',  '', now(), now()),
  (:'jefe_g',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test','', now(), now()),
  (:'persona', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dora@ej.test',    '', now(), now()),
  (:'doctor',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doc@ej.test',     '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_a';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_g';

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- La misma persona, cargada por las dos empresas, y CON cuenta.
select tests_como(:'jefe_a');
select public.cargar_personas('[{"documento":"555","nombre":"Dora","email":"dora@ej.test"}]'::jsonb);
select public.solicitar_cita_evaluacion(
  now() + interval '5 days', now() + interval '5 days 2 hours',
  array(select id from public.organization_people where organization_id = :'acme')
);

select tests_como(:'jefe_g');
select public.cargar_personas('[{"documento":"555","nombre":"Dora","email":"dora@ej.test"}]'::jsonb);
select public.solicitar_cita_evaluacion(
  now() + interval '6 days', now() + interval '6 days 2 hours',
  array(select id from public.organization_people where organization_id = :'globex')
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

-- Las dos fichas enlazadas a la misma cuenta: es la misma persona.
update public.organization_people set profile_id = :'persona' where documento = '555';

select id as cita_a from public.appointments where organization_id = :'acme'   \gset
select id as cita_g from public.appointments where organization_id = :'globex' \gset

select tests_como(:'doctor');
select public.confirmar_cita(:'cita_a');
select public.confirmar_cita(:'cita_g');
select public.asignar_evaluacion(:'cita_a',
  (select id from public.assessments where clave = 'disc_dominancia'));
select public.asignar_evaluacion(:'cita_g',
  (select id from public.assessments where clave = 'disc_dominancia'));

-- =============================================================================
-- 3 · EL MISMO EXAMEN, DOS VECES
-- =============================================================================
select set_config('role', 'postgres', true);

select is(
  (select count(*)::int from public.assignments),
  2,
  'La misma persona hace el mismo instrumento para dos empresas'
);

-- =============================================================================
-- 1 · NO APARECEN EN SU PERFIL
--
-- Tiene cuenta y las dos fichas están enlazadas a ella. Aun así, esas pruebas
-- no son suyas en el sentido de «mi historia»: las pidió otro y el informe va
-- a otro.
-- =============================================================================
select tests_como(:'persona');

select is(
  (select count(*)::int from public.assignments),
  0,
  'Quien tiene cuenta no ve en su perfil las evaluaciones que le encargó una empresa'
);

select is(
  (select public.mi_asignacion(id) from public.assignments limit 1),
  null,
  'Ni puede alcanzarlas por su propia cuenta'
);

-- =============================================================================
-- 2 · CADA PASE ABRE LO SUYO
-- =============================================================================
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.invitations),
  2,
  'Tener cuenta ya no deja a nadie sin pase: uno por convocatoria'
);

select token as pase_a from public.invitations where appointment_id = :'cita_a' \gset
select token as pase_g from public.invitations where appointment_id = :'cita_g' \gset

select id as asig_a from public.assignments where appointment_id = :'cita_a' \gset
select id as asig_g from public.assignments where appointment_id = :'cita_g' \gset

set role anon;

select is(
  (select assignment_id from public.evaluacion_de_pase(:'pase_a')),
  (:'asig_a')::uuid,
  'El pase de Acme abre la evaluación de Acme'
);

select is(
  (select assignment_id from public.evaluacion_de_pase(:'pase_g')),
  (:'asig_g')::uuid,
  'Y el de Globex, la de Globex'
);

select isnt(
  (select assignment_id from public.evaluacion_de_pase(:'pase_a')),
  (:'asig_g')::uuid,
  'Nunca la de la otra empresa, que era el fallo'
);

reset role;

select finish();

rollback;
