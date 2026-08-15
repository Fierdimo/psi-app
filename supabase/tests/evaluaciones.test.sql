-- =============================================================================
-- Aislamiento del motor de evaluaciones
--
-- SPEC.md §9.2 · PLAN.md §5.5
--
-- Aquí se protege el dato más delicado de la plataforma: el resultado
-- psicológico de una persona identificada. Tres cosas que no pueden fallar:
--
--   1. Nadie ve un informe antes de que el profesional lo publique.
--   2. Una empresa ve lo que encargó y nada más.
--   3. El banco de ítems no se lo puede descargar cualquiera con cuenta.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(19);

delete from public.consents;
delete from public.result_values;
delete from public.results;
delete from public.responses;
delete from public.assignments;
delete from public.assessment_texts;
delete from public.assessment_parameters;
delete from public.assessment_items;
delete from public.assessments;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointment_changes;
delete from public.appointments;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set acme        'aaaa0000-0000-4000-8000-0000000000e1'
\set globex      'bbbb0000-0000-4000-8000-0000000000e2'
\set jefe_acme   'aaaa1111-0000-4000-8000-0000000000e3'
\set jefe_globex 'bbbb1111-0000-4000-8000-0000000000e4'
\set evaluado    'cccc1111-0000-4000-8000-0000000000e5'
\set ajeno       'cccc2222-0000-4000-8000-0000000000e6'
\set doctor      'dddd1111-0000-4000-8000-0000000000e7'

\set prueba      'ffff0000-0000-4000-8000-0000000000f1'
\set item1       'ffff1111-0000-4000-8000-0000000000f2'
\set persona     'ffff2222-0000-4000-8000-0000000000f3'
\set asignacion  'ffff3333-0000-4000-8000-0000000000f4'

insert into public.organizations (id, nombre) values
  (:'acme', 'Acme S.A.S'), (:'globex', 'Globex Ltda');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',   '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test', '', now(), now()),
  (:'evaluado',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'evaluado@ej.test', '', now(), now()),
  (:'ajeno',       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ajeno@ej.test',    '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',   '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

insert into public.organization_people (id, organization_id, documento, nombre, email, profile_id)
values (:'persona', :'acme', '5550001', 'Evaluado', 'evaluado@acme.test', :'evaluado');

insert into public.assessments (id, clave, nombre, motor)
values (:'prueba', 'laboratorio', 'Prueba de laboratorio', 'laboratorio');

insert into public.assessment_items (id, assessment_id, posicion, tipo, enunciado, opciones)
values (:'item1', :'prueba', 1, 'forced_choice', 'Elige la que más y la que menos te describe',
        '[{"id":"a","texto":"Entusiasta","escala":"I"},{"id":"b","texto":"Lógico","escala":"C"}]'::jsonb);

insert into public.assessment_parameters (assessment_id, clave, etiqueta, kind, posicion, seccion)
values (:'prueba', 'D', 'Dominancia', 'numerico', 1, 'disc');

insert into public.assignments
  (id, assessment_id, person_id, organization_id, status, assigned_by)
values (:'asignacion', :'prueba', :'persona', :'acme', 'calificada', :'doctor');

insert into public.responses (assignment_id, item_id, valor)
values (:'asignacion', :'item1', '{"mas":"a","menos":"b"}'::jsonb);

insert into public.results (assignment_id) values (:'asignacion');
insert into public.result_values (assignment_id, parameter_key, valor, sugerido)
values (:'asignacion', 'D', '3'::jsonb, 'Asertividad situacional baja.');

-- Vuelve al rol de servidor para mover el estado de la asignación entre
-- comprobaciones: las transiciones son cosa de las funciones, no de RLS.
create or replace function tests_servidor_e() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- =============================================================================
-- SIN PUBLICAR NO EXISTE PARA NADIE
--
-- La asignación está `calificada`: el sistema ya puntuó, pero el profesional
-- todavía no ha firmado. Es el momento en que un fallo haría más daño.
-- =============================================================================
select tests_como(:'evaluado');

select is(
  (select count(*)::int from public.results),
  0,
  'La persona NO ve su propio resultado antes de que se publique'
);

select is(
  (select count(*)::int from public.result_values),
  0,
  'Ni sus valores parámetro a parámetro'
);

select is(
  (select count(*)::int from public.assignments),
  1,
  'Pero SÍ ve que tiene una evaluación asignada, y en qué estado'
);

select tests_como(:'jefe_acme');

select is(
  (select count(*)::int from public.results),
  0,
  'La empresa que la encargó tampoco lo ve antes de publicarse'
);

-- =============================================================================
-- EL BANCO DE ÍTEMS NO SE DESCARGA
-- =============================================================================
select tests_como(:'ajeno');

select is(
  (select count(*)::int from public.assessment_items),
  0,
  'Alguien con cuenta pero sin asignación NO ve un solo ítem'
);

select tests_como(:'evaluado');

select is(
  (select count(*)::int from public.assessment_items),
  0,
  'Ni siquiera el evaluado, mientras su prueba no esté en curso'
);

select is(
  (select nombre from public.organizations),
  'Acme S.A.S',
  'El evaluado SÍ ve qué empresa pidió evaluarle: tiene derecho a saberlo'
);

select is(
  (select count(*)::int from public.assessments),
  1,
  'Pero SÍ ve el instrumento que le asignaron: saber a qué te sometes es lo mínimo'
);

select tests_como(:'ajeno');

select is(
  (select count(*)::int from public.assessments),
  0,
  'Quien no tiene ninguna asignación no ve el catálogo'
);

select tests_como(:'jefe_globex');

select is(
  (select count(*)::int from public.assessments),
  0,
  'Ni una empresa que no encargó nada con ese instrumento'
);

select tests_como(:'evaluado');

-- Solo mientras responde.
select tests_servidor_e();
update public.assignments set status = 'en_curso' where id = :'asignacion';
select tests_como(:'evaluado');

select is(
  (select count(*)::int from public.assessment_items),
  1,
  'Con la prueba EN CURSO sí ve sus ítems'
);

select tests_servidor_e();
update public.assignments set status = 'publicada' where id = :'asignacion';

-- =============================================================================
-- PUBLICADO: LOS DOS DESTINATARIOS, A LA VEZ
-- =============================================================================
select tests_como(:'evaluado');

select is(
  (select count(*)::int from public.results),
  1,
  'Publicado, la persona ve su informe'
);

select is(
  (select count(*)::int from public.result_values),
  1,
  'Y sus valores'
);

select tests_como(:'jefe_acme');

select is(
  (select count(*)::int from public.results),
  1,
  'Y la empresa que lo encargó, a la vez'
);

select is(
  (select count(*)::int from public.responses),
  0,
  'Pero la empresa NO ve la hoja de respuestas: contrató un informe'
);

-- =============================================================================
-- LA OTRA EMPRESA NO EXISTE PARA ESTE INFORME
-- =============================================================================
select tests_como(:'jefe_globex');

select is(
  (select count(*)::int from public.results),
  0,
  'Globex no ve un informe que encargó Acme'
);

select is(
  (select count(*)::int from public.assignments),
  0,
  'Ni se entera de que esa evaluación existe'
);

-- =============================================================================
-- QUIEN NO TIENE NADA QUE VER
-- =============================================================================
select tests_como(:'ajeno');

select is(
  (select count(*)::int from public.results),
  0,
  'Un tercero con cuenta no ve ningún informe'
);

-- =============================================================================
-- EL PROFESIONAL
-- =============================================================================
select tests_como(:'doctor');

select is(
  (select count(*)::int from public.responses),
  1,
  'El profesional ve las respuestas, que es lo que necesita para revisar'
);

select * from finish();
rollback;
