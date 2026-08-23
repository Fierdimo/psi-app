-- =============================================================================
-- Datos de siembra — SOLO ENTORNO LOCAL
--
-- PLAN.md §3.4: nunca datos reales de pacientes fuera de producción. Ni para
-- depurar. Todo lo que hay aquí es ficticio.
--
-- Se ejecuta automáticamente con `pnpm db:reset`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permiso EXCLUSIVO de desarrollo.
--
-- Las pruebas end-to-end necesitan borrar los consentimientos de las cuentas
-- ficticias antes de cada ejecución; sin eso, la prueba de que «el
-- consentimiento bloquea» solo pasaría la primera vez.
--
-- Vive en seed.sql y NO en una migración a propósito: seed.sql nunca corre en
-- producción. Allí un consentimiento es evidencia y no debe poder borrarse ni
-- con la clave de servicio (ver migración 0005).
-- -----------------------------------------------------------------------------
-- Se incluye SELECT junto a cada permiso de escritura: PostgREST necesita
-- leer las columnas por las que filtra para poder borrar o actualizar.
grant delete on public.consents to service_role;
grant select, update, delete on public.account_deletion_requests to service_role;
grant select, update on public.profiles to service_role;
-- Las pruebas del calendario crean y cancelan citas; la preparación reconstruye
-- el punto de partida antes de cada ejecución.
grant select, insert, update, delete on public.appointments to service_role;
-- Las pruebas del panel se crean SU PROPIA sesión confirmada en vez de tocar
-- la de la siembra: al confirmarla dejaban sin trabajo a la prueba del
-- profesional, que necesita encontrarla pendiente.
grant insert, delete on public.appointment_attendees to service_role;
grant delete on public.appointment_changes to service_role;
-- La prueba del circuito de invitación tiene que fabricar un testigo conocido:
-- en la aplicación el testigo solo existe en claro el instante del envío, y de
-- su hash no se vuelve. En producción estas tablas siguen sin escritura por
-- clave de servicio; toda alta pasa por sus funciones.
grant insert, delete on public.invitations to service_role;
grant insert, delete on public.organization_people to service_role;
-- El circuito de usos: las pruebas necesitan dejar a la empresa sin saldo y
-- sin solicitudes antes de cada ejecución. El libro se borra ANTES que las
-- órdenes —los movimientos las referencian con `on delete restrict`— y ese
-- orden lo impone la base, no una convención.
--
-- En producción estas dos tablas siguen sin escritura por clave de servicio:
-- toda carga pasa por `autorizar_usos` y todo consumo por
-- `solicitar_evaluacion`, que es lo que hace que el saldo sea auditable.
grant select, insert, update, delete on public.ticket_orders to service_role;
grant select, insert, delete on public.ticket_ledger to service_role;
-- Lectura del instrumento fuera de la aplicación, para poder comprobar la
-- calificación con los datos REALES en vez de con un instrumento inventado.
-- Sirvió para encontrar el recorte de 1000 filas de PostgREST: la pantalla
-- daba un informe verosímil y la única forma de verlo era correr el motor
-- aparte, con los mismos textos que recibe.
grant select on public.assessments        to service_role;
grant select on public.assessment_items   to service_role;
grant select on public.assessment_texts   to service_role;
-- La preparación de las pruebas necesita crear una asignación: es lo que
-- permite comprobar que la persona la encuentra en su cuenta.
grant select, insert, update, delete on public.assignments to service_role;
-- Solo para las pruebas: sembrar 68 respuestas por el navegador serían más de
-- cien clics por ejecución. En producción `service_role` únicamente lee.
grant insert, delete on public.responses to service_role;
-- Y sus resultados: la prueba del área de empresa necesita firmar un informe
-- para comprobar que aparece, sin recorrer la pantalla del profesional entera.
grant select, insert, delete on public.results       to service_role;
grant select, insert, delete on public.result_values to service_role;

-- -----------------------------------------------------------------------------
-- Parámetros de la consulta.
-- -----------------------------------------------------------------------------
-- La siembra sembraba 24 horas de antelación mínima y deshacía en silencio lo
-- que la migración 0034 había puesto en cero: reconstruir la base local
-- devolvía la regla que se acababa de quitar, y las pruebas la delataban en un
-- archivo que no tenía nada que ver.
update public.clinic_settings
set min_notice_hours = 0,
    default_duration_minutes = 60,
    jornada_inicio = '08:00',
    jornada_fin    = '17:00',
    pausa_inicio   = '12:00',
    pausa_fin      = '13:00',
    dias_laborables = '{1,2,3,4,5}',
    cancellation_policy =
      'Puedes cancelar o reprogramar hasta 24 horas antes de tu cita. '
      'Dentro de ese margen, comunícate directamente con la consulta.'
where id;

-- -----------------------------------------------------------------------------
-- Usuarios de prueba. Contraseña de todos: `psi-local-2026`
--
-- El rol de profesional se asigna AQUÍ, por migración de datos. No existe
-- pantalla para promover usuarios y esa ausencia es la decisión de seguridad
-- (PLAN.md §7.3).
-- -----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data,
  -- OJO: GoTrue lee estas columnas como texto y NO tolera NULL. Si se dejan
  -- sin valor, el inicio de sesión falla con un 500 opaco —«Database error
  -- querying schema»— y el log dice «converting NULL to string is
  -- unsupported». Tienen que ser cadena vacía.
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current
)
select
  u.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  u.email,
  crypt('psi-local-2026', gen_salt('bf')),
  now(), now(), now(),
  u.meta,
  '', '', '', '', ''
from (
  values
    ('33333333-3333-3333-3333-333333333333'::uuid, 'profesional@psi.test',
     '{"nombre":"Jesús","apellidos":"Banquez Ramírez"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'ana@psi.test',
     '{"nombre":"Ana","apellidos":"Restrepo"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'beto@psi.test',
     '{"nombre":"Beto","apellidos":"Cárdenas"}'::jsonb),
    -- Reservada para la prueba de que el consentimiento bloquea. Ninguna otra
    -- prueba la usa, así que su estado no depende del orden de ejecución.
    ('44444444-4444-4444-4444-444444444444'::uuid, 'carmen@psi.test',
     '{"nombre":"Carmen","apellidos":"Ibáñez"}'::jsonb),
    -- Cuenta de empresa, para poder recorrer su área en local.
    ('55555555-5555-5555-5555-555555555555'::uuid, 'empresa@psi.test',
     '{"nombre":"Marta","apellidos":"Ochoa"}'::jsonb)
) as u (id, email, meta)
on conflict (id) do nothing;

-- Identidad de correo. GoTrue la espera para toda cuenta con contraseña; sin
-- ella algunos flujos (cambio de correo, recuperación) se comportan de forma
-- extraña aunque el ingreso funcione.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@psi.test'
on conflict do nothing;

update public.profiles
set role = 'profesional', telefono = '+57 300 000 0000'
where id = '33333333-3333-3333-3333-333333333333';

update public.profiles
set telefono = '+57 310 111 2222', timezone = 'America/Bogota'
where id = '11111111-1111-1111-1111-111111111111';

-- Zona distinta a propósito: sirve para probar el aviso de desfase horario
-- sin tener que viajar (PLAN.md §10).
update public.profiles
set telefono = '+52 55 1234 5678', timezone = 'America/Mexico_City'
where id = '22222222-2222-2222-2222-222222222222';

-- -----------------------------------------------------------------------------
-- Citas de ejemplo, una por estado, para poder ver el calendario poblado.
--
-- Las horas se fijan en la zona de la consulta y no como desplazamiento desde
-- `now()`: calcularlas desde el instante actual las hace caer a las 02:00 o
-- las 20:00 según a qué hora se siembre, y una agenda con sesiones de
-- madrugada no sirve para revisar nada.
-- -----------------------------------------------------------------------------
/*
 * Días hábiles, no «dentro de seis días».
 *
 * La consulta atiende de lunes a viernes, así que una siembra a fecha fija cae
 * en sábado dos de cada siete veces y esas citas quedan fuera de toda franja:
 * la agenda las pinta, pero el tablero del día no ofrece un solo bloque donde
 * ponerlas. Esto empuja al lunes siguiente.
 */
create or replace function pg_temp.habil(d date) returns date
language sql immutable as $$
  select d + case extract(isodow from d) when 6 then 2 when 7 then 1 else 0 end;
$$;

insert into public.appointments (
  patient_id, professional_id, starts_at, ends_at, modality, location, status, created_by
)
values
  -- Confirmada, próxima. Es la que alimenta la tarjeta de «próxima cita».
  (
    '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
    ((pg_temp.habil(current_date + 6)) + time '10:00') at time zone 'America/Bogota',
    ((pg_temp.habil(current_date + 6)) + time '11:00') at time zone 'America/Bogota',
    'presencial', 'Consultorio 402, Av. Principal 1234', 'confirmada',
    '33333333-3333-3333-3333-333333333333'
  ),
  -- Realizada, en el pasado.
  (
    '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
    ((pg_temp.habil(current_date - 7)) + time '09:00') at time zone 'America/Bogota',
    ((pg_temp.habil(current_date - 7)) + time '10:00') at time zone 'America/Bogota',
    'presencial', 'Consultorio 402, Av. Principal 1234', 'realizada',
    '33333333-3333-3333-3333-333333333333'
  ),
  -- Solicitud pendiente de Beto: alimenta la bandeja del profesional.
  (
    '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
    ((pg_temp.habil(current_date + 9)) + time '16:00') at time zone 'America/Bogota',
    ((pg_temp.habil(current_date + 9)) + time '17:00') at time zone 'America/Bogota',
    'virtual', null, 'solicitada',
    '22222222-2222-2222-2222-222222222222'
  );


-- =============================================================================
-- Una empresa cliente, con su gente cargada.
--
-- Sirve para recorrer el área de empresa sin tener que registrarla a mano cada
-- vez que se resetea la base. Dos personas: una que ya aceptó su invitación y
-- otra que todavía no, que son los dos estados que la pantalla distingue.
-- =============================================================================
insert into public.organizations (id, nombre, nit, contacto_nombre, contacto_email, contacto_telefono)
values (
  '77777777-7777-7777-7777-777777777777',
  'Distribuciones del Caribe S.A.S',
  '900123456-7',
  'Marta Ochoa',
  'marta@distribuciones.test',
  '3005559911'
)
on conflict (id) do nothing;

update public.profiles
set role = 'empresa', organization_id = '77777777-7777-7777-7777-777777777777'
where id = '55555555-5555-5555-5555-555555555555';

-- Documentos de identidad de las cuentas personales.
--
-- No es adorno: la cédula es lo que identifica a una persona entre empresas y
-- lo que enlaza su ficha con su cuenta. Sin ella, la siembra producía un
-- estado que la aplicación NO PUEDE crear —una ficha enlazada a una cuenta sin
-- documento—, porque el único camino que las enlaza es `aceptar_invitacion`, y
-- esa función siempre lo escribe. Datos locales que mienten esconden fallos.
update public.profiles set documento = '1047373301' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set documento = '1032118844' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set documento = '1075229933' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set documento = '73115577'   where id = '33333333-3333-3333-3333-333333333333';

-- Los dos casos que conviven: quien ya trabaja allí y quien solo aspira a un
-- puesto. La mayoría de las evaluaciones son de la segunda clase.
insert into public.organization_people
  (id, organization_id, documento, nombre, apellidos, email, cargo, vinculo, profile_id)
values
  ('88888888-0000-4000-8000-000000000001',
   '77777777-7777-7777-7777-777777777777',
   '1047373301', 'Ana María', 'Restrepo', 'ana@psi.test', 'Auxiliar de bodega',
   'empleado', '11111111-1111-1111-1111-111111111111'),
  ('88888888-0000-4000-8000-000000000002',
   '77777777-7777-7777-7777-777777777777',
   '1099887766', 'Jorge', 'Salas', 'jorge@distribuciones.test', 'Conductor',
   'aspirante', null)
on conflict (id) do nothing;

-- Una sesión de evaluación solicitada, a la espera de que el profesional
-- resuelva el trámite y la confirme.
insert into public.appointments
  (id, organization_id, professional_id, starts_at, ends_at, modality, status, patient_note, created_by)
values (
  '88888888-0000-4000-8000-0000000000aa',
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  /*
   * A una hora que existe en la jornada.
   *
   * Antes se calculaba desde `now()`, así que la sesión caía a las 02:00 o a
   * las 20:00 según a qué hora se sembrara: fuera de la jornada, sin ningún
   * bloque donde repartir a nadie, y el tablero abría diciendo que ese día no
   * se atiende. La empresa PROPONE una hora; el profesional la reparte.
   */
  ((pg_temp.habil(current_date + 9)) + time '09:00') at time zone 'America/Bogota',
  ((pg_temp.habil(current_date + 9)) + time '11:00') at time zone 'America/Bogota',
  'presencial', 'solicitada',
  'Evaluación de ingreso para dos cargos operativos.',
  '55555555-5555-5555-5555-555555555555'
)
on conflict (id) do nothing;

insert into public.appointment_attendees (appointment_id, person_id)
values
  ('88888888-0000-4000-8000-0000000000aa', '88888888-0000-4000-8000-000000000001'),
  ('88888888-0000-4000-8000-0000000000aa', '88888888-0000-4000-8000-000000000002')
on conflict do nothing;

-- =============================================================================
-- Una sesión YA CONFIRMADA Y ORGANIZADA
--
-- La de arriba está pendiente: sirve para recorrer «Organizar el día» y
-- confirmar. Esta llega al estado siguiente, que sin ella había que fabricar a
-- mano cada vez que se resetea la base:
--
--   · Cada convocada con SU hora, en bloques seguidos. Es el modelo actual: la
--     cita es el encargo y la hora vive en la fila de cada persona.
--   · Sus pases creados, que es lo que permite abrir `/prueba/<testigo>` y ver
--     la evaluación sin cuenta, con su QR.
--   · La evaluación asignada, para que ese enlace lleve a una prueba de verdad
--     y no a «no tienes ninguna pendiente».
-- =============================================================================
insert into public.appointments
  (id, organization_id, professional_id, starts_at, ends_at, modality, status, patient_note, created_by)
values (
  '88888888-0000-4000-8000-0000000000bb',
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  ((pg_temp.habil(current_date + 3)) + time '14:00') at time zone 'America/Bogota',
  ((pg_temp.habil(current_date + 3)) + time '16:00') at time zone 'America/Bogota',
  'presencial', 'confirmada',
  'Segunda tanda: dos cargos de bodega.',
  '55555555-5555-5555-5555-555555555555'
)
on conflict (id) do nothing;

-- Cada una en su bloque, no las dos en el mismo rato.
insert into public.appointment_attendees
  (appointment_id, person_id, starts_at, ends_at)
values
  ('88888888-0000-4000-8000-0000000000bb', '88888888-0000-4000-8000-000000000001',
   ((pg_temp.habil(current_date + 3)) + time '14:00') at time zone 'America/Bogota',
   ((pg_temp.habil(current_date + 3)) + time '15:00') at time zone 'America/Bogota'),
  ('88888888-0000-4000-8000-0000000000bb', '88888888-0000-4000-8000-000000000002',
   ((pg_temp.habil(current_date + 3)) + time '15:00') at time zone 'America/Bogota',
   ((pg_temp.habil(current_date + 3)) + time '16:00') at time zone 'America/Bogota')
on conflict do nothing;

/*
 * Los pases, por la misma función que usa la aplicación.
 *
 * Escribirlos a mano habría dejado un estado que el código no produce —testigo
 * y hash descuadrados, por ejemplo— y esa clase de siembra esconde fallos en
 * vez de enseñarlos.
 */
select public.preparar_invitaciones('88888888-0000-4000-8000-0000000000bb');

-- Y la evaluación asignada a las dos: es lo que el pase abre.
insert into public.assignments
  (assessment_id, appointment_id, person_id, organization_id, assigned_by, status)
select a.id, '88888888-0000-4000-8000-0000000000bb', p.person_id,
       '77777777-7777-7777-7777-777777777777',
       '33333333-3333-3333-3333-333333333333', 'asignada'
from public.assessments a
cross join (
  select person_id from public.appointment_attendees
  where appointment_id = '88888888-0000-4000-8000-0000000000bb'
) p
where a.clave = 'disc_dominancia'
on conflict do nothing;
