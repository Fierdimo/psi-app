-- =============================================================================
-- Pruebas de la evaluación descartable
--
-- SPEC-EVALUACIONES.md §3.3, §4.2 · PLAN-EVALUACIONES.md F2
--
-- `solicitar_evaluacion` hace cinco cosas en una transacción: comprueba el
-- saldo, guarda los datos de quien responde, crea la evaluación, descuenta el
-- uso y emite el pase. Lo que estas pruebas persiguen no es que funcione
-- cuando sale bien —eso se ve— sino las tres formas de que salga mal:
--
--   1. Que falle a medias y deje saldo gastado sin evaluación, o al revés.
--   2. Que se pueda encargar sin saldo.
--   3. Que el pase de una persona abra la evaluación de otra.
--
-- La tercera ya costó un fallo real con el modelo anterior (migración 0042):
-- el enlace de Acme abría la prueba que encargó Globex y el informe salía
-- hacia quien no era.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(45);

delete from public.ticket_ledger;
delete from public.ticket_orders;
delete from public.result_values;
delete from public.results;
delete from public.responses;
delete from public.consents;
delete from public.invitations;
delete from public.assignments;
delete from public.appointment_changes;
delete from public.appointment_attendees;
delete from public.organization_people;
delete from public.appointments;
delete from public.audit_log;
delete from auth.users;
delete from public.organizations;

\set acme    'aaaa0000-0000-4000-8000-000000000001'
\set globex  'bbbb0000-0000-4000-8000-000000000002'

\set jefe_acme    'aaaa1111-0000-4000-8000-000000000001'
\set jefe_globex  'bbbb1111-0000-4000-8000-000000000002'
\set doctor       'dddd0000-0000-4000-8000-000000000003'

insert into public.organizations (id, nombre, contacto_email) values
  (:'acme',   'Acme S.A.S',  'pagos@acme.test'),
  (:'globex', 'Globex Ltda', 'pagos@globex.test');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'jefe_acme',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@acme.test',   '', now(), now()),
  (:'jefe_globex', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jefe@globex.test', '', now(), now()),
  (:'doctor',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@ej.test',   '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';
update public.profiles set role = 'empresa', organization_id = :'acme'   where id = :'jefe_acme';
update public.profiles set role = 'empresa', organization_id = :'globex' where id = :'jefe_globex';

/*
 * Vuelve al rol de servidor para INSPECCIONAR.
 *
 * Hace falta más aquí que en otras pruebas: `invitations` no tiene ni política
 * de lectura ni grant, a propósito —nadie la consulta por la API, se entra por
 * sus funciones o no se entra—. Así que contar pases desde el papel de la
 * empresa no da cero: da «permission denied», que es la respuesta correcta y
 * la que hace inútil la comprobación.
 *
 * La regla que se sigue abajo: se ACTÚA con el rol de quien actuaría, y se
 * INSPECCIONA con el del servidor.
 */
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

/** Carga saldo sin pasar por el circuito de compra: eso ya se prueba aparte. */
create or replace function tests_cargar(p_org uuid, p_cuantos integer, p_quien uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden uuid;
begin
  insert into public.ticket_orders
    (organization_id, cantidad, status, solicitada_por, resuelta_por, resuelta_at)
  values (p_org, p_cuantos, 'autorizada', p_quien, p_quien, now())
  returning id into v_orden;

  insert into public.ticket_ledger
    (organization_id, kind, cantidad, order_id, created_by)
  values (p_org, 'carga', p_cuantos, v_orden, p_quien);
end;
$$;

-- =============================================================================
-- SIN SALDO NO SE ENCARGA, Y NO QUEDA RASTRO
--
-- La comprobación que de verdad importa de esta tabla: que el fallo sea
-- limpio. Una función que aborta después de haber creado la ficha deja a la
-- empresa con gente cargada que nunca se evaluó y con un descuadre que nadie
-- sabrá explicar.
-- =============================================================================
select tests_como(:'jefe_acme');

select throws_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Ana'', ''ana@acme.test'')',
  'No te quedan usos disponibles.',
  'Sin saldo no se encarga una evaluación'
);

select tests_servidor_o();

select is(
  (select count(*)::int from public.organization_people),
  0,
  'Y no deja una ficha suelta'
);

select is(
  (select count(*)::int from public.assignments),
  0,
  'Ni una evaluación'
);

select is(
  (select count(*)::int from public.invitations),
  0,
  'Ni un pase que no abre nada'
);

-- =============================================================================
-- CON SALDO SÍ, Y SE DESCUENTA EXACTAMENTE UNO
-- =============================================================================
select tests_cargar(:'acme', 2, :'jefe_acme');

select tests_como(:'jefe_acme');

select is(public.saldo_de_usos(:'acme'), 2, 'La empresa arranca con dos usos');

select lives_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Ana'', ''ana@acme.test'', ''Pérez'', ''1047373301'')',
  'Con saldo, la empresa encarga una evaluación'
);

select is(public.saldo_de_usos(:'acme'), 1, 'Y el saldo baja exactamente uno');

select tests_servidor_o();

select is(
  (select count(*)::int from public.assignments where organization_id = :'acme'),
  1,
  'Queda una evaluación'
);

select is(
  (select count(*)::int from public.invitations where assignment_id is not null),
  1,
  'Con su pase, atado a ella'
);

-- El consumo apunta a la evaluación que lo gastó: es lo que permite responder
-- «¿en qué se me fue el saldo?» sin adivinar.
select is(
  (select l.assignment_id from public.ticket_ledger l where l.kind = 'consumo'),
  (select a.id from public.assignments a where a.organization_id = :'acme'),
  'Y el consumo del libro apunta a esa misma evaluación'
);

select is(
  (select cantidad from public.ticket_ledger where kind = 'consumo'),
  -1,
  'Un uso, ni más ni menos'
);

select tests_como(:'jefe_acme');

-- =============================================================================
-- LA MISMA PERSONA, DOS VECES, EN LA MISMA EMPRESA
--
-- Antes lo impedía `una_vez_por_empresa`. Es lo que el modelo descartable
-- necesita romper: en enero se evalúa como aspirante y en junio como empleada,
-- y son dos evaluaciones con dos informes.
-- =============================================================================
select lives_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Ana'', ''ana@acme.test'', ''Pérez'', ''1047373301'')',
  'La misma persona se puede evaluar dos veces en la misma empresa'
);

select is(public.saldo_de_usos(:'acme'), 0, 'Y cada vez cuesta su uso');

select throws_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Beto'', ''beto@acme.test'')',
  'No te quedan usos disponibles.',
  'Agotado el saldo, se para'
);

-- =============================================================================
-- EL DOCUMENTO NO LIMITA NADA
-- =============================================================================
select tests_cargar(:'globex', 1, :'jefe_globex');
select tests_como(:'jefe_globex');

select lives_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Carla'', ''carla@globex.test'')',
  'Sin documento también se encarga: es opcional y no bloquea el proceso'
);

select tests_servidor_o();

select is(
  (select documento from public.organization_people where email = 'carla@globex.test'),
  null,
  'Y la ficha queda sin documento, no con uno inventado'
);

-- =============================================================================
-- LO QUE NO SE ADMITE
-- =============================================================================
select tests_cargar(:'globex', 3, :'jefe_globex');

select tests_como(:'jefe_globex');

select throws_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''  '', ''x@globex.test'')',
  'Hace falta el nombre de quien va a responder.',
  'Un nombre en blanco no pasa'
);

select throws_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Dora'', ''sin-arroba'')',
  'Hace falta un correo válido: es por donde le llega su enlace.',
  'Ni un correo que no puede llegar a ninguna parte'
);

select throws_ok(
  'select * from public.solicitar_evaluacion(''inventada'', ''Dora'', ''dora@globex.test'')',
  'Esa prueba no existe o no está disponible.',
  'Ni una prueba que no está en el catálogo'
);

select is(
  public.saldo_de_usos(:'globex'),
  3,
  'Y ninguno de esos intentos gastó un uso'
);

select tests_como(:'doctor');

select throws_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Dora'', ''dora@ej.test'')',
  'Solo una empresa encarga evaluaciones.',
  'El profesional tampoco encarga: no administra ninguna empresa'
);

-- =============================================================================
-- EL PASE DE UNO NO ABRE LA EVALUACIÓN DE OTRO
--
-- El fallo que la migración 0042 tuvo que corregir con el modelo de sesiones:
-- el enlace de una empresa abría la prueba que encargó la otra, y el informe
-- salía hacia quien no era.
-- =============================================================================
select tests_servidor_o();

select is(
  (select public.asignacion_de_pase(i.token)
   from public.invitations i
   join public.organization_people op on op.id = i.person_id
   where op.email = 'carla@globex.test'),
  (select a.id from public.assignments a
   join public.organization_people op on op.id = a.person_id
   where op.email = 'carla@globex.test'),
  'Cada pase resuelve a SU evaluación, por lectura directa'
);

select throws_ok(
  'select public.asignacion_de_pase(''no-existe-este-testigo'')',
  'Este enlace no es válido.',
  'Y un testigo inventado no abre nada'
);

/* Los identificadores se resuelven ANTES de cambiar de papel: desde el de Acme
   la evaluación de Globex no se ve, que es justo lo que se va a comprobar. */
create temporary table tests_ids as
select
  (select a.id from public.assignments a where a.organization_id = :'acme'   limit 1) as de_acme,
  (select a.id from public.assignments a where a.organization_id = :'globex' limit 1) as de_globex;

grant select on tests_ids to authenticated;

-- =============================================================================
-- VOLVER A ENSEÑAR EL PASE ES COSA DE SU DUEÑO
-- =============================================================================
select tests_como(:'jefe_acme');

select throws_ok(
  format('select * from public.pase_de_evaluacion(%L)', (select de_globex from tests_ids)),
  'Esa evaluación no es tuya.',
  'Una empresa no ve el pase de la evaluación que encargó otra'
);

select is(
  (select count(*)::int
   from public.pase_de_evaluacion((select de_acme from tests_ids))
   where token is not null),
  1,
  'Pero sí el de las suyas, con su testigo para volver a pintar el QR'
);

-- =============================================================================
-- EL PASE SE APAGA, Y APAGADO NO ABRE NADA
--
-- Es la corrección de seguridad de la migración 0055. El enlace de acceso es
-- una credencial al portador: viaja por correo, se imprime en un QR y se queda
-- en el historial de un navegador. Mientras siguiera abriendo el informe,
-- cualquiera que lo tuviera podía leer un perfil psicológico con nombre.
--
-- Lo que se comprueba aquí es que apagarlo lo apaga DE VERDAD: ni la prueba,
-- ni el informe, ni el testigo guardado en claro.
-- =============================================================================
select tests_servidor_o();

create temporary table tests_pase as
select i.token, i.assignment_id
from public.invitations i
join public.organization_people op on op.id = i.person_id
where op.email = 'carla@globex.test';

select isnt(
  (select token from tests_pase),
  null,
  'Antes de apagarlo, el testigo está ahí para poder reenviar el correo'
);

select lives_ok(
  format(
    'select public.cerrar_pase(%L)',
    (select assignment_id from tests_pase)
  ),
  'El servidor apaga el pase cuando el informe ya está en pantalla'
);

select is(
  (select token from public.invitations
   where assignment_id = (select assignment_id from tests_pase)),
  null,
  'Y el testigo en claro desaparece de la base'
);

select throws_ok(
  format(
    'select public.asignacion_visible_de_pase(%L)',
    (select token from tests_pase)
  ),
  'Este enlace ya se usó.',
  'Un pase apagado no abre el informe, que es lo que había que cerrar'
);

-- =============================================================================
-- LA VENTANA PARA TERMINAR
--
-- Migración 0056. No es el plazo para EMPEZAR —ese vive en el pase y son
-- treinta días— sino cuánto tiempo hay para terminar una vez empezada. Una
-- psicotécnica respondida a lo largo de tres semanas, consultando y
-- comparando, no mide lo que dice medir.
--
-- Lo que se comprueba es lo que puede salir mal: que cierre a quien no debía
-- —el que aún no ha empezado— y que no cierre a quien sí.
-- =============================================================================
select tests_servidor_o();

-- Una evaluación viva de Acme, con su pase, para trastear con el reloj.
create temporary table tests_ventana as
select a.id as asignacion, i.token
from public.assignments a
join public.invitations i on i.assignment_id = a.id
join public.organization_people op on op.id = a.person_id
where a.organization_id = :'acme' and a.status = 'asignada'
order by a.assigned_at
limit 1;

grant select on tests_ventana to authenticated;

-- Empezada hace tres horas.
update public.assignments
set status = 'en_curso', started_at = now() - interval '3 hours'
where id = (select asignacion from tests_ventana);

-- 1 · Sin ventana configurada, nada cambia
select is(
  (select ventana_minutos from public.assessments where clave = 'disc_dominancia'),
  null,
  'El instrumento nace sin ventana: el comportamiento no cambia al desplegar'
);

select lives_ok(
  format('select public.asignacion_de_pase(%L)', (select token from tests_ventana)),
  'Sin ventana, quien empezó hace tres horas sigue pudiendo responder'
);

-- 2 · Solo el profesional la configura
select tests_como(:'jefe_acme');

select throws_ok(
  'select public.actualizar_ventana(''disc_dominancia'', 60)',
  'Solo el profesional configura las evaluaciones.',
  'Una empresa no fija el tiempo de sus propias pruebas'
);

select tests_como(:'doctor');

select throws_ok(
  'select public.actualizar_ventana(''disc_dominancia'', 2)',
  'La ventana va de 5 minutos a 24 horas.',
  'Ni el profesional puede dejar una ventana en la que no cabe la prueba'
);

select lives_ok(
  'select public.actualizar_ventana(''disc_dominancia'', 120)',
  'El profesional fija dos horas'
);

-- 3 · Y la base la hace cumplir
select tests_servidor_o();

select throws_ok(
  format('select public.asignacion_de_pase(%L)', (select token from tests_ventana)),
  'Se acabó el tiempo para completar esta evaluación.',
  'Quien empezó hace tres horas con ventana de dos ya no puede responder'
);

/*
 * La marca la deja la PANTALLA, no el rechazo.
 *
 * Una función que lanza no puede además dejar constancia: la excepción deshace
 * lo que escribió antes. Por eso rechazar y marcar viven separados, y quien
 * abre su enlace pasado el tiempo hace las dos cosas en el mismo gesto.
 */
select lives_ok(
  format('select * from public.evaluacion_de_pase(%L)', (select token from tests_ventana)),
  'Abrir el enlace pasado el tiempo no revienta: enseña en qué quedó'
);

select is(
  (select status::text from public.assignments
   where id = (select asignacion from tests_ventana)),
  'vencida',
  'Y queda marcada como vencida, para que la empresa no la vea esperando'
);

-- 4 · La ventana NO cuenta antes de empezar
--
-- Es el error que habría hecho más daño: cerrar el enlace de quien recibió el
-- correo ayer y todavía no lo ha abierto.
update public.assignments
set status = 'asignada', started_at = null
where id = (select asignacion from tests_ventana);

select lives_ok(
  format('select public.asignacion_de_pase(%L)', (select token from tests_ventana)),
  'Sin haber empezado, la ventana no corre por mucho que exista'
);

-- =============================================================================
-- EL PLAZO PARA EMPEZAR
--
-- El compañero de la ventana, y viven en sitios distintos a propósito: la
-- ventana para terminar es una condición del instrumento; el plazo para
-- empezar es logística de la consulta —cuánto tarda una empresa en sentar a su
-- gente— y no depende de qué prueba sea.
-- =============================================================================
select tests_como(:'jefe_globex');

select throws_ok(
  'select public.actualizar_plazo_para_empezar(7)',
  'Solo el profesional configura las evaluaciones.',
  'Una empresa no se alarga el plazo a sí misma'
);

select tests_como(:'doctor');

select throws_ok(
  'select public.actualizar_plazo_para_empezar(0)',
  'El plazo va de 1 a 365 días.',
  'Ni el profesional puede dejarlo en cero'
);

select is(
  (select dias_para_empezar from public.clinic_settings),
  30,
  'Nace en treinta días: el número que estaba escrito a mano antes'
);

select lives_ok(
  'select public.actualizar_plazo_para_empezar(7)',
  'El profesional lo baja a una semana'
);

-- Lo que ya se emitió conserva SU fecha: acortar el plazo no debe cerrarle el
-- enlace a quien lo tiene en su correo con una fecha prometida.
select tests_servidor_o();

create temporary table tests_antes as
select i.expires_at
from public.invitations i
join public.organization_people op on op.id = i.person_id
where op.email = 'carla@globex.test';

grant select on tests_antes to authenticated;

select cmp_ok(
  (select expires_at from tests_antes),
  '>',
  now() + interval '20 days',
  'Un pase emitido con treinta días sigue teniendo treinta, no siete'
);

-- Y lo nuevo sale con el plazo nuevo.
select tests_como(:'jefe_globex');

select lives_ok(
  'select * from public.solicitar_evaluacion(''disc_dominancia'', ''Nueva'', ''nueva@globex.test'')',
  'Se encarga otra con el plazo ya cambiado'
);

select tests_servidor_o();

select cmp_ok(
  (select i.expires_at
   from public.invitations i
   join public.organization_people op on op.id = i.person_id
   where op.email = 'nueva@globex.test'),
  '<',
  now() + interval '8 days',
  'Y esa vence en siete días, no en treinta'
);

select * from finish();
rollback;
