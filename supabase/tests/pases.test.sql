-- =============================================================================
-- Pases de acceso
--
-- La vía de entrega en mano, para cuando el correo no llega o no se ha
-- contratado. Lo que se comprueba aquí es sobre todo QUIÉN puede pedirlos:
-- un pase con testigo es la llave para entrar como esa persona, así que la
-- puerta de esta función importa más que lo que devuelve.
--
-- Y se comprueba lo segundo: que TODOS reciban pase, tengan cuenta o no. Las
-- evaluaciones de empresa no viven en el perfil de nadie —son descartables—,
-- así que el enlace es el único camino también para quien ya está registrado.
--
-- Lo tercero es lo que hace que no haya botón: LEER NO CREA NADA. Mirar la
-- pantalla dos veces tiene que dejar la tabla exactamente igual.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(13);

delete from public.appointment_changes;
delete from public.invitations;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set acme        'aaaa0000-0000-4000-8000-00000000a101'
\set globex      'bbbb0000-0000-4000-8000-00000000b101'
\set jefe_acme   'aaaa1111-0000-4000-8000-00000000c101'
\set jefe_globex 'bbbb1111-0000-4000-8000-00000000d101'
\set veterana    'cccc1111-0000-4000-8000-00000000e101'
\set doctor      'dddd1111-0000-4000-8000-00000000f101'

insert into public.organizations (id, nombre, contacto_telefono) values
  (:'acme',   'Acme S.A.S',  '3001112233'),
  (:'globex', 'Globex Ltda', '3004445566');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',   '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test', '', now(), now()),
  (:'veterana',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vera@ej.test',     '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',   '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

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

-- Acme convoca a dos: una que ya tiene cuenta y otra que no.
select tests_como(:'jefe_acme');
select public.cargar_personas('[
  {"documento":"111","nombre":"Vera","email":"vera@ej.test"},
  {"documento":"222","nombre":"Nueva","email":"nueva@ej.test"}
]'::jsonb);

select tests_servidor();
update public.organization_people set profile_id = :'veterana' where documento = '111';

select tests_como(:'jefe_acme');
select public.solicitar_cita_evaluacion(
  now() + interval '10 days', now() + interval '10 days 2 hours',
  array(select id from public.organization_people where organization_id = :'acme')
);

-- =============================================================================
-- ANTES DE CONFIRMAR NO HAY NADA QUE REPARTIR
--
-- La fecha todavía puede cambiar. Un pase repartido para una sesión que luego
-- se mueve es gente presentándose el día que no era.
-- =============================================================================
select throws_ok(
  format('select * from public.pases_de_acceso(%L)',
    (select id from public.appointments where organization_id = :'acme')),
  'P0001',
  'La sesión debe estar confirmada para repartir accesos.',
  'No se reparten accesos de una sesión sin confirmar'
);

select tests_como(:'doctor');
select public.confirmar_cita(
  (select id from public.appointments where organization_id = :'acme')
);

-- =============================================================================
-- LA PUERTA
--
-- Un pase con testigo permite entrar como la persona invitada. Solo el
-- profesional y la empresa DUEÑA de la sesión.
-- =============================================================================
/*
 * El identificador se apunta AHORA, como servidor.
 *
 * Leerlo desde la sesión de Globex devolvía nulo —RLS le esconde la cita de
 * Acme— y la función respondía «la sesión no existe», que es una prueba
 * distinta de la que se quiere hacer: aquí se comprueba que teniendo el
 * identificador, aun así no puede.
 */
select tests_servidor();
select id as cita_acme from public.appointments where organization_id = :'acme' \gset

select tests_como(:'jefe_globex');

select throws_ok(
  format('select * from public.pases_de_acceso(%L)', :'cita_acme'),
  'P0001',
  'Esta sesión no es tuya.',
  'Otra empresa no saca los accesos de una sesión ajena'
);

select tests_como(:'veterana');

select throws_ok(
  format('select * from public.pases_de_acceso(%L)', :'cita_acme'),
  'P0001',
  'Esta sesión no es tuya.',
  'Una convocada tampoco: tiene su acceso, no el de los demás'
);

-- =============================================================================
-- LA EMPRESA LOS ENCUENTRA HECHOS
--
-- Nadie los generó: existen desde que el profesional confirmó.
-- =============================================================================
select tests_como(:'jefe_acme');

create temporary table pases as
select * from public.pases_de_acceso(
  (select id from public.appointments where organization_id = :'acme')
);

select is(
  (select count(*)::int from pases),
  2,
  'Aparecen los dos convocados, tengan cuenta o no'
);

-- El nombre y el documento viajan con el pase: sin ellos, quien reparte
-- cincuenta enlaces no sabe cuál es de quién, y equivocarse aquí es darle a
-- alguien la llave de otra persona.
select is(
  (select nombre from pases where documento = '222'),
  'Nueva',
  'Cada pase dice de quién es'
);

select isnt(
  (select token from pases where documento = '222'),
  null,
  'El testigo de quien no tiene cuenta viene en claro'
);

/*
 * TAMBIÉN quien tiene cuenta recibe pase.
 *
 * Antes no: se daba por hecho que entraría por su perfil. Desde que las
 * evaluaciones de empresa no aparecen en el perfil de nadie, esa puerta no
 * existe y sin pase se quedaba sin ninguna.
 */
select isnt(
  (select token from pases where documento = '111'),
  null,
  'Quien ya tiene cuenta también recibe su pase: es su único camino'
);

select is(
  (select tiene_cuenta from pases where documento = '111'),
  true,
  'Se dice quién ya está registrado, aunque el pase sea el mismo'
);

-- =============================================================================
-- LEER NO CREA NADA
--
-- Es la propiedad que permite quitar el botón: si consultar fabricara
-- invitaciones, cada visita a la pantalla dejaría otra viva y una persona
-- acabaría con diez enlaces válidos.
-- =============================================================================
select tests_servidor();

create temporary table antes as
select count(*)::int as n from public.invitations;

select tests_como(:'jefe_acme');
select * from public.pases_de_acceso(:'cita_acme');
select * from public.pases_de_acceso(:'cita_acme');

select tests_servidor();

select is(
  (select count(*)::int from public.invitations),
  (select n from antes),
  'Consultar los pases dos veces no crea ninguna invitación'
);

select is(
  (select token from public.invitations i
   join public.organization_people op on op.id = i.person_id
   where op.documento = '222'),
  (select token from pases where documento = '222'),
  'Y el testigo sigue siendo el mismo que se enseñó la primera vez'
);

select is(
  (select count(*)::int from public.invitations i, pases p
   where p.documento = '222'
     and i.token_hash = encode(sha256(convert_to(p.token, 'UTF8')), 'hex')),
  1,
  'El pase que se enseña es el de la invitación que hay en la tabla'
);

select is(
  (select count(*)::int from public.invitations),
  2,
  'Una invitación por convocado, tenga cuenta o no'
);

-- El testigo guardado y el hash tienen que corresponderse, o el enlace que se
-- enseña no abriría nada.
select is(
  (select count(*)::int from public.invitations
   where token is not null
     and token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')),
  2,
  'Cada testigo guardado corresponde a su hash'
);

select finish();

rollback;
