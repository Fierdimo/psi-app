-- =============================================================================
-- 0042 · Las evaluaciones de empresa son de la empresa, no de la persona
--
-- Tres consecuencias del modelo descartable que el código todavía no cumplía, y
-- las tres salen de la misma idea: la evaluación que encarga una empresa vive
-- atada a ESA convocatoria, no a la persona ni a su cuenta.
--
-- 1 · NO APARECE EN SU PERFIL. `mi_asignacion` reconocía como propia cualquier
--     evaluación cuya ficha estuviera enlazada a la cuenta, así que a quien ya
--     tenía cuenta le salían en «Mis evaluaciones» las pruebas que le encargó
--     un empleador. No son suyas en ese sentido: las pidió otro, el informe va
--     a otro, y mezclarlas con su historia personal confunde dos cosas que el
--     resto del sistema separa con cuidado.
--
-- 2 · VARIAS EMPRESAS A LA VEZ. `asignacion_de_pase` resolvía el testigo a «la
--     evaluación viva más reciente de esa persona». Con dos empresas eso es un
--     fallo de verdad: el enlace de Acme abría la prueba que encargó Globex, y
--     el informe salía hacia quien no era. Ahora resuelve por la convocatoria a
--     la que pertenece el testigo.
--
-- 3 · PUEDE REPETIR EL MISMO EXAMEN. Ya lo permitía el índice único, que es por
--     (cita, persona, instrumento) y no por (persona, instrumento). Se deja
--     dicho aquí porque es una decisión, no una casualidad: dos empresas
--     distintas piden el mismo DISC y cada una recibe el suyo.
--
-- Y una consecuencia de la primera que hay que atender o se rompe el circuito:
-- si las corporativas ya no se ven desde la cuenta, TODO EL MUNDO necesita
-- pase, tenga cuenta o no. Antes solo se creaba para quien no la tenía.
-- =============================================================================

create or replace function public.mi_asignacion(p_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  /*
   * Solo las evaluaciones que son de la PERSONA, no las que le encargaron.
   *
   * Antes bastaba con que su ficha de empleado estuviera enlazada a la cuenta.
   * Eso hacía dos cosas indeseadas: se las mostraba en su espacio privado, y le
   * permitía responderlas desde ahí en vez de por su pase — dos caminos hacia
   * la misma prueba, y solo uno pensado.
   */
  select exists (
    select 1
    from public.assignments a
    where a.id = p_assignment
      and a.patient_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- Todo el mundo necesita su pase
-- -----------------------------------------------------------------------------

create or replace function public.preparar_invitaciones(p_appointment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fin   timestamptz;
  v_org   uuid;
  v_fila  record;
  v_token text;
  v_hechas integer := 0;
begin
  select ends_at, organization_id into v_fin, v_org
  from public.appointments where id = p_appointment_id;

  if v_org is null then
    return 0;
  end if;

  for v_fila in
    select op.id
    from public.appointment_attendees aa
    join public.organization_people op on op.id = aa.person_id
    where aa.appointment_id = p_appointment_id
      /*
       * Sin filtrar por cuenta.
       *
       * Antes solo se creaba para quien no tenía: se daba por hecho que quien
       * la tenía entraría por ahí. Con las corporativas fuera del perfil, esa
       * puerta ya no existe y quien tuviera cuenta se quedaba sin ninguna.
       */
      and not exists (
        select 1 from public.invitations i
        where i.person_id = op.id
          and i.appointment_id = p_appointment_id
          and i.accepted_at is null
          and i.expires_at > now()
          and i.token is not null
      )
  loop
    v_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');

    insert into public.invitations
      (person_id, appointment_id, token, token_hash, expires_at)
    values (
      v_fila.id,
      p_appointment_id,
      v_token,
      encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
      v_fin + interval '30 days'
    );

    v_hechas := v_hechas + 1;
  end loop;

  return v_hechas;
end;
$$;

revoke all on function public.preparar_invitaciones(uuid) from public;
grant execute on function public.preparar_invitaciones(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- El pase resuelve a SU convocatoria
-- -----------------------------------------------------------------------------

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

  /*
   * Por la CITA del testigo, no por la persona.
   *
   * Antes se cogía «la evaluación viva más reciente» de esa persona. Con dos
   * empresas convocándola a la vez, el enlace de una abría la prueba de la
   * otra: la persona respondía creyendo que era para Acme y el informe salía
   * hacia Globex. Cada testigo pertenece a una convocatoria y solo abre la
   * evaluación de esa.
   */
  select a.id into v_asig
  from public.assignments a
  where a.person_id = v_inv.person_id
    and a.appointment_id is not distinct from v_inv.appointment_id
    and a.status in ('asignada', 'en_curso')
  order by a.assigned_at desc
  limit 1;

  if v_asig is null then
    raise exception 'No tienes ninguna evaluación pendiente con este enlace.'
      using hint = 'Puede que ya la hayas enviado.';
  end if;

  return v_asig;
end;
$$;

revoke all on function public.asignacion_de_pase(text) from public;

-- -----------------------------------------------------------------------------
-- Los pases se enseñan para todos
-- -----------------------------------------------------------------------------

create or replace function public.pases_de_acceso(p_appointment_id uuid)
returns table (
  person_id    uuid,
  nombre       text,
  apellidos    text,
  documento    text,
  email        text,
  tiene_cuenta boolean,
  token        text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
  v_mia    uuid := public.mi_organizacion();
begin
  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La sesión no existe.';
  end if;

  if v_org is null then
    raise exception 'Los pases son para sesiones de evaluación de una empresa.';
  end if;

  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esta sesión no es tuya.';
  end if;

  if v_estado not in ('confirmada', 'realizada') then
    raise exception 'La sesión debe estar confirmada para repartir accesos.'
      using hint = 'Hasta que el profesional la acepte, la fecha puede cambiar.';
  end if;

  return query
  select op.id, op.nombre, op.apellidos, op.documento, op.email,
         op.profile_id is not null,
         /*
          * El testigo de ESTA convocatoria.
          *
          * Antes se buscaba el más reciente de la persona, sin mirar la cita:
          * con dos empresas, la pantalla de una enseñaba el enlace de la otra.
          */
         (
           select i.token
           from public.invitations i
           where i.person_id = op.id
             and i.appointment_id = p_appointment_id
             and i.accepted_at is null
             and i.expires_at > now()
             and i.token is not null
           order by i.created_at desc
           limit 1
         )
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  where aa.appointment_id = p_appointment_id
  order by op.nombre, op.apellidos;
end;
$$;

grant execute on function public.pases_de_acceso(uuid) to authenticated;
