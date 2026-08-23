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

select plan(38);

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
/*
 * Los pacientes, con su rol PUESTO A MANO.
 *
 * Desde la migración 0058 toda cuenta nueva nace como empresa: es lo que hace
 * cierto que el alta pública sea solo de empresas. Estas fixtures se apoyaban
 * en el rol por defecto, así que se lo devuelven explícitamente — igual que ya
 * hacían con el del profesional.
 */
update public.profiles set role = 'paciente'
where id in (:'paciente', :'emp_acme', :'emp_globex');

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

-- LA CÉDULA DEJÓ DE IMPEDIR NADA (migración 0054).
--
-- Hasta el giro a evaluaciones descartables, esta comprobación era la
-- contraria: la misma cédula dos veces en una empresa daba 23505. Aquella
-- regla existía para poder reconocer a una persona entre empresas y enlazarla
-- a su cuenta. Ya no hay cuentas que enlazar —quien responde no es usuario de
-- la plataforma— y la regla estorbaba al caso real: la misma persona evaluada
-- dos veces por la misma empresa, en enero como aspirante y en junio como
-- empleada, son dos evaluaciones con dos informes.
--
-- Se comprueba aquí, durante el montaje, porque más abajo ya no hay
-- privilegios de escritura.
select lives_ok(
  format(
    'insert into public.organization_people (organization_id, nombre, documento, email)
     values (%L, ''Repetida'', ''1047373301'', ''otro@acme.test'')', :'acme'
  ),
  'La misma cédula puede repetirse en una empresa: cada ficha es de una evaluación'
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

/** Vuelve al rol de servidor para mover el estado entre comprobaciones. */
create or replace function tests_servidor_o() returns void
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

-- Tres fichas de Acme —dos del fixture más la repetida de arriba—; las de
-- Globex no se cuentan, que es lo que esta comprobación persigue.
select is(
  (select count(*)::int from public.organization_people),
  3,
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

/*
 * Antes esto se decía filtrando por `profile_id`, que ya no se concede: esa
 * columna revelaría quién tiene cuenta, y una empresa no debe poder deducirlo.
 * La afirmación es la misma —de todo lo que ve, nada es de otra persona— y se
 * puede comprobar por el documento, que sí es suyo.
 */
select is(
  (select count(*)::int from public.organization_people
   where documento <> '1047373301'),
  0,
  'De todo lo que ve, nada es la ficha de otra persona'
);

-- El identificador se apunta como servidor: `profile_id` ya no se concede a
-- las cuentas, así que la propia prueba no puede filtrarlo por su cuenta.
select tests_servidor_o();
select id as ficha_enlazada from public.organization_people
where organization_id = :'acme' and profile_id is not null limit 1 \gset

-- =============================================================================
-- UNA CUENTA DE EMPRESA NO PIDE CONSULTAS INDIVIDUALES
--
-- `solicitar_cita` nunca miró quién la llamaba. Sin esta comprobación, una
-- cuenta de empresa se pedía a sí misma una cita individual y esa cita
-- aparecía en la agenda con un «paciente» que no figura en el listado de
-- pacientes, porque ese listado filtra por rol.
-- =============================================================================
select tests_como(:'jefe_acme');

select throws_ok(
  'select public.solicitar_cita(now() + interval ''30 days'', now() + interval ''30 days 1 hour'')',
  'P0001',
  'Una cuenta de empresa no solicita consultas individuales.',
  'Una cuenta de empresa NO puede pedirse una consulta individual'
);

-- La persona evaluada por una empresa sí puede: su cuenta es suya, y es
-- exactamente el cruce que el negocio quiere explotar.
select tests_como(:'emp_acme');

select lives_ok(
  'select public.solicitar_cita(now() + interval ''30 days'', now() + interval ''30 days 1 hour'')',
  'Quien fue evaluado por una empresa SÍ puede pedir su propia consulta individual'
);

-- =============================================================================
-- QUIÉN PUEDE CANCELAR UNA CITA CORPORATIVA
--
-- Al volver `patient_id` nulable apareció un agujero silencioso en
-- `cancelar_cita`: comprobaba la propiedad con `patient_id = auth.uid()`, que
-- en una cita corporativa da NULL. Y `not NULL and not is_professional()` es
-- NULL, así que el IF no se cumplía, la excepción no se lanzaba y la
-- cancelación seguía adelante. Cualquier usuario con sesión podía cancelar la
-- evaluación de una empresa que no conoce.
--
-- Comparar con NULL nunca es falso: es NULL, y eso no detiene a nadie.
-- =============================================================================
select tests_como(:'paciente');

select throws_ok(
  'select public.cancelar_cita(''11111111-0000-4000-8000-000000000001'')',
  'P0001',
  'No puedes cancelar una cita que no es tuya.',
  'Un desconocido NO puede cancelar la cita corporativa de una empresa'
);

select tests_como(:'jefe_globex');

select throws_ok(
  'select public.cancelar_cita(''11111111-0000-4000-8000-000000000001'')',
  'P0001',
  'No puedes cancelar una cita que no es tuya.',
  'Una empresa NO puede cancelar la cita que encargó otra'
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
  4,
  'El profesional ve las cuatro: dos corporativas y dos individuales, una de '
  'ellas pedida por alguien a quien ya evaluó una empresa'
);

-- =============================================================================
-- UNA FECHA SIN CONFIRMAR NO ES ASUNTO DE LA PERSONA CONVOCADA
--
-- Es la negociación entre su empresa y el profesional: puede cambiar o no
-- ocurrir. Verla le hace apuntarse un día que quizá nadie le pidió.
-- =============================================================================
select tests_servidor_o();
update public.appointments set status = 'solicitada'
where organization_id is not null;

select tests_como(:'emp_acme');

select is(
  (select count(*)::int from public.appointments where organization_id is not null),
  0,
  'Sin confirmar, la persona convocada NO ve la sesión'
);

select tests_servidor_o();
update public.appointments set status = 'confirmada'
where organization_id is not null;

select tests_como(:'emp_acme');

select is(
  (select count(*)::int from public.appointments where organization_id is not null),
  2,
  'Confirmadas sí: sus dos sesiones, la de cada empresa que la convocó'
);

-- =============================================================================
-- LA EMPRESA CORRIGE LO SUYO, Y SOLO MIENTRAS NO HAYA CONSECUENCIAS
-- =============================================================================
select tests_como(:'jefe_acme');

select lives_ok(
  format('select public.editar_persona(%L, ''Ana'', ''Restrepo'', ''ana@acme.test'', %L, ''Jefa de bodega'', ''empleado'')',
         (select id from public.organization_people where organization_id = :'acme' order by documento limit 1),
         (select documento from public.organization_people where organization_id = :'acme' order by documento limit 1)),
  'Corrige los datos de alguien de su listado'
);

-- Y el documento de quien ya tiene cuenta NO se toca: es lo que la identifica
-- y lo que enlaza el historial que otra empresa haya dejado antes.
select throws_ok(
  format('select public.editar_persona(%L, ''Ana'', ''Restrepo'', ''ana@acme.test'', ''0000000'', null, ''empleado'')',
         :'ficha_enlazada'),
  'No se puede cambiar el documento de alguien que ya activó su cuenta.',
  'Cambiarle el documento a quien ya activó su cuenta la convertiría en otra persona'
);

select tests_como(:'jefe_globex');

select throws_ok(
  format('select public.editar_persona(%L, ''X'', ''X'', ''x@x.test'', ''999'', null, ''aspirante'')',
         (select id from public.organization_people where organization_id = :'acme' limit 1)),
  'Esa persona no está en tu listado.',
  'Pero no toca el listado de otra empresa'
);

select tests_como(:'jefe_acme');

select throws_ok(
  format('select public.quitar_persona(%L)',
         (select p.id from public.organization_people p
          join public.appointment_attendees a on a.person_id = p.id
          join public.appointments c on c.id = a.appointment_id
          where p.organization_id = :'acme' and c.status = 'confirmada' limit 1)),
  'Esa persona está convocada a una sesión ya confirmada.',
  'No se quita a alguien convocado a una sesión que ya va a ocurrir'
);

-- Una solicitud sin responder sí se corrige. Se crea una: las de la
-- preparación están confirmadas.
select tests_servidor_o();

insert into public.appointments
  (id, organization_id, professional_id, created_by, starts_at, ends_at, status, modality)
values ('cccc9999-0000-4000-8000-00000000abcd', :'acme', :'doctor', :'jefe_acme',
        now() + interval '15 days', now() + interval '15 days 2 hours',
        'solicitada', 'presencial');

select tests_como(:'jefe_acme');

select lives_ok(
  format('select public.editar_solicitud_evaluacion(%L, now() + interval ''20 days'', now() + interval ''20 days 2 hours'', ''presencial'', ''Sala 2'', ''Nueva nota'', array[%L]::uuid[])',
         'cccc9999-0000-4000-8000-00000000abcd'::uuid,
         (select id from public.organization_people where organization_id = :'acme' limit 1)),
  'Corrige su solicitud mientras el profesional no la haya respondido'
);

-- Una confirmada, no: la fecha ya es un compromiso de dos.
select throws_ok(
  format('select public.editar_solicitud_evaluacion(%L, now() + interval ''30 days'', now() + interval ''30 days 2 hours'', ''presencial'', null, null, array[%L]::uuid[])',
         (select id from public.appointments where organization_id = :'acme' and status = 'confirmada' limit 1),
         (select id from public.organization_people where organization_id = :'acme' limit 1)),
  'Esa solicitud ya no se puede editar.',
  'Confirmada ya no: cambiarla por detrás haría que alguien se presentara otro día'
);

select tests_como(:'emp_acme');

select throws_ok(
  format('select public.quitar_persona(%L)',
         (select id from public.organization_people where organization_id = :'acme' limit 1)),
  'Solo una empresa edita su listado.',
  'Y una persona evaluada no edita el listado de nadie'
);

-- =============================================================================
-- LA FICHA DE LA EMPRESA SE CORRIGE, PERO NO SE QUEDA SIN CONTACTO
-- =============================================================================
select tests_como(:'jefe_acme');

select lives_ok(
  'select public.actualizar_empresa(''Acme S.A.S'', ''900123'', ''Marta'', ''marta@acme.test'', null)',
  'Corrige los datos de su empresa'
);

select throws_ok(
  'select public.actualizar_empresa(''Acme S.A.S'', null, null, null, null)',
  'Deja al menos un correo o un teléfono de contacto.',
  'Pero no puede quedarse sin canal: es por donde se resuelve el trámite'
);

select tests_como(:'emp_acme');

select throws_ok(
  'select public.actualizar_empresa(''Mía'', null, null, ''x@x.test'', null)',
  'Solo una empresa edita sus datos.',
  'Y una persona evaluada no edita la ficha de la empresa que la convocó'
);

select * from finish();
rollback;
