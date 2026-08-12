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
grant select, insert, delete on public.appointments to service_role;
grant delete on public.appointment_changes to service_role;

-- -----------------------------------------------------------------------------
-- Parámetros de la consulta.
-- -----------------------------------------------------------------------------
update public.clinic_settings
set min_notice_hours = 24,
    default_duration_minutes = 60,
    cancellation_policy =
      'Puedes cancelar o reprogramar hasta 24 horas antes de tu cita. '
      'Dentro de ese margen, comunícate directamente con la consulta.';

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
     '{"nombre":"Elena","apellidos":"Herrera"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'ana@psi.test',
     '{"nombre":"Ana","apellidos":"Restrepo"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'beto@psi.test',
     '{"nombre":"Beto","apellidos":"Cárdenas"}'::jsonb),
    -- Reservada para la prueba de que el consentimiento bloquea. Ninguna otra
    -- prueba la usa, así que su estado no depende del orden de ejecución.
    ('44444444-4444-4444-4444-444444444444'::uuid, 'carmen@psi.test',
     '{"nombre":"Carmen","apellidos":"Ibáñez"}'::jsonb)
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
insert into public.appointments (
  patient_id, professional_id, starts_at, ends_at, modality, location, status, created_by
)
values
  -- Confirmada, próxima. Es la que alimenta la tarjeta de «próxima cita».
  (
    '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
    ((current_date + 6) + time '10:00') at time zone 'America/Bogota',
    ((current_date + 6) + time '11:00') at time zone 'America/Bogota',
    'presencial', 'Consultorio 402, Av. Principal 1234', 'confirmada',
    '33333333-3333-3333-3333-333333333333'
  ),
  -- Realizada, en el pasado.
  (
    '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
    ((current_date - 7) + time '09:00') at time zone 'America/Bogota',
    ((current_date - 7) + time '10:00') at time zone 'America/Bogota',
    'presencial', 'Consultorio 402, Av. Principal 1234', 'realizada',
    '33333333-3333-3333-3333-333333333333'
  ),
  -- Solicitud pendiente de Beto: alimenta la bandeja del profesional.
  (
    '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
    ((current_date + 9) + time '16:00') at time zone 'America/Bogota',
    ((current_date + 9) + time '17:00') at time zone 'America/Bogota',
    'virtual', null, 'solicitada',
    '22222222-2222-2222-2222-222222222222'
  );
