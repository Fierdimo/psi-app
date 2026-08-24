-- =============================================================================
-- Organizar el día
--
-- Una sesión de empresa era una cita con varios asistentes y un solo par de
-- horas para todos, así que no había dónde escribir «este a las 8, este a las
-- 9, y estos tres los paso al viernes».
--
-- Lo que se comprueba: que el plan llega entero y sustituye al anterior, que
-- dos personas no pueden ocupar el mismo bloque, y que la envoltura de la cita
-- sigue al reparto —si alguien se va a otro día, el calendario tiene que
-- enterarse o la gente se presenta cuando no es.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(12);

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

\set empresa 'aaaa0000-0000-4000-8000-000000000b01'
\set jefe    'aaaa1111-0000-4000-8000-000000000b02'
\set doctor  'dddd1111-0000-4000-8000-000000000b03'

insert into public.organizations (id, nombre, contacto_telefono)
values (:'empresa', 'Acme S.A.S', '3001112233');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test', '', now(), now()),
  (:'doctor', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doc@acme.test',  '', now(), now());

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

/*
 * Un día LABORABLE, y las horas en la ZONA DE LA CONSULTA.
 *
 * La rejilla se compone en America/Bogota; compararla contra un timestamptz
 * armado con la zona de psql —UTC— desplaza todo cinco horas y las franjas no
 * aparecen. El fallo se lee como «esa hora no existe»: es verdad, y no dice
 * por qué.
 *
 * «Dentro de diez días» cae en sábado una de cada tres semanas, y ahí no hay
 * rejilla que mirar: la prueba fallaba según el día en que se ejecutara, que
 * es la peor forma de fallar.
 */
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
  {"documento":"111","nombre":"Ana","email":"ana@acme.test"},
  {"documento":"222","nombre":"Beto","email":"beto@acme.test"},
  {"documento":"333","nombre":"Caro","email":"caro@acme.test"}
]'::jsonb);

select public.solicitar_cita_evaluacion(
  (:'util')::timestamptz + interval '8 hours',
  (:'util')::timestamptz + interval '11 hours',
  array(select id from public.organization_people order by documento)
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
select id as cita from public.appointments limit 1 \gset
select id as ana  from public.organization_people where documento = '111' \gset
select id as beto from public.organization_people where documento = '222' \gset
select id as caro from public.organization_people where documento = '333' \gset

-- =============================================================================
-- LLEGAN SIN HORA
--
-- Fingir un reparto automático haría que el profesional aceptara un plan que
-- no ha visto.
-- =============================================================================
select is(
  (select count(*)::int from public.appointment_attendees where starts_at is null),
  3,
  'Una solicitud recién llegada no trae reparto'
);

-- =============================================================================
-- SOLO EL PROFESIONAL ORGANIZA
-- =============================================================================
select tests_como(:'jefe');

select throws_ok(
  format('select public.organizar_sesion(%L, %L::jsonb)', :'cita', '[]'),
  'P0001',
  'Solo el profesional organiza su día.',
  'La empresa no reordena la agenda de la consulta'
);

-- =============================================================================
-- EL PLAN LLEGA ENTERO
-- =============================================================================
select tests_como(:'doctor');

select lives_ok(
  format($f$select public.organizar_sesion(%L, '[
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"}
  ]'::jsonb)$f$, :'cita',
    :'ana',  ((:'util')::timestamptz + interval '8 hours')::text,
    :'beto', ((:'util')::timestamptz + interval '9 hours')::text),
  'El profesional coloca a dos personas'
);

select set_config('role', 'postgres', true);

select is(
  (select count(*)::int from public.appointment_attendees where starts_at is not null),
  2,
  'Quedan dos con hora'
);

-- Caro se queda sin sitio, y eso es un estado legítimo: hay más gente que
-- bloques, y el profesional necesita verlo antes de aceptar.
select is(
  (select starts_at from public.appointment_attendees where person_id = :'caro'),
  null,
  'Quien no aparece en el plan queda sin hora, sin borrarlo de la convocatoria'
);

-- =============================================================================
-- DOS PERSONAS NO CABEN EN EL MISMO BLOQUE
-- =============================================================================
select tests_como(:'doctor');

select throws_ok(
  format($f$select public.organizar_sesion(%L, '[
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"}
  ]'::jsonb)$f$, :'cita',
    :'ana',  ((:'util')::timestamptz + interval '8 hours')::text,
    :'beto', ((:'util')::timestamptz + interval '8 hours')::text),
  'P0001',
  'Hay 2 personas puestas a la misma hora.',
  'El profesional atiende de uno en uno'
);

-- =============================================================================
-- LA ENVOLTURA SIGUE AL REPARTO
--
-- Si se aplaza a alguien a otro día y la cita no se mueve, el calendario dice
-- una fecha y la persona se presenta otra.
-- =============================================================================
select lives_ok(
  format($f$select public.organizar_sesion(%L, '[
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"}
  ]'::jsonb)$f$, :'cita',
    :'ana',  ((:'util')::timestamptz + interval '8 hours')::text,
    :'caro', ((:'util')::timestamptz + interval '1 day 15 hours')::text),
  'Se aplaza a una persona al día siguiente'
);

select set_config('role', 'postgres', true);

select is(
  (select starts_at from public.appointments where id = :'cita'),
  (:'util')::timestamptz + interval '8 hours',
  'La cita empieza cuando empieza el primero'
);

select is(
  (select ends_at from public.appointments where id = :'cita'),
  (:'util')::timestamptz + interval '1 day 16 hours',
  'Y termina cuando termina el último, aunque sea otro día'
);

-- =============================================================================
-- DOS EMPRESAS EL MISMO DÍA
--
-- Antes la ocupación se medía con el RANGO de la cita, así que una sesión de 8
-- a 12 con gente a las 8, 9 y 11 se comía también las 10 —un hueco dejado a
-- propósito— y ninguna otra empresa podía entrar ese día.
-- =============================================================================
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

-- Ana a las 8 y Caro a las 10: las 9 quedan libres a propósito.
update public.appointment_attendees set starts_at = null, ends_at = null
where appointment_id = :'cita';

update public.appointment_attendees
set starts_at = ((:'util')::date + time '08:00') at time zone 'America/Bogota',
    ends_at   = ((:'util')::date + time '09:00') at time zone 'America/Bogota'
where appointment_id = :'cita' and person_id = :'ana';

update public.appointment_attendees
set starts_at = ((:'util')::date + time '10:00') at time zone 'America/Bogota',
    ends_at   = ((:'util')::date + time '11:00') at time zone 'America/Bogota'
where appointment_id = :'cita' and person_id = :'caro';

update public.appointments
set status = 'confirmada',
    starts_at = ((:'util')::date + time '08:00') at time zone 'America/Bogota',
    ends_at   = ((:'util')::date + time '11:00') at time zone 'America/Bogota'
where id = :'cita';

select tests_como(:'doctor');

select is(
  (select ocupada from public.franjas_del_dia(
     :'util')
   where inicio = ((:'util')::date + time '09:00') at time zone 'America/Bogota'),
  false,
  'El hueco que se dejó a propósito sigue libre para otra empresa'
);

select is(
  (select ocupada from public.franjas_del_dia(
     :'util')
   where inicio = ((:'util')::date + time '08:00') at time zone 'America/Bogota'),
  true,
  'Y la hora que sí tiene a alguien está ocupada'
);

-- Al organizar ESTA sesión, sus propias horas no pueden salir ocupadas: si no,
-- mover a Ana de las 8 a las 10 sería imposible.
select is(
  (select ocupada from public.franjas_del_dia(
     :'util', 'America/Bogota', :'cita')
   where inicio = ((:'util')::date + time '08:00') at time zone 'America/Bogota'),
  false,
  'La sesión que se organiza no se estorba a sí misma'
);

select finish();

rollback;
