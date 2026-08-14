-- =============================================================================
-- El circuito corporativo, de punta a punta
--
-- SPEC.md §9.2 · PLAN.md §5.4
--
-- Recorre el camino real —la empresa carga su gente, pide la sesión, el
-- profesional confirma y cierra registrando quién vino— y en cada paso intenta
-- también lo que NO debe poder hacerse.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(16);

delete from public.appointment_changes;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set acme       'aaaa0000-0000-4000-8000-00000000000a'
\set globex     'bbbb0000-0000-4000-8000-00000000000b'
\set jefe_acme  'aaaa1111-0000-4000-8000-00000000000c'
\set jefe_globex 'bbbb1111-0000-4000-8000-00000000000d'
\set persona    'cccc1111-0000-4000-8000-00000000000e'
\set doctor     'dddd1111-0000-4000-8000-00000000000f'

insert into public.organizations (id, nombre, contacto_telefono) values
  (:'acme',   'Acme S.A.S',  '3001112233'),
  (:'globex', 'Globex Ltda', '3004445566');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',   '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test', '', now(), now()),
  (:'persona',     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'persona@ej.test',  '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',   '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- =============================================================================
-- 1 · LA EMPRESA CARGA SU GENTE
-- =============================================================================
select tests_como(:'jefe_acme');

select is(
  public.cargar_personas('[
    {"documento":"111","nombre":"Ana","email":"ana@acme.test","cargo":"Bodega"},
    {"documento":"222","nombre":"Beto","email":"beto@acme.test"},
    {"documento":"333","nombre":"Caro","email":"caro@acme.test"}
  ]'::jsonb),
  3,
  'Acme carga tres personas de una sola vez'
);

-- Volver a cargar corrige, no duplica: una empresa que sube su nómina revisada
-- no debería tener que borrar nada primero.
select is(
  public.cargar_personas('[
    {"documento":"111","nombre":"Ana María","email":"anamaria@acme.test","cargo":"Jefa de bodega"}
  ]'::jsonb),
  1,
  'Volver a cargar a la misma cédula actualiza sus datos'
);

select is(
  (select count(*)::int from public.organization_people),
  3,
  'Siguen siendo tres personas, no cuatro'
);

select is(
  (select email from public.organization_people where documento = '111'),
  'anamaria@acme.test',
  'Los datos quedaron actualizados'
);

select throws_ok(
  $$select public.cargar_personas('[{"nombre":"Sin Cédula","email":"x@acme.test"}]'::jsonb)$$,
  'P0001',
  'Cada persona necesita su documento de identidad.',
  'No se puede cargar a alguien sin documento'
);

-- =============================================================================
-- 2 · SOLO UNA EMPRESA CARGA PERSONAL
-- =============================================================================
select tests_como(:'persona');

select throws_ok(
  $$select public.cargar_personas('[{"documento":"999","nombre":"X","email":"x@y.test"}]'::jsonb)$$,
  'P0001',
  'Solo una cuenta de empresa puede cargar personal.',
  'Una persona cualquiera no puede cargar personal'
);

-- =============================================================================
-- 3 · LA EMPRESA PIDE LA SESIÓN
-- =============================================================================
select tests_como(:'jefe_acme');

select lives_ok(
  $$select public.solicitar_cita_evaluacion(
      now() + interval '10 days',
      now() + interval '10 days 3 hours',
      array(select id from public.organization_people order by documento),
      'Evaluación de ingreso'
    )$$,
  'Acme solicita una sesión para sus tres personas'
);

select is(
  (select count(*)::int from public.appointment_attendees),
  3,
  'Las tres quedan convocadas'
);

select is(
  (select status::text from public.appointments where organization_id = :'acme'),
  'solicitada',
  'La sesión nace solicitada: el pago y la confirmación van aparte'
);

-- Una empresa puede tener varias solicitudes abiertas. El índice de «una
-- solicitud pendiente» es para personas, no para empresas que agendan tandas.
select lives_ok(
  $$select public.solicitar_cita_evaluacion(
      now() + interval '20 days',
      now() + interval '20 days 3 hours',
      array(select id from public.organization_people order by documento limit 1)
    )$$,
  'Una empresa puede tener varias sesiones pendientes a la vez'
);

-- =============================================================================
-- 4 · NADIE CONVOCA A GENTE AJENA
-- =============================================================================
select tests_como(:'jefe_globex');

select throws_ok(
  format(
    $$select public.solicitar_cita_evaluacion(
        now() + interval '30 days', now() + interval '30 days 2 hours', array[%L]::uuid[])$$,
    (select id from public.organization_people where documento = '111')
  ),
  'P0001',
  'Hay 1 persona(s) que no pertenecen a tu listado.',
  'Globex NO puede convocar a alguien del listado de Acme'
);

-- =============================================================================
-- 5 · REPROGRAMAR, QUE ANTES NO PODÍA UNA EMPRESA
-- =============================================================================
select tests_como(:'doctor');
select public.confirmar_cita(
  (select id from public.appointments where organization_id = :'acme' order by starts_at limit 1)
);

select tests_como(:'jefe_acme');

select lives_ok(
  format(
    'select public.solicitar_reprogramacion(%L, now() + interval ''12 days'', now() + interval ''12 days 3 hours'')',
    (select id from public.appointments where organization_id = :'acme' order by starts_at limit 1)
  ),
  'La empresa SÍ puede pedir que le cambien la fecha de su sesión'
);

select tests_como(:'jefe_globex');

select throws_ok(
  format(
    'select public.solicitar_reprogramacion(%L, now() + interval ''15 days'', now() + interval ''15 days 3 hours'')',
    (select id from public.appointments where organization_id = :'acme' order by starts_at limit 1)
  ),
  'P0001',
  'La cita no existe o no es tuya.',
  'Otra empresa NO puede mover la sesión ajena'
);

-- =============================================================================
-- 6 · CERRAR REGISTRANDO QUIÉN VINO
-- =============================================================================
select tests_como(:'doctor');

-- Se vuelve a confirmar tras la reprogramación pedida arriba.
select public.confirmar_cita(
  (select id from public.appointments where organization_id = :'acme' order by starts_at limit 1)
);

select lives_ok(
  format(
    'select public.cerrar_cita_evaluacion(%L, array[%L]::uuid[])',
    (select id from public.appointments where organization_id = :'acme' order by starts_at limit 1),
    (select id from public.organization_people where documento = '111')
  ),
  'El profesional cierra la sesión registrando quién asistió'
);

select is(
  (select count(*)::int from public.appointment_attendees where attended),
  1,
  'Queda registrado que vino una sola persona'
);

select is(
  (select count(*)::int from public.appointment_attendees where attended is false),
  2,
  'Y que las otras dos faltaron, que es lo que hay que reportarle a la empresa'
);

select * from finish();
rollback;
