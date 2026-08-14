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

select plan(22);

-- Punto de partida limpio. Todo ocurre dentro de la transacción que se revierte
-- al final, así que la siembra sobrevive intacta.
delete from public.appointment_changes;
delete from public.appointment_attendees;
delete from public.organization_people;
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
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

-- Los evaluados NO cambian de rol ni «pertenecen» a nadie: siguen siendo
-- personas con cuenta propia. Su vínculo con la empresa es la fila del listado.
insert into public.organization_people (id, organization_id, nombre, documento, email, profile_id) values
  ('eeee1111-0000-4000-8000-000000000001', :'acme',   'Empleado Acme',   '1047373301', 'emp@acme.test',    :'emp_acme'),
  ('eeee2222-0000-4000-8000-000000000002', :'globex', 'Empleado Globex', '1047462262', 'emp@globex.test',  :'emp_globex'),
  -- Una persona cargada que todavía no aceptó su invitación: sin cuenta.
  ('eeee3333-0000-4000-8000-000000000003', :'acme',   'Sin Cuenta Aún',  '1099887766', 'futuro@acme.test', null),
  -- EL CASO QUE IMPORTA: la misma persona que ya evaluó Acme, ahora cargada
  -- por Globex porque quiere contratarla. MISMA CÉDULA, otro correo —el
  -- personal en vez del corporativo—, que es justo como ocurre en la vida real.
  ('eeee4444-0000-4000-8000-000000000004', :'globex', 'Empleado Acme',   '1047373301', 'personal@gmail.test', :'emp_acme');

-- Una cita de evaluación por empresa, y una individual del paciente.
insert into public.appointments (id, organization_id, professional_id, starts_at, ends_at, status, created_by)
values
  ('11111111-0000-4000-8000-000000000001', :'acme',   :'doctor', now() + interval '7 days', now() + interval '7 days 2 hours', 'confirmada', :'jefe_acme'),
  ('22222222-0000-4000-8000-000000000002', :'globex', :'doctor', now() + interval '9 days', now() + interval '9 days 2 hours', 'confirmada', :'jefe_globex');

insert into public.appointments (patient_id, professional_id, starts_at, ends_at, status, created_by)
values (:'paciente', :'doctor', now() + interval '11 days', now() + interval '11 days 1 hour', 'confirmada', :'doctor');

insert into public.appointment_attendees (appointment_id, person_id) values
  ('11111111-0000-4000-8000-000000000001', 'eeee1111-0000-4000-8000-000000000001'),
  -- Se puede convocar a quien aún no tiene cuenta: ese es el punto del listado.
  ('11111111-0000-4000-8000-000000000001', 'eeee3333-0000-4000-8000-000000000003'),
  ('22222222-0000-4000-8000-000000000002', 'eeee2222-0000-4000-8000-000000000002'),
  ('22222222-0000-4000-8000-000000000002', 'eeee4444-0000-4000-8000-000000000004');

-- La cédula, y no el correo, es lo que impide duplicar a una persona dentro de
-- una misma empresa: con otro correo pasaría desapercibida. Se comprueba aquí,
-- durante el montaje, porque más abajo ya no hay privilegios de escritura.
select throws_ok(
  format(
    'insert into public.organization_people (organization_id, nombre, documento, email)
     values (%L, ''Duplicado'', ''1047373301'', ''otro@acme.test'')', :'acme'
  ),
  '23505',
  null,
  'No se puede cargar dos veces la misma cédula en una empresa, aunque cambie el correo'
);

-- Pero la misma cédula SÍ puede estar en dos empresas distintas: es la misma
-- persona, evaluada por las dos.
select lives_ok(
  format(
    'insert into public.organization_people (organization_id, nombre, documento, email)
     values (%L, ''Mismo'', ''1099887766'', ''otro@globex.test'')', :'globex'
  ),
  'La misma cédula sí puede aparecer en dos empresas distintas'
);

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
  2,
  'Acme ve a sus dos convocados, incluido el que aún no tiene cuenta'
);

-- Acme cargó dos personas; la tercera del fixture es de Globex.
select is(
  (select count(*)::int from public.organization_people),
  2,
  'Acme ve su listado completo, y NADA del listado de Globex'
);

-- Una cita individual de un paciente no es asunto de ninguna empresa.
select is(
  (select count(*)::int from public.appointments where patient_id is not null),
  0,
  'Una empresa NO ve las citas individuales de los pacientes'
);

-- Las escrituras pasan por funciones, siempre. Ni siquiera sobre su propio
-- listado puede una empresa insertar a mano.
select throws_ok(
  format(
    'insert into public.organization_people (organization_id, nombre, documento, email)
     values (%L, ''A Mano'', ''123'', ''amano@acme.test'')', :'acme'
  ),
  '42501',
  null,
  'Una empresa no puede escribir directamente en su listado'
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
-- LA MISMA PERSONA, EVALUADA POR DOS EMPRESAS
--
-- El caso que decide si el modelo sirve: Acme evaluó a alguien; tiempo después
-- Globex quiere contratar a esa misma persona y encarga su propia evaluación.
--
-- Globex debe ver LO QUE ENCARGÓ, y nada de lo anterior. Y Acme no debe
-- enterarse de que su antiguo evaluado está en un proceso con la competencia,
-- que es la filtración menos obvia y la más dañina para la persona.
-- =============================================================================
select tests_como(:'jefe_globex');

select is(
  (select count(*)::int from public.appointments),
  1,
  'Globex ve solo la cita que encargó, aunque la persona ya fuera evaluada antes'
);

select is(
  (select count(*)::int from public.organization_people where organization_id = :'acme'),
  0,
  'Globex NO ve la ficha que Acme tiene de esa misma persona'
);

select is(
  (select count(*)::int from public.appointment_attendees),
  2,
  'Globex ve a los convocados de SU sesión, y solo esos'
);

-- La otra dirección, que es la que protege a la persona.
select tests_como(:'jefe_acme');

select is(
  (select count(*)::int from public.appointments where organization_id = :'globex'),
  0,
  'Acme NO se entera de que su evaluado está en un proceso con Globex'
);

select is(
  (select count(*)::int from public.organization_people where organization_id = :'globex'),
  0,
  'Acme NO ve la ficha que Globex creó de esa misma persona'
);

-- =============================================================================
-- LA PERSONA, QUE ES LA ÚNICA QUE VE TODO LO SUYO
-- =============================================================================
select tests_como(:'emp_acme');

select is(
  (select count(*)::int from public.appointments),
  2,
  'La persona ve sus dos citas: la de Acme y la de Globex'
);

select is(
  (select count(*)::int from public.organization_people),
  2,
  'La persona ve las dos fichas que existen de ella, una por empresa'
);

select is(
  (select count(*)::int from public.appointment_attendees),
  2,
  'La persona se ve a sí misma en las dos convocatorias, y a nadie más'
);

select is(
  (select count(*)::int from public.organization_people where profile_id is null),
  0,
  'La persona no ve fichas de terceros, ni de quienes aún no tienen cuenta'
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
