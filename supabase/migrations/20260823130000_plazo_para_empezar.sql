-- =============================================================================
-- 0057 · Cuánto tiempo hay para empezar
--
-- SPEC-EVALUACIONES.md §6.2
--
-- El compañero del ajuste anterior. La migración 0056 hizo configurable cuánto
-- se tarda en TERMINAR una prueba desde que se empieza; esto hace configurable
-- cuánto hay para EMPEZARLA desde que se envía el enlace, que hasta hoy eran
-- treinta días escritos a mano dentro de `solicitar_evaluacion`.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ ESTE VA EN LA CONSULTA Y EL OTRO EN EL INSTRUMENTO
--
-- No es simetría mal resuelta: son cosas distintas.
--
-- La ventana para terminar es una CONDICIÓN DE APLICACIÓN del instrumento —una
-- psicotécnica respondida a lo largo de tres semanas no mide lo que dice
-- medir— y cambia de una prueba a otra.
--
-- El plazo para empezar es LOGÍSTICA: cuánto tarda una empresa en conseguir
-- que su gente se siente delante de una pantalla. Eso no depende de qué prueba
-- sea, depende de cómo trabaja la consulta con sus clientes. Por eso vive en
-- los ajustes y no en el catálogo.
--
-- -----------------------------------------------------------------------------
-- NO TOCA LOS ENLACES YA EMITIDOS
--
-- `expires_at` se estampa al crear la evaluación, así que cambiar este número
-- afecta a las siguientes y no a las que ya salieron. Es lo correcto: acortar
-- el plazo no debe cerrarle el enlace a quien ya lo tiene en su correo con una
-- fecha prometida.
-- =============================================================================

alter table public.clinic_settings
  add column dias_para_empezar integer not null default 30;

comment on column public.clinic_settings.dias_para_empezar is
  'Días que tiene una persona para ABRIR su enlace desde que se le envía. No '
  'es el tiempo para terminar la prueba: eso es assessments.ventana_minutos.';

alter table public.clinic_settings
  add constraint plazo_razonable check (
    dias_para_empezar >= 1 and dias_para_empezar <= 365
  );

-- El mínimo es un día porque por debajo se mide en horas y esto no es eso: una
-- empresa que convoca por la tarde para el día siguiente sigue necesitando que
-- el enlace aguante la noche. El máximo es un año, que es donde un «plazo»
-- deja de serlo.

create or replace function public.actualizar_plazo_para_empezar(p_dias integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional configura las evaluaciones.';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'El plazo va de 1 a 365 días.';
  end if;

  /*
   * El `where` no sobra aunque la tabla tenga una sola fila.
   *
   * Supabase deja activo `safeupdate`, que rechaza cualquier UPDATE sin
   * cláusula WHERE —«UPDATE requires a WHERE clause»— y con razón: es la red
   * que impide que un descuido reescriba una tabla entera. Que aquí solo haya
   * una fila no la desactiva, y el fallo aparece en la pantalla del
   * profesional, no en la migración.
   */
  update public.clinic_settings set dias_para_empezar = p_dias where id;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'consulta.plazo_para_empezar', 'clinic_settings', 'true',
          jsonb_build_object('dias', p_dias));
end;
$$;

revoke all on function public.actualizar_plazo_para_empezar(integer) from public;
grant execute on function public.actualizar_plazo_para_empezar(integer) to authenticated;

-- =============================================================================
-- Y `solicitar_evaluacion` deja de llevarlo escrito dentro
--
-- Se BORRA antes de recrearla, y no es por gusto: pasa a devolver también la
-- fecha de caducidad, y Postgres no deja que un `create or replace` cambie el
-- tipo de retorno —«cannot change return type of existing function»—. Los
-- permisos se vuelven a conceder abajo, que es lo que un `drop` se lleva por
-- delante y lo que se olvida cuando este caso aparece con prisa.
-- =============================================================================
drop function if exists public.solicitar_evaluacion(text, text, text, text, text);

create function public.solicitar_evaluacion(
  p_assessment_clave text,
  p_nombre           text,
  p_email            text,
  p_apellidos        text default null,
  p_documento        text default null
)
returns table (assignment_id uuid, token text, vence_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_org       uuid := public.mi_organizacion();
  v_assess    uuid;
  v_saldo     integer;
  v_persona   uuid;
  v_asig      uuid;
  v_token     text;
  v_dias      integer;
  v_vence     timestamptz;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if v_org is null then
    raise exception 'Solo una empresa encarga evaluaciones.';
  end if;

  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'Hace falta el nombre de quien va a responder.';
  end if;

  -- Comprobación mínima, no validación de correo. La de verdad la hace el
  -- formulario; esto solo evita que un campo pegado a lo bruto —un nombre, una
  -- celda vacía de una hoja de cálculo— se convierta en un pase que no llega a
  -- ninguna parte y en un uso gastado.
  if coalesce(btrim(p_email), '') = '' or position('@' in p_email) < 2 then
    raise exception 'Hace falta un correo válido: es por donde le llega su enlace.';
  end if;

  select id into v_assess
  from public.assessments
  where clave = p_assessment_clave and activo;

  if v_assess is null then
    raise exception 'Esa prueba no existe o no está disponible.';
  end if;

  -- El plazo, de los ajustes. `coalesce` por si algún día la fila única
  -- faltara: mejor treinta días que una evaluación sin fecha de caducidad.
  select coalesce(dias_para_empezar, 30) into v_dias from public.clinic_settings;
  v_vence := now() + make_interval(days => coalesce(v_dias, 30));

  /*
   * EL CANDADO, y va antes de mirar el saldo.
   *
   * Leer el saldo y luego descontarlo es una carrera. Dos formularios enviados
   * a la vez con saldo 1 leen «1» los dos, los dos deciden que pueden, y los
   * dos descuentan: la empresa acaba en -1 y con dos evaluaciones que pagó una
   * vez. No es hipotético — es exactamente lo que pasa cuando alguien pulsa
   * dos veces porque la primera pareció no responder.
   *
   * `for update` sobre la fila de la organización hace que la segunda espere.
   * Cuando entra, el saldo ya es 0 y se detiene donde debe. El candado es POR
   * EMPRESA: dos empresas distintas encargando a la vez no se estorban.
   */
  perform 1 from public.organizations where id = v_org for update;

  v_saldo := coalesce(
    (select sum(cantidad)::integer from public.ticket_ledger where organization_id = v_org),
    0
  );

  if v_saldo < 1 then
    raise exception 'No te quedan usos disponibles.'
      using hint = 'Solicita más usos y el profesional los autorizará cuando confirme el pago.';
  end if;

  insert into public.organization_people
    (organization_id, nombre, apellidos, documento, email)
  values (
    v_org,
    btrim(p_nombre),
    nullif(btrim(p_apellidos), ''),
    nullif(btrim(p_documento), ''),
    btrim(p_email)
  )
  returning id into v_persona;

  -- `assigned_by` es la empresa, no el profesional. Quien encarga es quien
  -- paga, y desde este giro el profesional no interviene en la asignación.
  insert into public.assignments
    (assessment_id, person_id, organization_id, assigned_by, vence_at)
  values (v_assess, v_persona, v_org, v_uid, v_vence)
  returning id into v_asig;

  insert into public.ticket_ledger
    (organization_id, kind, cantidad, assignment_id, created_by)
  values (v_org, 'consumo', -1, v_asig, v_uid);

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into public.invitations
    (person_id, assignment_id, token, token_hash, expires_at)
  values (
    v_persona,
    v_asig,
    v_token,
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    v_vence
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'evaluacion.encargada', 'assignment', v_asig::text,
          jsonb_build_object(
            'organizacion', v_org,
            'instrumento', p_assessment_clave,
            'saldo_restante', v_saldo - 1,
            'dias_para_empezar', v_dias
          ));

  /*
   * Se devuelve también la fecha de caducidad.
   *
   * El correo de convocatoria decía «caduca en 30 días» escrito a mano, y en
   * cuanto el plazo pasó a ser configurable esa frase se volvió una mentira
   * esperando a ocurrir. Ahora el servidor pone la fecha que la base acaba de
   * estampar, no la que cree recordar.
   */
  return query select v_asig, v_token, v_vence;
end;
$$;

revoke all on function public.solicitar_evaluacion(text, text, text, text, text) from public;
grant execute on function public.solicitar_evaluacion(text, text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Y el pase que se reenvía también dice hasta cuándo vale
-- -----------------------------------------------------------------------------
comment on function public.pase_de_evaluacion(uuid) is
  'El testigo vivo de una evaluación y su fecha de caducidad, para volver a '
  'enseñar el QR o reenviar el correo sin emitir uno nuevo.';
