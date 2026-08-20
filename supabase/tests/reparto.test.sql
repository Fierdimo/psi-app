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

select plan(9);

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

select tests_como(:'jefe');
select public.cargar_personas('[
  {"documento":"111","nombre":"Ana","email":"ana@acme.test"},
  {"documento":"222","nombre":"Beto","email":"beto@acme.test"},
  {"documento":"333","nombre":"Caro","email":"caro@acme.test"}
]'::jsonb);

select public.solicitar_cita_evaluacion(
  date_trunc('day', now()) + interval '10 days 8 hours',
  date_trunc('day', now()) + interval '10 days 11 hours',
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
    :'ana',  (date_trunc('day', now()) + interval '10 days 8 hours')::text,
    :'beto', (date_trunc('day', now()) + interval '10 days 9 hours')::text),
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
    :'ana',  (date_trunc('day', now()) + interval '10 days 8 hours')::text,
    :'beto', (date_trunc('day', now()) + interval '10 days 8 hours')::text),
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
    :'ana',  (date_trunc('day', now()) + interval '10 days 8 hours')::text,
    :'caro', (date_trunc('day', now()) + interval '11 days 15 hours')::text),
  'Se aplaza a una persona al día siguiente'
);

select set_config('role', 'postgres', true);

select is(
  (select starts_at from public.appointments where id = :'cita'),
  date_trunc('day', now()) + interval '10 days 8 hours',
  'La cita empieza cuando empieza el primero'
);

select is(
  (select ends_at from public.appointments where id = :'cita'),
  date_trunc('day', now()) + interval '11 days 16 hours',
  'Y termina cuando termina el último, aunque sea otro día'
);

select finish();

rollback;
