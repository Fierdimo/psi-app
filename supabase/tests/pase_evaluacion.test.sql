-- =============================================================================
-- Responder con el pase, sin cuenta
--
-- El testigo pasa a ser la credencial: quien tiene el enlace consiente y
-- responde SU evaluación, sin sesión de por medio. Eso quita el suelo que
-- ponía RLS, así que lo que hay que comprobar es que cada función se ata a UNA
-- asignación y no deja tocar nada más.
--
-- Lo importante aquí no es que funcione, es que no funcione de más.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(10);

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

delete from public.responses;
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
  (:'jefe',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@c.test', '', now(), now()),
  (:'doctor', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doc@c.test',  '', now(), now());

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
  {"documento":"111","nombre":"Ana","email":"ana@c.test"},
  {"documento":"222","nombre":"Beto","email":"beto@c.test"}
]'::jsonb);

select public.solicitar_cita_evaluacion(
  now() + interval '5 days', now() + interval '5 days 2 hours',
  array(select id from public.organization_people order by documento)
);

select tests_como(:'doctor');
select public.confirmar_cita((select id from public.appointments limit 1));
select public.asignar_evaluacion(
  (select id from public.appointments limit 1),
  (select id from public.assessments where clave = 'disc_dominancia')
);

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

select token as pase_ana from public.invitations i
  join public.organization_people op on op.id = i.person_id
  where op.documento = '111' \gset
select token as pase_beto from public.invitations i
  join public.organization_people op on op.id = i.person_id
  where op.documento = '222' \gset

-- Los identificadores se apuntan AHORA, como servidor: `anon` no puede leer
-- estas tablas, y una subconsulta dentro de la prueba fallaría por eso y no
-- por lo que se quiere comprobar.
select i.id as item_mio
from public.assessment_items i
join public.assignments a on a.assessment_id = i.assessment_id
order by i.posicion limit 1 \gset

/*
 * Un ítem de OTRA prueba, sembrado aquí.
 *
 * En la base solo vive el DISC, así que sin esto no habría con qué comprobar
 * el caso que importa: que un testigo válido no sirve para escribir respuestas
 * de cualquier instrumento del catálogo.
 */
insert into public.assessments (id, clave, nombre, motor)
values ('eeee0000-0000-4000-8000-000000000c99', 'otra_prueba', 'Otra prueba', 'ninguno')
on conflict (clave) do nothing;

insert into public.assessment_items (id, assessment_id, posicion, tipo, enunciado)
values ('eeee1111-0000-4000-8000-000000000c98',
        'eeee0000-0000-4000-8000-000000000c99', 1, 'likert', 'Pregunta ajena')
on conflict (id) do nothing;

select 'eeee1111-0000-4000-8000-000000000c98' as item_ajeno \gset

-- A partir de aquí, ANÓNIMO: es como llega quien escanea el QR.
select set_config('role', 'anon', true);

-- =============================================================================
-- UN TESTIGO INVENTADO NO ABRE NADA
-- =============================================================================
select throws_ok(
  $$select * from public.evaluacion_de_pase('testigo-inventado')$$,
  'P0001',
  'Este enlace no es válido.',
  'Un enlace inventado no lleva a ninguna evaluación'
);

-- =============================================================================
-- EL PASE LLEVA A SU EVALUACIÓN, Y SIN CONSENTIR NO SE EMPIEZA
-- =============================================================================
select is(
  (select persona from public.evaluacion_de_pase(:'pase_ana')),
  'Ana',
  'El pase de Ana lleva a la evaluación de Ana'
);

select is(
  (select consentimiento from public.evaluacion_de_pase(:'pase_ana')),
  'sin_decidir',
  'Y llega sin consentimiento dado'
);

select throws_ok(
  format('select public.iniciar_con_pase(%L)', :'pase_ana'),
  'P0001',
  'Primero tienes que aceptar el consentimiento.',
  'Sin consentir no se abre la prueba'
);

-- =============================================================================
-- CONSIENTE Y RESPONDE
-- =============================================================================
select lives_ok(
  format('select public.consentir_con_pase(%L, %L)', :'pase_ana', 'aceptado'),
  'Acepta el consentimiento sin tener cuenta'
);

select set_config('role', 'postgres', true);

select is(
  (select count(*)::int from public.consents c
   join public.organization_people op on op.id = c.person_id
   where op.documento = '111' and c.user_id is null),
  1,
  'La evidencia queda atada a su ficha, aunque no haya cuenta'
);

select set_config('role', 'anon', true);

select lives_ok(
  format('select public.iniciar_con_pase(%L)', :'pase_ana'),
  'Ya puede empezar'
);

-- =============================================================================
-- LO QUE EL PASE NO PUEDE HACER
--
-- Es lo que de verdad importa: sin sesión no hay RLS que lo detenga, así que
-- la puerta tiene que estar dentro de cada función.
-- =============================================================================
select throws_ok(
  format($f$select public.responder_con_pase(%L, %L, '3'::jsonb)$f$,
    :'pase_ana', :'item_ajeno'),
  'P0001',
  'Esa pregunta no es de tu evaluación.',
  'Un pase válido no sirve para responder preguntas de otra prueba'
);

select lives_ok(
  format($f$select public.responder_con_pase(%L, %L, '3'::jsonb)$f$,
    :'pase_ana', :'item_mio'),
  'Y sí para responder las suyas'
);

select set_config('role', 'postgres', true);

-- El pase de Beto no ha tocado nada: cada uno resuelve a SU asignación.
select is(
  (select count(*)::int from public.responses r
   join public.assignments a on a.id = r.assignment_id
   join public.organization_people op on op.id = a.person_id
   where op.documento = '222'),
  0,
  'Responder con un pase no escribe en la evaluación de otra persona'
);

select finish();

rollback;
