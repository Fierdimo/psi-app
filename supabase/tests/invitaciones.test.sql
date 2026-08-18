-- =============================================================================
-- Invitaciones
--
-- SPEC.md §9.2 · PLAN.md §5.4
--
-- Dos cosas se comprueban aquí. La primera es la higiene del testigo: que solo
-- exista en claro el rato del envío y que la tabla guarde su hash.
--
-- La segunda es el caso que da sentido a todo el modelo: quien YA tiene cuenta
-- —porque otra empresa lo evaluó antes— se enlaza a esa cuenta en vez de
-- terminar con dos y el historial partido en dos.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(19);

delete from public.appointment_changes;
delete from public.invitations;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set acme        'aaaa0000-0000-4000-8000-0000000000a1'
\set globex      'bbbb0000-0000-4000-8000-0000000000b1'
\set jefe_acme   'aaaa1111-0000-4000-8000-0000000000c1'
\set jefe_globex 'bbbb1111-0000-4000-8000-0000000000d1'
\set nuevo       'cccc1111-0000-4000-8000-0000000000e1'
\set otro        'cccc2222-0000-4000-8000-0000000000e2'
\set doctor      'dddd1111-0000-4000-8000-0000000000f1'

insert into public.organizations (id, nombre, contacto_telefono) values
  (:'acme',   'Acme S.A.S',  '3001112233'),
  (:'globex', 'Globex Ltda', '3004445566');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',   '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test', '', now(), now()),
  (:'nuevo',       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nuevo@ej.test',    '', now(), now()),
  (:'otro',        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'otro@ej.test',     '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',   '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

-- Vuelve al rol de servidor. Hace falta porque `invitations` no concede
-- lectura a NADIE —esa es su defensa— y sin esto la propia prueba no podría
-- comprobar que lo guardado es el hash y no el testigo.
create or replace function tests_servidor() returns void
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

-- Acme carga a una persona y pide su sesión.
select tests_como(:'jefe_acme');
select public.cargar_personas('[{"documento":"555","nombre":"Dora","email":"dora@acme.test"}]'::jsonb);
select public.solicitar_cita_evaluacion(
  now() + interval '10 days', now() + interval '10 days 2 hours',
  array(select id from public.organization_people where organization_id = :'acme')
);

-- =============================================================================
-- NO SE INVITA A UNA SESIÓN SIN CONFIRMAR
-- =============================================================================
select tests_como(:'doctor');

select throws_ok(
  format('select * from public.emitir_invitaciones(%L)',
    (select id from public.appointments where organization_id = :'acme')),
  'P0001',
  'La sesión debe estar confirmada antes de invitar.',
  'No se invita a nadie a una sesión que aún no se ha confirmado'
);

select public.confirmar_cita(
  (select id from public.appointments where organization_id = :'acme')
);

-- =============================================================================
-- CONFIRMAR PREPARA LOS ACCESOS, PERO NO ESCRIBE A NADIE
--
-- Siguen siendo dos actos del profesional. Lo que cambió es dónde nace el
-- acceso: antes lo fabricaba el botón de emitir, y por eso solo existía en
-- claro ese instante; ahora nace con la sesión confirmada y está a la vista
-- desde entonces.
--
-- Lo que NO puede pasar sigue igual: que aceptar una fecha le mande un correo
-- a alguien. Eso lo decide `emitir_invitaciones`, que es otro acto y otra
-- pantalla.
-- =============================================================================
select tests_servidor();

select is(
  (select count(*)::int from public.invitations),
  1,
  'Confirmar deja preparado el acceso de quien no tiene cuenta'
);

select isnt(
  (select token from public.invitations),
  null,
  'Y su testigo queda guardado, que es lo que permite enseñarlo sin regenerarlo'
);

select tests_como(:'doctor');

-- =============================================================================
-- EL TESTIGO SE ENTREGA Y SE GUARDA, CON SU HASH AL LADO
--
-- El hash se conserva aunque ya no sea el único rastro: es por donde
-- `aceptar_invitacion` busca, y lo que permite reconocer un enlace ya usado y
-- responder «ya fue aceptada» en vez de «no es válida».
-- =============================================================================
create temporary table entregado as
select * from public.emitir_invitaciones(
  (select id from public.appointments where organization_id = :'acme')
);

select is(
  (select count(*)::int from entregado),
  1,
  'Se emite una invitación para la única persona sin cuenta'
);

select isnt(
  (select token from entregado),
  null,
  'El testigo se devuelve en claro para poder enviarlo por correo'
);

select tests_servidor();

select is(
  (select count(*)::int from public.invitations i, entregado e
   where i.token_hash = e.token),
  0,
  'La columna del hash guarda el hash, no el testigo'
);

select is(
  (select count(*)::int from public.invitations i, entregado e
   where i.token_hash = encode(sha256(convert_to(e.token, 'UTF8')), 'hex')),
  1,
  'Lo que se guarda es su hash'
);

select tests_como(:'doctor');

/*
 * Reemitir REENVÍA lo mismo, y por eso ahora sí devuelve a la persona.
 *
 * Antes creaba un testigo por pulsación y devolvía solo los nuevos, así que la
 * segunda vez no salía nadie: no había forma de reenviar un correo perdido, que
 * es justo cuando se vuelve a pulsar. El enlace tiene que ser EL MISMO, o el
 * QR que se enseñó por otro lado deja de coincidir.
 */
create temporary table reemitido as
select * from public.emitir_invitaciones(
  (select id from public.appointments where organization_id = :'acme')
);

select is(
  (select count(*)::int from reemitido),
  1,
  'Volver a emitir devuelve a la misma persona, para reenviarle el correo'
);

select is(
  (select token from reemitido),
  (select token from entregado),
  'Y con el mismo enlace: no se fabrica un acceso nuevo por pulsar'
);

select tests_servidor();

select is(
  (select count(*)::int from public.invitations where accepted_at is null),
  1,
  'Sin invitaciones de más en la tabla'
);

select tests_como(:'doctor');

-- =============================================================================
-- ACEPTAR
-- =============================================================================
select tests_como(:'otro');

select throws_ok(
  'select public.aceptar_invitacion(''testigo-inventado'')',
  'P0001',
  'Esta invitación no es válida.',
  'Un testigo inventado no sirve'
);

select tests_como(:'nuevo');

select lives_ok(
  $$select public.aceptar_invitacion((select token from entregado))$$,
  'La persona acepta su invitación'
);

select is(
  (select profile_id from public.organization_people where documento = '555'),
  :'nuevo',
  'Su ficha queda enlazada a su cuenta'
);

select is(
  (select documento from public.profiles where id = :'nuevo'),
  '555',
  'Y su cédula queda registrada en su perfil'
);

select throws_ok(
  $$select public.aceptar_invitacion((select token from entregado))$$,
  'P0001',
  'Esta invitación ya fue aceptada.',
  'Una invitación no se acepta dos veces'
);

select tests_servidor();

-- Ya cumplió: guardarlo en claro a partir de aquí sería riesgo sin ninguna
-- contrapartida.
select is(
  (select token from public.invitations where accepted_at is not null),
  null,
  'Al aceptarse, el testigo en claro se borra'
);

-- =============================================================================
-- EL CASO QUE DA SENTIDO AL MODELO
--
-- Globex quiere contratar a la misma persona. La carga con SU correo y pide su
-- propia sesión. Al aceptar, debe enlazarse a la cuenta que ya tiene, no
-- crearle una segunda.
-- =============================================================================
select tests_como(:'jefe_globex');
select public.cargar_personas('[{"documento":"555","nombre":"Dora","email":"dora@personal.test"}]'::jsonb);
select public.solicitar_cita_evaluacion(
  now() + interval '40 days', now() + interval '40 days 2 hours',
  array(select id from public.organization_people where organization_id = :'globex')
);

select tests_como(:'doctor');
select public.confirmar_cita(
  (select id from public.appointments where organization_id = :'globex')
);

create temporary table entregado_globex as
select * from public.emitir_invitaciones(
  (select id from public.appointments where organization_id = :'globex')
);

-- Alguien distinto no puede quedarse con la invitación de otra persona.
select tests_como(:'otro');

select throws_ok(
  $$select public.aceptar_invitacion((select token from entregado_globex))$$,
  'P0001',
  'Ya existe una cuenta con ese documento de identidad.',
  'Otra cuenta NO puede aceptar la invitación de quien ya tiene la suya'
);

-- La persona correcta entra con la cuenta que ya tenía.
select tests_como(:'nuevo');
select public.aceptar_invitacion((select token from entregado_globex));

select is(
  (select count(distinct profile_id)::int
   from public.organization_people where documento = '555'),
  1,
  'Las dos fichas apuntan a la MISMA cuenta: el historial no se parte'
);

-- =============================================================================
-- LOS RECORDATORIOS NO ALCANZAN A LAS SESIONES DE GRUPO
--
-- El trabajo de recordatorios une `appointments` con `profiles` por
-- `patient_id`. En una sesión corporativa esa columna es nula, así que el JOIN
-- las descarta. Hoy eso PROTEGE —nadie recibe un correo inesperado— pero es
-- una protección accidental, no diseñada, y el día que se quiera recordar a
-- los convocados hay que escribirlo aparte.
--
-- Se fija aquí para que, si alguien cambia ese JOIN, se entere de que está
-- abriendo un envío masivo a personas convocadas por una empresa.
-- =============================================================================
select tests_servidor();

select is(
  (select count(*)::int from public.citas_para_recordar()),
  0,
  'Ninguna sesión de grupo entra en la cola de recordatorios'
);

select * from finish();
rollback;
