-- =============================================================================
-- Pruebas del libro de usos
--
-- SPEC-EVALUACIONES.md §4.1 · PLAN-EVALUACIONES.md F1
--
-- Aquí vive el dinero, y por eso estas pruebas se escriben antes que cualquier
-- pantalla. Lo que hay que dejar demostrado no es que el circuito funcione
-- cuando todo va bien —eso se ve a ojo— sino las cuatro formas de perderlo:
--
--   1. Que una empresa se cargue saldo a sí misma.
--   2. Que una autorización cargue dos veces.
--   3. Que un rechazo cargue algo.
--   4. Que una empresa lea o toque el saldo de otra.
--
-- Las cuatro se comprueban desde el papel de quien lo intentaría, no leyendo
-- las políticas. Una política se lee bien y protege mal.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(27);

-- Punto de partida limpio. Todo ocurre dentro de la transacción que se
-- revierte al final, así que la siembra sobrevive intacta.
delete from public.ticket_ledger;
delete from public.ticket_orders;
delete from public.result_values;
delete from public.results;
delete from public.responses;
delete from public.assignments;
delete from public.appointment_changes;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

-- -----------------------------------------------------------------------------
-- Fixtures: dos empresas rivales, el profesional, y alguien de fuera
-- -----------------------------------------------------------------------------
\set acme    'aaaa0000-0000-4000-8000-000000000001'
\set globex  'bbbb0000-0000-4000-8000-000000000002'

\set jefe_acme    'aaaa1111-0000-4000-8000-000000000001'
\set jefe_globex  'bbbb1111-0000-4000-8000-000000000002'
\set doctor       'dddd0000-0000-4000-8000-000000000003'
\set fuera        'ffff0000-0000-4000-8000-000000000004'

insert into public.organizations (id, nombre, contacto_email) values
  (:'acme',   'Acme S.A.S',  'pagos@acme.test'),
  (:'globex', 'Globex Ltda', 'pagos@globex.test');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',   '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test', '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',   '', now(), now()),
  (:'fuera',       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fuera@ej.test',    '', now(), now());

-- Rol y pertenencia se asignan con privilegios de servidor, nunca por
-- interfaz. Es justo lo que las pruebas de abajo comprueban que nadie puede
-- hacerse a sí mismo.
update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

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

/** El id de la orden pendiente de una empresa, para no arrastrarlo a mano. */
create or replace function tests_orden(p_org uuid, p_estado public.ticket_order_status)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.ticket_orders
  where organization_id = p_org and status = p_estado
  order by created_at desc limit 1;
$$;

-- =============================================================================
-- PEDIR
-- =============================================================================
select tests_como(:'jefe_acme');

select lives_ok(
  'select public.solicitar_usos(25, ''Cotización 2411'')',
  'Una empresa solicita usos'
);

select is(
  public.saldo_de_usos(),
  0,
  'Pedir no carga nada: el saldo sigue en cero hasta que alguien autorice'
);

select throws_ok(
  'select public.solicitar_usos(10, null)',
  'Ya tienes una solicitud de usos esperando respuesta.',
  'Y no se puede dejar dos pendientes a la vez'
);

select throws_ok(
  'select public.solicitar_usos(0, null)',
  'Pide al menos un uso.',
  'Ni pedir cero usos'
);

select throws_ok(
  'select public.solicitar_usos(5000, null)',
  'Son demasiados usos para una sola solicitud.',
  'Ni un número que solo puede ser un dedo de más'
);

-- Quien no administra ninguna empresa no compra nada.
select tests_como(:'fuera');

select throws_ok(
  'select public.solicitar_usos(5, null)',
  'Solo una empresa solicita usos.',
  'Quien no administra una empresa no solicita usos'
);

-- =============================================================================
-- UNA EMPRESA NO VE NI TOCA LO DE LA OTRA
-- =============================================================================
select tests_como(:'jefe_globex');

select is(
  (select count(*)::int from public.ticket_orders),
  0,
  'Globex no ve la solicitud de Acme'
);

select throws_ok(
  format('select public.autorizar_usos(%L, null)', tests_orden(:'acme', 'solicitada')),
  'Solo el profesional autoriza usos.',
  'Ni puede autorizarla'
);

select throws_ok(
  format('select public.saldo_de_usos(%L)', :'acme'),
  'Ese saldo no es tuyo.',
  'Ni consultar su saldo'
);

-- La defensa que de verdad importa: autorizarse a uno mismo.
select tests_como(:'jefe_acme');

select throws_ok(
  format('select public.autorizar_usos(%L, ''pagado, palabra'')', tests_orden(:'acme', 'solicitada')),
  'Solo el profesional autoriza usos.',
  'Y una empresa tampoco se autoriza a sí misma'
);

-- =============================================================================
-- AUTORIZAR
-- =============================================================================
select tests_como(:'doctor');

select lives_ok(
  format('select public.autorizar_usos(%L, ''transferencia 88231'')', tests_orden(:'acme', 'solicitada')),
  'El profesional autoriza tras comprobar el pago'
);

select is(
  public.saldo_de_usos(:'acme'),
  25,
  'Y el saldo sube exactamente lo pedido'
);

select is(
  (select count(*)::int from public.ticket_ledger where organization_id = :'acme'),
  1,
  'Con un solo movimiento en el libro'
);

select is(
  (select referencia_pago from public.ticket_orders where id = tests_orden(:'acme', 'autorizada')),
  'transferencia 88231',
  'Y queda escrito contra qué pago se autorizó'
);

select throws_ok(
  format('select public.autorizar_usos(%L, null)', tests_orden(:'acme', 'autorizada')),
  'Esa solicitud ya está autorizada.',
  'Autorizar dos veces la misma orden no carga el saldo dos veces'
);

select throws_ok(
  format('select public.rechazar_usos(%L, ''me arrepentí'')', tests_orden(:'acme', 'autorizada')),
  'Esa solicitud ya está autorizada.',
  'Ni se puede rechazar lo ya autorizado'
);

-- =============================================================================
-- RECHAZAR NO TOCA EL LIBRO
-- =============================================================================
select tests_como(:'jefe_acme');

select lives_ok(
  'select public.solicitar_usos(40, ''segunda tanda'')',
  'Resuelta la primera, la empresa puede pedir otra'
);

select tests_como(:'doctor');

select throws_ok(
  format('select public.rechazar_usos(%L, ''   '')', tests_orden(:'acme', 'solicitada')),
  'Dile a la empresa por qué se rechaza.',
  'Rechazar sin motivo no es rechazar: es dejar a alguien sin saber qué hacer'
);

select lives_ok(
  format('select public.rechazar_usos(%L, ''No nos consta el pago.'')', tests_orden(:'acme', 'solicitada')),
  'Con motivo sí se rechaza'
);

select is(
  public.saldo_de_usos(:'acme'),
  25,
  'Y el saldo no se mueve: un rechazo no es un movimiento de cero, es ninguno'
);

select is(
  (select count(*)::int from public.ticket_ledger where organization_id = :'acme'),
  1,
  'El libro sigue teniendo una sola fila'
);

select is(
  (select motivo from public.ticket_orders where id = tests_orden(:'acme', 'rechazada')),
  'No nos consta el pago.',
  'El motivo queda guardado tal cual para que la empresa lo lea'
);

-- =============================================================================
-- SALDO
-- =============================================================================
select is(
  public.saldo_de_usos(:'globex'),
  0,
  'Una empresa sin movimientos tiene saldo cero, no saldo desconocido'
);

select tests_como(:'jefe_acme');

select is(
  public.saldo_de_usos(),
  25,
  'Sin argumento, cada empresa consulta el suyo'
);

-- =============================================================================
-- LA TABLA NO SE ESCRIBE POR LA API
--
-- Todo lo de arriba pasa por funciones que comprueban rol y estado. Estas dos
-- comprueban que no hay una puerta lateral: sin grant de escritura, conocer el
-- nombre de la tabla no sirve de nada.
-- =============================================================================
select throws_ok(
  format(
    'insert into public.ticket_ledger (organization_id, kind, cantidad, order_id, created_by)
     values (%L, ''carga'', 500, null, %L)', :'acme', :'jefe_acme'
  ),
  '42501',
  null,
  'Una empresa no se carga saldo escribiendo en el libro'
);

select throws_ok(
  format('update public.ticket_orders set cantidad = 999 where organization_id = %L', :'acme'),
  '42501',
  null,
  'Ni se corrige la cantidad de una solicitud ya enviada'
);

-- =============================================================================
-- QUEDA ESCRITO QUIÉN HIZO QUÉ
-- =============================================================================
select tests_como(:'doctor');

select is(
  (select count(distinct action)::int from public.audit_log
   where action in ('usos.solicitados', 'usos.autorizados', 'usos.rechazados')),
  3,
  'Pedir, autorizar y rechazar dejan cada uno su rastro en la auditoría'
);

select * from finish();
rollback;
