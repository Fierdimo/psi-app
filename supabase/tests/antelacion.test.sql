-- =============================================================================
-- Antelación mínima
--
-- La consulta exigía 24 horas y ahora no exige ninguna. Lo que se comprueba
-- aquí es que «ninguna» NO significa «sin comprobar»: el suelo sigue siendo
-- ahora mismo, así que nadie puede pedir una cita para ayer ni la empresa
-- convocar una sesión para una hora que ya pasó.
--
-- Y se comprueba que sigue siendo un ajuste: subiendo el número, la regla
-- vuelve. Eso es lo que permite recuperarla sin tocar código.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(5);

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

\set empresa  'aaaa0000-0000-4000-8000-0000000ae001'
\set jefe     'aaaa1111-0000-4000-8000-0000000ae002'
\set paciente 'cccc1111-0000-4000-8000-0000000ae003'
\set doctor   'dddd1111-0000-4000-8000-0000000ae004'

insert into public.organizations (id, nombre, contacto_telefono)
values (:'empresa', 'Acme S.A.S', '3001112233');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe',     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',  '', now(), now()),
  (:'paciente', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pac@ej.test',     '', now(), now()),
  (:'doctor',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doc@ej.test',     '', now(), now());

/*
 * Los pacientes, con su rol PUESTO A MANO.
 *
 * Desde la migración 0058 toda cuenta nueva nace como empresa: es lo que hace
 * cierto que el alta pública sea solo de empresas. Estas fixtures se apoyaban
 * en el rol por defecto, así que se lo devuelven explícitamente — igual que ya
 * hacían con el del profesional.
 */
update public.profiles set role = 'paciente' where id = :'paciente';
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

-- =============================================================================
-- HOY YA VALE
-- =============================================================================
select is(
  (select min_notice_hours from public.clinic_settings),
  0,
  'La consulta no exige antelación'
);

select tests_como(:'paciente');

select lives_ok(
  $$select public.solicitar_cita(now() + interval '10 minutes',
                                 now() + interval '70 minutes')$$,
  'Un paciente puede pedir cita para dentro de diez minutos'
);

-- =============================================================================
-- PERO EL PASADO SIGUE CERRADO
--
-- Es la diferencia entre «sin margen» y «sin comprobar». Sin este suelo, un
-- reloj mal puesto o un formulario manipulado crearían citas para ayer, que
-- nadie puede atender y que ensucian la agenda hacia atrás.
-- =============================================================================
select throws_ok(
  $$select public.solicitar_cita(now() - interval '2 hours',
                                 now() - interval '1 hour')$$,
  'P0001',
  'Las citas deben solicitarse con al menos 0 horas de anticipación.',
  'Nadie pide una cita para el pasado'
);

select tests_como(:'jefe');
select public.cargar_personas('[{"documento":"777","nombre":"Ana","email":"ana@acme.test"}]'::jsonb);

select lives_ok(
  $$select public.solicitar_cita_evaluacion(
      now() + interval '30 minutes', now() + interval '2 hours',
      array(select id from public.organization_people))$$,
  'Y una empresa puede convocar una sesión para esta misma tarde'
);

-- =============================================================================
-- SIGUE SIENDO UN AJUSTE
-- =============================================================================
-- Volver al rol de servidor para cambiar el ajuste: la tabla no concede
-- escritura a nadie con sesión, que es justo su defensa.
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

update public.clinic_settings set min_notice_hours = 48;

select tests_como(:'paciente');

select throws_ok(
  $$select public.solicitar_cita(now() + interval '10 minutes',
                                 now() + interval '70 minutes')$$,
  'P0001',
  'Las citas deben solicitarse con al menos 48 horas de anticipación.',
  'Subiendo el ajuste, la regla vuelve sin tocar código'
);

select finish();

rollback;
