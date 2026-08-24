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

select plan(18);

-- Las dos tablas de usos van PRIMERO, y por delante de `auth.users`.
--
-- Se quedaron fuera de este preámbulo cuando la migración 0053 las creó, y el
-- fallo estuvo escondido todo este tiempo: `ticket_orders.solicitada_por`
-- apunta a `profiles` sin cascada, así que borrar usuarios revienta en cuanto
-- exista UNA solicitud. Con la base recién sembrada no hay ninguna, y solo la
-- suite de extremo a extremo las crea — de ahí que estos ficheros pasaran
-- solos y fallaran después de correr Playwright.
--
-- El libro mayor antes que las órdenes: apunta a ellas.
delete from public.ticket_ledger;
delete from public.ticket_orders;

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

/*
 * Y TAMPOCO ve la evaluación misma desde su cuenta.
 *
 * Antes sí: si su ficha de empleado estaba enlazada a su cuenta, la prueba que
 * le encargó una empresa le aparecía en su espacio privado. No es suya en ese
 * sentido —la pidió otro y el informe va a otro—, y mezclarla con su historia
 * personal confunde dos cosas que el resto del sistema separa con cuidado.
 *
 * Llega a ella por su pase, que es donde sí ve el instrumento y qué empresa la
 * encargó (`pase_evaluacion.test.sql`).
 */
select is(
  (select count(*)::int from public.assignments),
  0,
  'La evaluación que encarga una empresa no aparece en el perfil de nadie'
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

/*
 * Saber quién te evalúa y con qué sigue siendo lo mínimo, pero se ve por el
 * PASE y no por la cuenta: `evaluacion_de_pase` devuelve el instrumento y la
 * empresa antes de que la persona responda nada.
 *
 * Desde la sesión no se ve, y es coherente: si la asignación no es visible,
 * tampoco tiene por qué serlo el catálogo ni la organización que la pidió.
 */
select is(
  (select count(*)::int from public.assessments),
  0,
  'Sin asignación visible, tampoco ve el catálogo desde su cuenta'
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

/*
 * Los ítems tampoco llegan por la cuenta.
 *
 * Antes, con la prueba en curso, el evaluado registrado los veía desde su
 * sesión. Ahora responde por su pase y `preguntas_de_pase` se los da: la
 * cuenta deja de ser un segundo camino hacia la misma prueba.
 */
select is(
  (select count(*)::int from public.assessment_items),
  0,
  'Ni con la prueba en curso: los ítems llegan por el pase, no por la cuenta'
);

select tests_servidor_e();
update public.assignments set status = 'publicada' where id = :'asignacion';

-- =============================================================================
-- PUBLICADO: LOS DOS DESTINATARIOS, A LA VEZ
-- =============================================================================
select tests_como(:'evaluado');

/*
 * Publicado, su informe le llega por el PASE.
 *
 * El consentimiento le promete que lo recibe, así que quitar el acceso por
 * cuenta sin poner otro habría dejado el documento mintiendo. `informe_de_pase`
 * es ese otro camino, y solo devuelve lo publicado.
 */
select is(
  (select count(*)::int from public.results),
  0,
  'Desde su cuenta sigue sin ver nada: la evaluación no es de su perfil'
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

-- Y ve las ETIQUETAS, que es lo que hace legible el informe: sin ellas llega
-- una lista de claves —«D», «cuadrante_a»— sin nada que diga qué son.
select is(
  (select count(*)::int from public.assessment_parameters),
  1,
  'La empresa ve los parámetros del informe que encargó'
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
