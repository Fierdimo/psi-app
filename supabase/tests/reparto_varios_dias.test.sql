-- =============================================================================
-- Una tanda que no cabe en un día
--
-- Es el caso normal en cuanto la empresa manda quince personas a una jornada
-- de ocho bloques. El modelo ya lo aguantaba —cada convocado tiene SU hora—
-- pero no había forma de PREGUNTAR dónde siguen los que sobran, así que el
-- reparto se hacía a mano recorriendo el calendario día a día.
--
-- Lo que se comprueba: que los huecos siguen en el día siguiente laborable
-- —saltándose el fin de semana y lo que ya esté tomado—, y que una sesión
-- repartida en dos días se ve como dos jornadas y no como una cita de
-- cincuenta horas.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(16);

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

\set empresa 'aaaa0000-0000-4000-8000-000000000c01'
\set jefe    'aaaa1111-0000-4000-8000-000000000c02'
\set doctor  'dddd1111-0000-4000-8000-000000000c03'

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
 * UN VIERNES, a propósito.
 *
 * Lo que hay que demostrar es que los que sobran caen en el día siguiente
 * LABORABLE. Con un martes, «el día siguiente» y «el siguiente laborable» son
 * el mismo día y la prueba pasaría aunque `huecos_seguidos` no supiera nada de
 * fines de semana. Desde un viernes solo pasa si de verdad salta al lunes.
 */
select (
  select d::date
  from generate_series(
    date_trunc('day', now()) + interval '10 days',
    date_trunc('day', now()) + interval '17 days',
    interval '1 day'
  ) as d
  where extract(isodow from d) = 5
  limit 1
) as viernes \gset

/*
 * Una jornada DE TRES BLOQUES, para que cinco personas no quepan.
 *
 * Con el horario por defecto —de ocho a cinco— harían falta diez convocados
 * para desbordar el día, y la prueba se leería peor sin decir nada más.
 */
select tests_como(:'doctor');
select public.actualizar_horario(
  '08:00'::time, '11:00'::time, 60, null, null, '{1,2,3,4,5}'::smallint[]
);

select tests_como(:'jefe');
select public.cargar_personas('[
  {"documento":"111","nombre":"Ana",  "email":"ana@acme.test"},
  {"documento":"222","nombre":"Beto", "email":"beto@acme.test"},
  {"documento":"333","nombre":"Caro", "email":"caro@acme.test"},
  {"documento":"444","nombre":"Dina", "email":"dina@acme.test"},
  {"documento":"555","nombre":"Eli",  "email":"eli@acme.test"}
]'::jsonb);

select public.solicitar_cita_evaluacion(
  ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
  ((:'viernes')::date + time '11:00') at time zone 'America/Bogota',
  array(select id from public.organization_people order by documento)
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);
select id as cita from public.appointments limit 1 \gset
select id as ana  from public.organization_people where documento = '111' \gset
select id as beto from public.organization_people where documento = '222' \gset
select id as caro from public.organization_people where documento = '333' \gset
select id as dina from public.organization_people where documento = '444' \gset
select id as eli  from public.organization_people where documento = '555' \gset

-- =============================================================================
-- SOLO EL PROFESIONAL PREGUNTA DÓNDE HAY HUECO
--
-- Los huecos libres son el mapa de la agenda de la consulta. Una empresa que
-- pudiera pedirlo sabría cuándo está vacía y cuándo llena.
-- =============================================================================
select tests_como(:'jefe');

select throws_ok(
  format('select * from public.huecos_seguidos(%L::timestamptz, 3)',
    ((:'viernes')::date + time '08:00') at time zone 'America/Bogota'),
  'P0001',
  'Solo el profesional organiza su día.',
  'La empresa no ve los huecos de la consulta'
);

-- =============================================================================
-- LOS QUE SOBRAN SIGUEN EL LUNES
-- =============================================================================
select tests_como(:'doctor');

select is(
  (select count(*)::int from public.huecos_seguidos(
     ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
     5, 'America/Bogota')),
  5,
  'Se piden cinco huecos y llegan cinco, aunque el día solo dé tres'
);

select is(
  (select count(*)::int from public.huecos_seguidos(
     ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
     5, 'America/Bogota') h
   where (h.inicio at time zone 'America/Bogota')::date = (:'viernes')::date),
  3,
  'El viernes se llena entero: tres bloques, tres personas'
);

select is(
  (select count(*)::int from public.huecos_seguidos(
     ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
     5, 'America/Bogota') h
   where (h.inicio at time zone 'America/Bogota')::date
         = (:'viernes')::date + 3),
  2,
  'Y los dos que sobran caen el LUNES: el sábado y el domingo no se atiende'
);

-- Ni uno más de los pedidos: si devolviera de más, colocarlos sería colocar a
-- gente que nadie pidió citar.
select is(
  (select count(*)::int from public.huecos_seguidos(
     ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
     1, 'America/Bogota')),
  1,
  'Se devuelven exactamente los que se piden'
);

-- =============================================================================
-- Y NO SE PISA LO QUE YA ESTÁ TOMADO
-- =============================================================================
select set_config('role', 'postgres', true);

insert into public.appointments
  (patient_id, professional_id, created_by, starts_at, ends_at, status, modality)
values (
  :'jefe', :'doctor', :'doctor',
  ((:'viernes')::date + time '09:00') at time zone 'America/Bogota',
  ((:'viernes')::date + time '10:00') at time zone 'America/Bogota',
  'confirmada', 'presencial'
);

select tests_como(:'doctor');

select is(
  (select count(*)::int from public.huecos_seguidos(
     ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
     5, 'America/Bogota') h
   where h.inicio = ((:'viernes')::date + time '09:00')
                    at time zone 'America/Bogota'),
  0,
  'El bloque de las nueve ya es de otro y no se ofrece'
);

select is(
  (select count(*)::int from public.huecos_seguidos(
     ((:'viernes')::date + time '08:00') at time zone 'America/Bogota',
     5, 'America/Bogota') h
   where (h.inicio at time zone 'America/Bogota')::date = (:'viernes')::date),
  2,
  'Con las nueve ocupadas, el viernes solo da dos'
);

-- =============================================================================
-- LA SESIÓN REPARTIDA SE VE COMO DOS JORNADAS
--
-- Es lo que el calendario necesita: agrupando por `starts_at` de la CITA, una
-- sesión de viernes a lunes salía solo el viernes, y el lunes la agenda se
-- daba por libre teniendo gente citada.
-- =============================================================================
select lives_ok(
  format($f$select public.organizar_sesion(%L, '[
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"},
    {"persona":"%s","inicio":"%s"}
  ]'::jsonb)$f$, :'cita',
    :'ana',  (((:'viernes')::date + time '08:00') at time zone 'America/Bogota')::text,
    :'beto', (((:'viernes')::date + time '10:00') at time zone 'America/Bogota')::text,
    :'caro', (((:'viernes')::date + 3 + time '08:00') at time zone 'America/Bogota')::text,
    :'dina', (((:'viernes')::date + 3 + time '09:00') at time zone 'America/Bogota')::text),
  'Dos el viernes y dos el lunes'
);

select is(
  (select count(*)::int from public.jornadas_de_sesion(
     now(), now() + interval '60 days', 'America/Bogota')),
  2,
  'Una sesión en dos días son DOS jornadas, no una'
);

select is(
  (select array_agg(j.personas order by j.dia)
   from public.jornadas_de_sesion(
     now(), now() + interval '60 days', 'America/Bogota') j),
  array[2, 2],
  'Y cada jornada sabe a cuánta gente cita'
);

/*
 * El tramo es el del DÍA, no el de la sesión.
 *
 * `appointments.ends_at` vale ahora el lunes a las 10, y pintar el viernes con
 * ese fin dibujaría un bloque de tres días encima del calendario.
 */
select is(
  (select j.hasta
   from public.jornadas_de_sesion(
     now(), now() + interval '60 days', 'America/Bogota') j
   where j.dia = (:'viernes')::date),
  ((:'viernes')::date + time '11:00') at time zone 'America/Bogota',
  'El viernes termina cuando termina el último del viernes'
);

-- Quien mira el LUNES tiene que ver esta sesión, aunque empezara el viernes.
select is(
  (select count(*)::int
   from public.jornadas_de_sesion(
     ((:'viernes')::date + 3) at time zone 'America/Bogota',
     ((:'viernes')::date + 4) at time zone 'America/Bogota',
     'America/Bogota')),
  1,
  'Mirando solo el lunes, la sesión que arrancó el viernes sigue apareciendo'
);

-- =============================================================================
-- LA REJILLA DE VARIOS DÍAS, DE UN VIAJE
--
-- Sin esto, quien cae en el día siguiente solo puede moverse dentro de su día
-- si la pantalla cambia de fecha primero: su desplegable ofrece los bloques del
-- día que se esté mirando, no los del suyo.
-- =============================================================================
select is(
  (select count(distinct dia)::int from public.franjas_de_dias(
     array[(:'viernes')::date, (:'viernes')::date + 3]::date[],
     'America/Bogota')),
  2,
  'Dos días pedidos, dos rejillas'
);

-- El día visible suele estar ya entre los del reparto: armarlo dos veces no
-- cambiaría el resultado, pero duplicaría cada bloque en el desplegable.
select is(
  (select count(*)::int from public.franjas_de_dias(
     array[(:'viernes')::date, (:'viernes')::date, (:'viernes')::date]::date[],
     'America/Bogota')),
  3,
  'Un día repetido en la petición sale una sola vez'
);

/*
 * Un sábado NO devuelve filas, y esa ausencia significa algo.
 *
 * «Ese día no se atiende» y «la rejilla todavía no ha llegado» se ven igual si
 * la pantalla no los distingue: el desplegable se quedaría cargando para
 * siempre. Quien llama rellena la clave vacía por eso.
 */
select is(
  (select count(*)::int from public.franjas_de_dias(
     array[(:'viernes')::date + 1]::date[], 'America/Bogota')),
  0,
  'Un sábado no tiene rejilla que dar'
);

select tests_como(:'jefe');

select throws_ok(
  format('select * from public.franjas_de_dias(array[%L]::date[])', :'viernes'),
  'P0001',
  'Solo el profesional organiza su día.',
  'La empresa tampoco ve la rejilla de la consulta'
);

select finish();

rollback;
