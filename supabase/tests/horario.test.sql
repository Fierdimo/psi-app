-- =============================================================================
-- El horario de la consulta
--
-- La duración de una cita la decidía quien la pedía. Ahora la declara el
-- profesional y de ahí salen las franjas, así que lo que hay que comprobar es
-- justo eso: que de una jornada salen las franjas que se esperan, que la pausa
-- abre un hueco de verdad, que un día no laborable no ofrece nada, y que sigue
-- siendo el profesional —y nadie más— quien lo define.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(8);

delete from public.assignments;
delete from public.appointment_changes;
delete from public.appointments;
delete from public.consents;
delete from public.audit_log;
delete from auth.users;

\set doctor   'dddd1111-0000-4000-8000-000000000a01'
\set paciente 'cccc1111-0000-4000-8000-000000000a02'

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  (:'doctor',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doc@ho.test', '', now(), now()),
  (:'paciente', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pac@ho.test', '', now(), now());

update public.profiles set role = 'profesional' where id = :'doctor';

create or replace function tests_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

-- =============================================================================
-- SOLO EL PROFESIONAL DEFINE SU JORNADA
-- =============================================================================
select tests_como(:'paciente');

select throws_ok(
  $$select public.actualizar_horario('08:00', '17:00', 60)$$,
  'P0001',
  'Solo el profesional define su horario.',
  'Un paciente no reorganiza la agenda de la consulta'
);

select tests_como(:'doctor');

-- =============================================================================
-- DE LA JORNADA SALEN LAS FRANJAS
--
-- Ocho horas en bloques de sesenta minutos son ocho citas. Es la cuenta que el
-- profesional necesita para responder «¿a cuánta gente atiendo el jueves?».
-- =============================================================================
select public.actualizar_horario('08:00', '16:00', 60, null, null, '{1,2,3,4,5}');

select is(
  (select count(*)::int from public.franjas_del_dia(date '2026-08-20')),
  8,
  'Una jornada de ocho horas en bloques de una hora da ocho franjas'
);

select is(
  (select min(inicio) from public.franjas_del_dia(date '2026-08-20')),
  (date '2026-08-20' + time '08:00') at time zone 'America/Bogota',
  'La primera empieza a la hora de entrada, en la zona de la consulta'
);

-- =============================================================================
-- LA PAUSA ABRE UN HUECO DE VERDAD
--
-- No parte la jornada en dos: se salta cualquier franja que la toque. Con una
-- hora de almuerzo, quedan siete.
-- =============================================================================
select public.actualizar_horario('08:00', '16:00', 60, '12:00', '13:00', '{1,2,3,4,5}');

select is(
  (select count(*)::int from public.franjas_del_dia(date '2026-08-20')),
  7,
  'La hora de pausa desaparece de las franjas'
);

select is(
  (select count(*)::int from public.franjas_del_dia(date '2026-08-20')
   where inicio = (date '2026-08-20' + time '12:00') at time zone 'America/Bogota'),
  0,
  'Y no se ofrece justo la franja del almuerzo'
);

-- =============================================================================
-- UN DÍA QUE NO SE ATIENDE NO OFRECE NADA
-- =============================================================================
select is(
  (select count(*)::int from public.franjas_del_dia(date '2026-08-22')),
  0,
  'El sábado no tiene franjas si no está entre los días laborables'
);

-- =============================================================================
-- LO QUE LA BASE NO DEJA PASAR
-- =============================================================================
select throws_ok(
  $$select public.actualizar_horario('08:00', '16:00', 0)$$,
  'P0001',
  'La duración de un bloque va de 5 a 480 minutos.',
  'Un bloque de cero minutos generaría franjas infinitas'
);

select throws_ok(
  $$select public.actualizar_horario('08:00', '16:00', 60, null, null, '{}')$$,
  'P0001',
  'Elige al menos un día de atención.',
  'Sin días laborables no se puede agendar nada'
);

select finish();

rollback;
