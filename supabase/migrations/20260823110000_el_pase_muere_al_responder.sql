-- =============================================================================
-- 0055 · El pase muere cuando el informe ya está en pantalla
--
-- SPEC-EVALUACIONES.md §8.4 · Revisión de seguridad del enlace de acceso
--
-- CORRIGE UNA DECISIÓN DE LA MIGRACIÓN 0037, Y UNA MÍA.
--
-- La 0013 lo dejó escrito como principio: «NUNCA el testigo en claro. Un
-- testigo guardado tal cual es una contraseña guardada tal cual». La 0037 lo
-- revirtió —añadió la columna `token`— por una razón práctica y buena: que la
-- empresa pudiera volver a enseñar el MISMO QR sin emitir otro que invalidara
-- el ya repartido.
--
-- Lo que no se vio entonces es que lo único que borraba ese texto en claro era
-- `aceptar_invitacion`, la vía de crear cuenta. Con las evaluaciones
-- descartables esa vía dejó de existir, y con ella el borrado: el testigo pasó
-- a vivir hasta su caducidad, y con él la llave de un informe psicológico.
--
-- Y la mía: SPEC §8.4 proponía que el pase de lectura no caducara nunca, para
-- que la persona no perdiera su informe. Eso convierte un enlace al portador en
-- una credencial permanente a un perfil psicológico con nombre. Se retira.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ AQUÍ EL PELIGRO NO ES RESPONDER, ES LEER
--
-- Responder ya está cerrado por ESTADO y no por testigo: `asignacion_de_pase`
-- solo resuelve evaluaciones en 'asignada' o 'en_curso', así que una prueba
-- enviada no se puede volver a contestar aunque el enlace circule.
--
-- Lo que el enlace seguía abriendo era el INFORME, para siempre y para
-- cualquiera que lo tuviera: el correo reenviado, el QR impreso que quedó
-- sobre una mesa, el historial de un navegador compartido.
--
-- Así que el pase se cierra en cuanto deja de hacer falta: cuando la persona
-- ya vio su informe. Ni antes —el motor puede fallar y dejarla sin nada— ni
-- después.
-- =============================================================================

alter table public.invitations
  add column usado_at timestamptz;

comment on column public.invitations.usado_at is
  'Cuándo se cerró este pase. Con valor, no abre nada: ni la prueba ni el '
  'informe. Se pone al enseñarle su informe a quien respondió.';

-- =============================================================================
-- CERRAR EL PASE
--
-- Lo llama el servidor DESPUÉS de tener el informe en la mano, no la base al
-- recibir las respuestas, y esa diferencia es deliberada.
--
-- Si se cerrara al enviar, un fallo del motor —que ocurre, y por eso el cierre
-- automático «nunca lanza»— dejaría a la persona con la prueba respondida, sin
-- informe y sin enlace por el que volver. Cerrándolo cuando el informe ya está
-- delante, el fallo se degrada a lo tolerable: el pase sigue vivo y puede
-- volver más tarde.
-- =============================================================================
create or replace function public.cerrar_pase(p_assignment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invitations
  set token    = null,
      usado_at = coalesce(usado_at, now())
  where assignment_id = p_assignment;
end;
$$;

comment on function public.cerrar_pase(uuid) is
  'Apaga el pase de una evaluación: borra el testigo en claro y lo marca '
  'usado. Irreversible a propósito.';

revoke all on function public.cerrar_pase(uuid) from public;
-- Solo el servidor. No hay pantalla que lo ofrezca ni debe haberla: no es una
-- decisión de nadie, es una consecuencia de haber terminado.
grant execute on function public.cerrar_pase(uuid) to service_role;

-- =============================================================================
-- Los dos resolutores rechazan un pase cerrado
--
-- Con su propio mensaje. «Este enlace ya venció» sería mentira y llevaría a la
-- persona a pedirle uno nuevo a la empresa, que no puede dárselo: no hay nada
-- que reabrir.
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

  if v_inv.usado_at is not null then
    raise exception 'Este enlace ya se usó.'
      using hint = 'Enviaste tus respuestas y tu informe se te mostró al terminar.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Este enlace ya venció.'
      using hint = 'Pídele uno nuevo a la empresa que te convocó.';
  end if;

  if v_inv.assignment_id is not null then
    select a.id into v_asig
    from public.assignments a
    where a.id = v_inv.assignment_id
      and a.status in ('asignada', 'en_curso');
  else
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

  if v_inv.usado_at is not null then
    raise exception 'Este enlace ya se usó.'
      using hint = 'Enviaste tus respuestas y tu informe se te mostró al terminar.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Este enlace ya venció.'
      using hint = 'Pídele uno nuevo a la empresa que te convocó.';
  end if;

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
-- El informe, por identificador y no por testigo
--
-- Es lo que permite enseñárselo a quien acaba de responder SIN volver a pasar
-- por el enlace: el servidor ya sabe qué evaluación acaba de cerrar, así que
-- no hay ninguna razón para que el testigo vuelva a viajar. Y como no vuelve a
-- viajar, se puede apagar en el mismo gesto.
-- =============================================================================
create or replace function public.informe_publicado(p_assignment uuid)
returns table (
  parameter_key text,
  etiqueta      text,
  valor         jsonb,
  texto         text,
  nota_global   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.assignment_status;
begin
  select status into v_estado from public.assignments where id = p_assignment;

  -- Solo lo publicado. Un informe a medio calificar no es un informe.
  if v_estado is distinct from 'publicada' then
    return;
  end if;

  return query
  select rv.parameter_key,
         coalesce(p.etiqueta, rv.parameter_key),
         rv.valor,
         coalesce(rv.nota, rv.sugerido),
         r.nota_global
  from public.result_values rv
  join public.results r on r.assignment_id = rv.assignment_id
  left join public.assessment_parameters p
    on p.assessment_id = (select assessment_id from public.assignments where id = p_assignment)
   and p.clave = rv.parameter_key
  where rv.assignment_id = p_assignment
  order by p.posicion nulls last, rv.parameter_key;
end;
$$;

revoke all on function public.informe_publicado(uuid) from public;
-- Solo el servidor: quien pregunta por identificador ya demostró quién es por
-- otro camino. `anon` sigue teniendo únicamente `informe_de_pase`, que exige
-- el testigo.
grant execute on function public.informe_publicado(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Y también los pases heredados
--
-- La primera versión de `cerrar_pase` cerraba por `assignment_id`, que es como
-- se atan los pases desde la migración 0054. Los emitidos antes NO lo llevan:
-- se resuelven por la convocatoria a la que pertenecen (`person_id` +
-- `appointment_id`), y por tanto sobrevivían al cierre.
--
-- Un control de seguridad con un agujero que depende de la FORMA del dato es
-- peor que no tenerlo, porque parece que está. Se cierran los dos.
--
-- Se descubrió al comprobar el circuito de extremo a extremo, cuyo fixture usa
-- justamente la forma heredada.
-- -----------------------------------------------------------------------------
create or replace function public.cerrar_pase(p_assignment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invitations i
  set token    = null,
      usado_at = coalesce(i.usado_at, now())
  from public.assignments a
  where a.id = p_assignment
    and (
      i.assignment_id = a.id
      or (
        i.assignment_id is null
        and i.person_id = a.person_id
        and i.appointment_id is not distinct from a.appointment_id
      )
    );
end;
$$;

revoke all on function public.cerrar_pase(uuid) from public;
grant execute on function public.cerrar_pase(uuid) to service_role;
