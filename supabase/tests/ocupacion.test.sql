-- =============================================================================
-- Qué ocupa de verdad la agenda
--
-- `sin_solapamiento` comparaba el rango de la CITA. Para una de una persona eso
-- es su ocupación; para una sesión de empresa es la envoltura de la tanda, con
-- los huecos de dentro incluidos. Confirmar una sesión repartida de lunes a
-- miércoles bloqueaba tres días enteros.
--
-- Lo que se comprueba: que ya no bloquea lo que no ocupa, que sigue bloqueando
-- lo que sí, y que las dos puertas —agendar y confirmar— respetan la hora de
-- cada convocado ahora que la restricción no las ve.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(8);

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

\set empresa 'aaaa0000-0000-4000-8000-000000000d01'
\set jefe    'aaaa1111-0000-4000-8000-000000000d02'
\set doctor  'dddd1111-0000-4000-8000-000000000d03'
\set otro    'aaaa2222-0000-4000-8000-000000000d04'

insert into public.organizations (id, nombre, contacto_telefono)
values (:'empresa', 'Acme S.A.S', '3001112233');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test', '', now(), now()),
  (:'doctor', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doc@acme.test',  '', now(), now()),
  (:'otro',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pac@acme.test',  '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'empresa' where id = :'jefe';

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- Un día laborable, y las horas en la zona de la consulta. Ver la nota en
-- reparto.test.sql: con la zona de psql las franjas se desplazan cinco horas.
select (
  select d::date
  from generate_series(
    date_trunc('day', now()) + interval '10 days',
    date_trunc('day', now()) + interval '17 days',
    interval '1 day'
  ) as d
  where extract(isodow from d) between 1 and 5
  limit 1
) as util \gset

select tests_como(:'jefe');
select public.cargar_personas('[
  {"documento":"111","nombre":"Ana",  "email":"ana@acme.test"},
  {"documento":"222","nombre":"Beto", "email":"beto@acme.test"}
]'::jsonb);

-- Una sesión de 8 a 12, con Ana a las 8 y Beto a las 11: las 9 y las 10 son un
-- hueco dejado a propósito.
select public.solicitar_cita_evaluacion(
  ((:'util')::date + time '08:00') at time zone 'America/Bogota',
  ((:'util')::date + time '12:00') at time zone 'America/Bogota',
  array(select id from public.organization_people order by documento)
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
select id as sesion from public.appointments where organization_id is not null limit 1 \gset
select id as ana  from public.organization_people where documento = '111' \gset
select id as beto from public.organization_people where documento = '222' \gset

select tests_como(:'doctor');

select lives_ok(
  format($f$select public.organizar_sesion(%L, '[
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"}
  ]'::jsonb)$f$, :'sesion',
    :'ana',  (((:'util')::date + time '08:00') at time zone 'America/Bogota')::text,
    :'beto', (((:'util')::date + time '11:00') at time zone 'America/Bogota')::text),
  'Ana a las 8 y Beto a las 11, con las 9 y las 10 libres a propósito'
);

select lives_ok(
  format('select public.confirmar_cita(%L)', :'sesion'),
  'La sesión se confirma'
);

-- =============================================================================
-- EL HUECO DE DENTRO SIGUE SIENDO UN HUECO
--
-- Era el fallo diario: la pantalla ofrecía las 9 —`franjas_del_dia` lo arregló
-- en la 0040— y guardar fallaba contra la envoltura de 8 a 12.
-- =============================================================================
select lives_ok(
  format('select public.agendar_cita(%L, %L::timestamptz, %L::timestamptz)',
    :'otro',
    ((:'util')::date + time '09:00') at time zone 'America/Bogota',
    ((:'util')::date + time '10:00') at time zone 'America/Bogota'),
  'Una cita individual entra en el hueco de las 9'
);

-- =============================================================================
-- PERO LA HORA DE UN CONVOCADO NO ESTÁ LIBRE
--
-- La restricción ya no ve las sesiones de empresa, así que este es el único
-- control que queda en este sentido. Y dice CON QUIÉN choca: «ocupado» a secas
-- obliga a buscarlo a mano.
-- =============================================================================
select throws_ok(
  format('select public.agendar_cita(%L, %L::timestamptz, %L::timestamptz)',
    :'otro',
    ((:'util')::date + time '11:00') at time zone 'America/Bogota',
    ((:'util')::date + time '12:00') at time zone 'America/Bogota'),
  'P0001',
  'A esa hora ya atiendes a Beto.',
  'No se agenda encima de un convocado, y se dice quién es'
);

-- =============================================================================
-- Y DOS CITAS INDIVIDUALES SIGUEN SIN CABER A LA VEZ
--
-- Es lo que `sin_solapamiento` existe para impedir, y sigue siendo una
-- restricción de exclusión: a prueba de dos peticiones simultáneas.
-- =============================================================================
select throws_ok(
  format('select public.agendar_cita(%L, %L::timestamptz, %L::timestamptz)',
    :'otro',
    ((:'util')::date + time '09:30') at time zone 'America/Bogota',
    ((:'util')::date + time '10:30') at time zone 'America/Bogota'),
  'P0001',
  'A esa hora ya atiendes a otra persona.',
  'Dos citas individuales no se solapan'
);

-- =============================================================================
-- AL REPARTIR TAMPOCO SE PISA UNA CITA INDIVIDUAL
--
-- `organizar_sesion` miraba a los convocados de otras sesiones y se olvidaba de
-- las citas de una persona: mientras la exclusión cubría la envoltura no se
-- notaba, y ahora es el único control que queda.
-- =============================================================================
select throws_ok(
  format($f$select public.organizar_sesion(%L, '[
    {"persona":"%s","inicio":"%s"}
  ]'::jsonb)$f$, :'sesion',
    :'ana', (((:'util')::date + time '09:00') at time zone 'America/Bogota')::text),
  'P0001',
  null,
  'Poner a alguien encima de una cita individual se rechaza'
);

-- =============================================================================
-- DOS EMPRESAS EL MISMO DÍA
--
-- Es lo que la 0040 dijo haber habilitado. Arregló lo que se PINTA; la
-- escritura seguía rechazándolo contra la envoltura.
-- =============================================================================
select set_config('role', 'postgres', true);

insert into public.appointments
  (organization_id, professional_id, created_by, starts_at, ends_at, status, modality)
values (
  :'empresa', :'doctor', :'doctor',
  ((:'util')::date + time '08:00') at time zone 'America/Bogota',
  ((:'util')::date + time '12:00') at time zone 'America/Bogota',
  'confirmada', 'presencial'
);

select pass('Dos sesiones de empresa comparten el día sin estorbarse');

-- =============================================================================
-- Y UNA SESIÓN REPARTIDA EN VARIOS DÍAS NO SE COME LA SEMANA
--
-- Su envoltura va de lunes a miércoles. Con la restricción anterior, eso
-- bloqueaba todo lo que cayera en medio.
-- =============================================================================
insert into public.appointments
  (organization_id, professional_id, created_by, starts_at, ends_at, status, modality)
values (
  :'empresa', :'doctor', :'doctor',
  ((:'util')::date + 7 + time '08:00') at time zone 'America/Bogota',
  ((:'util')::date + 9 + time '12:00') at time zone 'America/Bogota',
  'confirmada', 'presencial'
);

select lives_ok(
  format($f$insert into public.appointments
    (patient_id, professional_id, created_by, starts_at, ends_at, status, modality)
    values (%L, %L, %L, %L::timestamptz, %L::timestamptz, 'confirmada', 'presencial')$f$,
    :'otro', :'doctor', :'doctor',
    ((:'util')::date + 8 + time '09:00') at time zone 'America/Bogota',
    ((:'util')::date + 8 + time '10:00') at time zone 'America/Bogota'),
  'Una cita cabe en medio de una sesión repartida en tres días'
);

select finish();

rollback;
