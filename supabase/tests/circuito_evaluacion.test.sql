-- =============================================================================
-- El circuito de una evaluación, de punta a punta
--
-- SPEC.md §9.2
--
-- Las pruebas de `evaluaciones.test.sql` comprueban QUIÉN VE qué. Estas
-- comprueban QUIÉN PUEDE HACER qué, y desde qué estado: que nadie se salte un
-- paso, que el consentimiento sea un candado de verdad y que publicar sea un
-- acto aparte de calificar.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(23);

delete from public.consents;
delete from public.result_values;
delete from public.results;
delete from public.responses;
delete from public.assignments;
delete from public.assessment_items;
delete from public.assessment_parameters;
delete from public.assessment_texts;
delete from public.assessments;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointment_changes;
delete from public.appointments;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set org      'aaaa0000-0000-4000-8000-0000000000c1'
\set jefe     'aaaa1111-0000-4000-8000-0000000000c2'
\set ana      'cccc1111-0000-4000-8000-0000000000c3'
\set otro     'cccc2222-0000-4000-8000-0000000000c4'
\set doctor   'dddd1111-0000-4000-8000-0000000000c5'
\set persona  'ffff2222-0000-4000-8000-0000000000c6'
\set cita     'eeee0000-0000-4000-8000-0000000000c7'
\set prueba   'ffff0000-0000-4000-8000-0000000000c8'
\set item     'ffff1111-0000-4000-8000-0000000000c9'

insert into public.organizations (id, nombre) values (:'org', 'Acme S.A.S');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',  '', now(), now()),
  (:'ana',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@ej.test',     '', now(), now()),
  (:'otro',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'otro@ej.test',    '', now(), now()),
  (:'doctor', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',  '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'org' where id = :'jefe';

insert into public.organization_people (id, organization_id, documento, nombre, email, profile_id)
values (:'persona', :'org', '5550001', 'Ana', 'ana@acme.test', :'ana');

insert into public.appointments
  (id, organization_id, professional_id, created_by, starts_at, ends_at, status, modality)
values (:'cita', :'org', :'doctor', :'jefe', now() + interval '2 days',
        now() + interval '2 days 2 hours', 'confirmada', 'presencial');

insert into public.appointment_attendees (appointment_id, person_id)
values (:'cita', :'persona');

insert into public.assessments (id, clave, nombre, motor)
values (:'prueba', 'lab', 'Laboratorio', 'lab');

insert into public.assessment_items (id, assessment_id, posicion, tipo, enunciado, opciones)
values (:'item', :'prueba', 1, 'forced_choice', 'Bloque 1',
        '[{"id":"a","texto":"Uno","escala":"D"}]'::jsonb);

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- =============================================================================
-- ASIGNAR: un acto para toda la sesión, y solo del profesional
-- =============================================================================
select tests_como(:'jefe');

select throws_ok(
  format('select public.asignar_evaluacion(%L, %L)', :'cita', :'prueba'),
  'Solo el profesional asigna evaluaciones.',
  'La empresa NO elige qué instrumento se aplica a su gente'
);

select tests_como(:'ana');

select throws_ok(
  format('select public.asignar_evaluacion(%L, %L)', :'cita', :'prueba'),
  'Solo el profesional asigna evaluaciones.',
  'Ni la persona evaluada'
);

select tests_como(:'doctor');

select is(
  (select public.asignar_evaluacion(:'cita', :'prueba')),
  1,
  'El profesional asigna una vez y alcanza a todos los convocados'
);

\set asig '(select id from public.assignments limit 1)'

-- =============================================================================
-- EL CONSENTIMIENTO ES UN CANDADO, NO UN AVISO
-- =============================================================================
select throws_ok(
  format('select public.habilitar_examen((select id from public.assignments limit 1))'),
  'Esa persona no ha aceptado esta evaluación.',
  'Sin consentimiento el profesional NO puede abrir el examen'
);

select tests_como(:'otro');

select throws_ok(
  'select public.consentir_evaluacion((select id from public.assignments limit 1), ''aceptado'')',
  'Solo la persona evaluada decide sobre su evaluación.',
  'Un tercero no consiente por nadie'
);

select tests_como(:'jefe');

select throws_ok(
  'select public.consentir_evaluacion((select id from public.assignments limit 1), ''aceptado'')',
  'Solo la persona evaluada decide sobre su evaluación.',
  'Y la empresa que la encargó, tampoco'
);

-- =============================================================================
-- NEGARSE, Y PODER CAMBIAR DE IDEA
-- =============================================================================
select tests_como(:'ana');

select lives_ok(
  'select public.consentir_evaluacion((select id from public.assignments limit 1), ''rechazado'')',
  'La persona puede negarse'
);

select is(
  public.consentimiento_de((select id from public.assignments limit 1)),
  'rechazado',
  'Y su negativa queda registrada'
);

select tests_como(:'doctor');

select throws_ok(
  'select public.habilitar_examen((select id from public.assignments limit 1))',
  'Esa persona no ha aceptado esta evaluación.',
  'Con un rechazo vigente, el examen sigue cerrado'
);

-- Se lo piensa y vuelve. Esto es lo que pidió el cliente: negarse no es una
-- puerta que se cierra.
select tests_como(:'ana');

select lives_ok(
  'select public.consentir_evaluacion((select id from public.assignments limit 1), ''aceptado'')',
  'Quien rechazó puede aceptar después, sin pedirle nada a nadie'
);

select is(
  public.consentimiento_de((select id from public.assignments limit 1)),
  'aceptado',
  'Manda la ÚLTIMA decisión, no la primera'
);

select is(
  (select count(*)::int from public.consents),
  2,
  'Y el rechazo se conserva: que constara que pudo negarse es lo que hace válido que aceptara'
);

-- =============================================================================
-- NADIE EMPIEZA SOLO
-- =============================================================================
select throws_ok(
  'select public.iniciar_prueba((select id from public.assignments limit 1))',
  'Esta evaluación todavía no está abierta.',
  'Con consentimiento pero sin que el profesional la abra, no se empieza'
);

select tests_como(:'doctor');
select lives_ok(
  'select public.habilitar_examen((select id from public.assignments limit 1))',
  'El profesional la abre durante la sesión'
);

select tests_como(:'ana');
select lives_ok(
  'select public.iniciar_prueba((select id from public.assignments limit 1))',
  'Y ahora sí empieza'
);

select lives_ok(
  format('select public.responder((select id from public.assignments limit 1), %L, ''{"mas":"a"}''::jsonb)', :'item'),
  'Responde, y cada respuesta se guarda al momento'
);

select tests_como(:'otro');

select throws_ok(
  format('select public.responder((select id from public.assignments limit 1), %L, ''{"mas":"a"}''::jsonb)', :'item'),
  'Esa evaluación no es tuya.',
  'Nadie responde la prueba de otra persona'
);

-- =============================================================================
-- CALIFICAR Y PUBLICAR SON DOS ACTOS
-- =============================================================================
select tests_como(:'ana');
select lives_ok(
  'select public.enviar_prueba((select id from public.assignments limit 1))',
  'La persona termina y envía'
);

select tests_como(:'doctor');

select throws_ok(
  'select public.publicar_resultado((select id from public.assignments limit 1))',
  'Ese informe no está calificado todavía.',
  'No se publica lo que no se ha calificado'
);

select lives_ok(
  'select public.calificar_evaluacion((select id from public.assignments limit 1), ''[{"parameter_key":"D","valor":3,"sugerido":"Texto"}]''::jsonb)',
  'Se califica'
);

select is(
  (select status::text from public.assignments limit 1),
  'calificada',
  'Y queda CALIFICADA, que no es publicada: nadie la ve todavía'
);

-- =============================================================================
-- RETIRAR EL CONSENTIMIENTO DETIENE EL INFORME
-- =============================================================================
select tests_como(:'ana');
select lives_ok(
  'select public.consentir_evaluacion((select id from public.assignments limit 1), ''rechazado'')',
  'La persona retira su consentimiento después de responder'
);

select tests_como(:'doctor');

select throws_ok(
  'select public.publicar_resultado((select id from public.assignments limit 1))',
  'Esa persona retiró su consentimiento.',
  'Y el informe NO se publica: el texto que firmó promete justo eso'
);

select * from finish();
rollback;
