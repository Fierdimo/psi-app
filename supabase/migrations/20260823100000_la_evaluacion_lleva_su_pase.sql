-- =============================================================================
-- 0054 · La evaluación lleva su pase, y se paga con un uso
--
-- SPEC-EVALUACIONES.md §3.3, §4.2, §5 · PLAN-EVALUACIONES.md F2
--
-- Aquí se corta el último hilo que ataba una evaluación a una cita. Hasta hoy
-- el pase era DE LA SESIÓN: se emitía al confirmarla y se resolvía buscando
-- «la evaluación de esta persona en esta cita». Ese rodeo existía porque la
-- unidad era la sesión. Ahora la unidad es la evaluación, y el pase es suyo:
-- uno por evaluación, resuelto por lectura directa.
--
-- Y con él entra la función que gasta un uso. Descontar y encargar tienen que
-- ser el MISMO acto: si fueran dos, existiría un instante en que el saldo bajó
-- y no hay ninguna prueba que lo justifique, y ese instante siempre acaba
-- ocurriendo.
--
-- -----------------------------------------------------------------------------
-- ESTA MIGRACIÓN NO BORRA NADA
--
-- Ni una columna, ni una función, ni una política. `profile_id`, `vinculo` y
-- `cargo` siguen donde estaban aunque el modelo nuevo no los use, porque sus
-- lectores —`editar_persona`, `pase_de_persona`, `reparto_de_sesion`,
-- `aceptar_invitacion`— siguen vivos y con pantallas encima.
--
-- Quitarlos ahora tendría además una forma de fallo especialmente mala:
-- Postgres no analiza los cuerpos `plpgsql` al crearlos, así que una función
-- que lea una columna borrada sobrevive al `drop`, compila, y revienta el día
-- que alguien la llame. Se retiran cuando se retiren sus pantallas, y no
-- antes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La ficha deja de identificar a nadie
--
-- El documento era OBLIGATORIO y ÚNICO por empresa, y las dos cosas tenían su
-- razón mientras existían las cuentas: era lo que permitía reconocer que quien
-- aceptaba la invitación de Globex era la misma persona que ya había evaluado
-- Acme, y enlazarla a su cuenta en vez de partirle el historial en dos.
--
-- Ya no hay cuentas que enlazar ni historial que partir. Quien responde no es
-- un usuario de esta plataforma: es un nombre, un correo y unos resultados
-- colgados de la evaluación que los motivó.
--
-- Así que el documento pasa a ser lo único que puede ser: una etiqueta que la
-- empresa se pone a sí misma para distinguir dos homónimos en una tanda de
-- cuarenta. Opcional, y sin poder de veto sobre nada.
-- -----------------------------------------------------------------------------
alter table public.organization_people
  alter column documento drop not null;

-- `una_vez_por_empresa` es justo lo que el modelo nuevo necesita romper: la
-- misma persona puede ser evaluada dos veces por la misma empresa, en enero y
-- en junio, y son dos evaluaciones con dos informes.
alter table public.organization_people
  drop constraint una_vez_por_empresa;

-- `documento_no_vacio` SE QUEDA, y no por descuido. Un check sobre una columna
-- nula se salta —`btrim(null) <> ''` es null, y un check solo falla con
-- false—, así que sigue haciendo exactamente lo que hacía: admitir «sin
-- documento» y rechazar «documento en blanco», que son dos cosas distintas.

comment on column public.organization_people.documento is
  'Etiqueta opcional de la empresa para distinguir homónimos. Ya no identifica '
  'a nadie: no se valida, no se compara y no impide nada.';

comment on table public.organization_people is
  'Los datos de quien fue evaluado, colgados de su evaluación. No es un '
  'listado de plantilla ni una identidad: una fila por evaluación encargada.';

-- -----------------------------------------------------------------------------
-- 2 · El pase es de la evaluación
-- -----------------------------------------------------------------------------
alter table public.invitations
  add column assignment_id uuid references public.assignments (id) on delete cascade;

comment on column public.invitations.assignment_id is
  'La evaluación que este pase abre. Nulo en los pases heredados, que se '
  'resolvían por la cita y vencen solos.';

create index invitations_assignment_idx
  on public.invitations (assignment_id)
  where assignment_id is not null;

-- =============================================================================
-- Los dos resolutores
--
-- Siguen siendo dos —uno para ACTUAR y otro para LEER— por lo mismo que en
-- 0043: nadie responde una prueba ya enviada, pero todo el mundo puede releer
-- su informe.
--
-- Los dos ganan un camino nuevo y CONSERVAN el viejo. Hay invitaciones vivas
-- en la base emitidas con el modelo de sesión: llevan `appointment_id` y no
-- llevan `assignment_id`. Romperlas dejaría a gente con un enlace en el correo
-- que deja de abrir. Vencen solas en 30 días y entonces el camino heredado se
-- podrá quitar.
-- =============================================================================
create or replace function public.asignacion_de_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  record;
  v_asig uuid;
begin
  select * into v_inv
  from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  if v_inv is null then
    raise exception 'Este enlace no es válido.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Este enlace ya venció.'
      using hint = 'Pídele uno nuevo a la empresa que te convocó.';
  end if;

  if v_inv.assignment_id is not null then
    -- El camino nuevo: una lectura. El pase ES de esta evaluación y de ninguna
    -- otra, así que no hay nada que deducir ni nada que confundir.
    select a.id into v_asig
    from public.assignments a
    where a.id = v_inv.assignment_id
      and a.status in ('asignada', 'en_curso');
  else
    -- El camino heredado, intacto: por la convocatoria del testigo.
    select a.id into v_asig
    from public.assignments a
    where a.person_id = v_inv.person_id
      and a.appointment_id is not distinct from v_inv.appointment_id
      and a.status in ('asignada', 'en_curso')
    order by a.assigned_at desc
    limit 1;
  end if;

  if v_asig is null then
    raise exception 'No tienes ninguna evaluación pendiente con este enlace.'
      using hint = 'Puede que ya la hayas enviado.';
  end if;

  return v_asig;
end;
$$;

revoke all on function public.asignacion_de_pase(text) from public;

create or replace function public.asignacion_visible_de_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  record;
  v_asig uuid;
begin
  select * into v_inv
  from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  if v_inv is null then
    raise exception 'Este enlace no es válido.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Este enlace ya venció.'
      using hint = 'Pídele uno nuevo a la empresa que te convocó.';
  end if;

  -- Cualquier estado: para leer, una prueba enviada o publicada también cuenta.
  if v_inv.assignment_id is not null then
    select a.id into v_asig
    from public.assignments a
    where a.id = v_inv.assignment_id;
  else
    select a.id into v_asig
    from public.assignments a
    where a.person_id = v_inv.person_id
      and a.appointment_id is not distinct from v_inv.appointment_id
    order by a.assigned_at desc
    limit 1;
  end if;

  if v_asig is null then
    raise exception 'Este enlace no tiene ninguna evaluación.';
  end if;

  return v_asig;
end;
$$;

revoke all on function public.asignacion_visible_de_pase(text) from public;

-- =============================================================================
-- ENCARGAR UNA EVALUACIÓN
--
-- La función central del producto nuevo. Hace cinco cosas y las hace en una
-- sola transacción, que es el punto entero:
--
--   1. Comprueba que quedan usos.
--   2. Guarda los datos de a quién se evalúa.
--   3. Crea la evaluación.
--   4. Descuenta el uso, apuntando a la evaluación que lo gastó.
--   5. Emite el pase.
--
-- Si cualquiera falla, no queda nada: ni ficha suelta, ni saldo perdido, ni un
-- pase que no abre nada. Partirlo en dos llamadas desde la aplicación —crear
-- y luego descontar— dejaría un hueco entre las dos, y el hueco es justo donde
-- se pierde el dinero de alguien.
--
-- DEVUELVE EL TESTIGO EN CLARO, una única vez, para que el servidor lo ponga
-- en el correo y en el QR. En la tabla también queda el testigo, y eso es
-- deliberado desde 0037: la empresa tiene que poder volver a enseñar el mismo
-- QR sin generar uno nuevo que invalide el que ya se repartió.
-- =============================================================================
create or replace function public.solicitar_evaluacion(
  p_assessment_clave text,
  p_nombre           text,
  p_email            text,
  p_apellidos        text default null,
  p_documento        text default null
)
returns table (assignment_id uuid, token text)
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
  v_vence     timestamptz := now() + interval '30 days';
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
            'saldo_restante', v_saldo - 1
          ));

  return query select v_asig, v_token;
end;
$$;

revoke all on function public.solicitar_evaluacion(text, text, text, text, text) from public;
grant execute on function public.solicitar_evaluacion(text, text, text, text, text) to authenticated;

-- =============================================================================
-- VOLVER A ENSEÑAR EL PASE
--
-- Sustituye a `pases_de_acceso(cita)`, que devolvía la lista entera de una
-- sesión. Sin sesiones, se pide de uno en uno: el enlace y el QR viven en la
-- pantalla de su evaluación.
--
-- No emite nada. Devuelve el testigo que ya existe, y si no existe devuelve
-- nulo en vez de fabricar otro: un pase nuevo invalidaría el que la persona ya
-- tiene en su correo.
-- =============================================================================
create or replace function public.pase_de_evaluacion(p_assignment uuid)
returns table (
  nombre    text,
  apellidos text,
  email     text,
  documento text,
  token     text,
  vence_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select a.organization_id into v_org
  from public.assignments a
  where a.id = p_assignment;

  if v_org is null then
    raise exception 'Esa evaluación no existe, o no la encargó ninguna empresa.';
  end if;

  if not public.is_professional() and v_org is distinct from public.mi_organizacion() then
    raise exception 'Esa evaluación no es tuya.';
  end if;

  return query
  select op.nombre, op.apellidos, op.email, op.documento, i.token, i.expires_at
  from public.assignments a
  join public.organization_people op on op.id = a.person_id
  left join public.invitations i
    on i.assignment_id = a.id
   and i.token is not null
  where a.id = p_assignment;
end;
$$;

revoke all on function public.pase_de_evaluacion(uuid) from public;
grant execute on function public.pase_de_evaluacion(uuid) to authenticated;

-- =============================================================================
-- 3 · `cargar_personas` deja de hacer upsert
--
-- Es la única víctima colateral de haber quitado `una_vez_por_empresa`, y hay
-- que atenderla aquí o no arranca nada: la función hacía
-- `on conflict (organization_id, documento) do update`, y sin esa restricción
-- Postgres responde «there is no unique or exclusion constraint matching the
-- ON CONFLICT specification» en la primera llamada.
--
-- Esta función es de la era del calendario —la carga del listado de plantilla,
-- desde `/empresa/personas`— y se retira entera con su pantalla. Lo que se
-- hace aquí es lo mínimo para que siga en pie hasta entonces: insertar en vez
-- de refundir.
--
-- El cambio de comportamiento es real y se acepta a sabiendas: cargar dos
-- veces el mismo documento ya no corrige la ficha anterior, crea otra. Es
-- justo lo que el modelo nuevo quiere —dos evaluaciones de la misma persona
-- son dos fichas— y en la pantalla vieja es un caso que quedará muerto antes
-- de que le importe a nadie.
-- =============================================================================
create or replace function public.cargar_personas(p_personas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.mi_organizacion();
  v_persona  jsonb;
  v_doc      text;
  v_email    text;
  v_vinculo  public.person_link;
  v_cuantas  integer := 0;
begin
  if not public.soy_empresa() then
    raise exception 'Solo una cuenta de empresa puede cargar personal.';
  end if;

  if jsonb_typeof(p_personas) <> 'array' then
    raise exception 'Se esperaba una lista de personas.';
  end if;

  for v_persona in select * from jsonb_array_elements(p_personas)
  loop
    v_doc   := btrim(coalesce(v_persona ->> 'documento', ''));
    v_email := btrim(coalesce(v_persona ->> 'email', ''));

    if v_doc = '' then
      raise exception 'Cada persona necesita su documento de identidad.'
        using hint = 'Es lo que permite reconocerla si otra empresa ya la evaluó.';
    end if;

    if v_email = '' then
      raise exception 'Falta el correo de %, y sin él no se le puede invitar.', v_doc;
    end if;

    v_vinculo := coalesce(
      nullif(btrim(coalesce(v_persona ->> 'vinculo', '')), '')::public.person_link,
      'aspirante'
    );

    insert into public.organization_people
      (organization_id, documento, nombre, apellidos, email, cargo, vinculo)
    values (
      v_org, v_doc,
      btrim(coalesce(v_persona ->> 'nombre', '')),
      nullif(btrim(coalesce(v_persona ->> 'apellidos', '')), ''),
      v_email,
      nullif(btrim(coalesce(v_persona ->> 'cargo', '')), ''),
      v_vinculo
    );

    v_cuantas := v_cuantas + 1;
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), 'personal.cargado', 'organization', v_org::text,
          jsonb_build_object('cuantas', v_cuantas));

  return v_cuantas;
end;
$$;
