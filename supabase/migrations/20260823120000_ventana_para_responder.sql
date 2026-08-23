-- =============================================================================
-- 0056 · Cuánto dura el enlace una vez que se empieza
--
-- SPEC-EVALUACIONES.md §8.4
--
-- Hasta ahora el pase tenía UN plazo: treinta días para empezar. Quien empezaba
-- y dejaba la prueba a medias podía volver el día veintinueve y seguir donde la
-- dejó — con el cuestionario abierto todo ese tiempo.
--
-- Para una psicotécnica de selección eso no sirve. Una prueba que se responde a
-- lo largo de tres semanas, consultando, comparando y preguntando, no mide lo
-- que dice medir. La ventana no es una regla de negocio arbitraria: es parte de
-- las condiciones de aplicación del instrumento.
--
-- -----------------------------------------------------------------------------
-- DOS PLAZOS DISTINTOS, Y CONVIENE NO CONFUNDIRLOS
--
--   · `invitations.expires_at` — cuánto tiempo hay para EMPEZAR. Lo fija quien
--     encarga (hoy, treinta días) y cuenta desde que se envía el correo.
--   · `assessments.ventana_minutos` — cuánto tiempo hay para TERMINAR una vez
--     empezada. Lo fija el profesional, por instrumento, y cuenta desde
--     `started_at`.
--
-- El segundo es el que entra aquí. Van por separado porque responden a cosas
-- distintas: el primero es logística de la empresa —cuándo consigue que su
-- gente se siente—; el segundo es una condición del instrumento.
-- =============================================================================

alter table public.assessments
  add column ventana_minutos integer;

comment on column public.assessments.ventana_minutos is
  'Minutos para terminar desde que se empieza. Nulo = sin límite. NO es el '
  'plazo para empezar, que vive en invitations.expires_at.';

alter table public.assessments
  add constraint ventana_razonable check (
    ventana_minutos is null or (ventana_minutos >= 5 and ventana_minutos <= 1440)
  );

-- El mínimo no es capricho: por debajo de cinco minutos ningún instrumento de
-- este catálogo se puede terminar, y lo único que se consigue es que nadie
-- pueda responder. El máximo son veinticuatro horas — más que eso ya no es una
-- ventana, es no tener ninguna, y para eso está el nulo.

/*
 * NACE EN NULO, a propósito.
 *
 * Poner aquí un valor por defecto —tres horas, pongamos— cerraría de golpe las
 * pruebas que estuvieran a medias en el momento de desplegar, sin que nadie lo
 * hubiera decidido y sin que la persona pudiera hacer nada. El comportamiento
 * no cambia hasta que el profesional entra a su configuración y elige.
 */

-- =============================================================================
-- El profesional fija la ventana
-- =============================================================================
create or replace function public.actualizar_ventana(
  p_clave    text,
  p_minutos  integer
)
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

  if p_minutos is not null and (p_minutos < 5 or p_minutos > 1440) then
    raise exception 'La ventana va de 5 minutos a 24 horas.'
      using hint = 'Déjala vacía si no quieres ningún límite.';
  end if;

  update public.assessments
  set ventana_minutos = p_minutos
  where clave = p_clave;

  if not found then
    raise exception 'Ese instrumento no existe.';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'instrumento.ventana', 'assessment', p_clave,
          jsonb_build_object('minutos', p_minutos));
end;
$$;

revoke all on function public.actualizar_ventana(text, integer) from public;
grant execute on function public.actualizar_ventana(text, integer) to authenticated;

-- =============================================================================
-- Y la base la hace cumplir
--
-- En `asignacion_de_pase`, que es el único sitio por el que pasa TODO lo que se
-- hace con un pase: consentir, empezar, responder cada ítem y enviar. Ponerlo
-- en la pantalla dejaría la puerta abierta a quien no use la pantalla.
--
-- -----------------------------------------------------------------------------
-- AQUÍ SOLO SE RECHAZA. MARCAR `vencida` ES OTRA COSA Y VA EN OTRO SITIO.
--
-- La primera versión hacía las dos aquí: `update ... set status = 'vencida'` y
-- acto seguido `raise exception`. No funciona, y falla en silencio: la
-- excepción deshace todo lo que la función escribió antes, incluido ese
-- `update`. La evaluación se quedaba en «en curso» para siempre y la prueba lo
-- destapó pidiendo el estado después de rechazar.
--
-- La regla que sale de ahí, y que vale para todo este esquema: una función que
-- lanza no puede además dejar constancia de nada. O escribe, o rechaza.
--
-- Así que se reparte: el camino de LECTURA —`evaluacion_de_pase`, lo que pinta
-- la pantalla— marca la evaluación como vencida, porque no lanza y por tanto
-- su escritura se confirma; el de ACTUAR rechaza. Quien abre su enlace pasado
-- el tiempo hace las dos cosas en el mismo gesto.
-- =============================================================================
create or replace function public.asignacion_de_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv     record;
  v_asig    uuid;
  v_vencida boolean;
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

  /*
   * ¿Se acabó el tiempo desde que empezó?
   *
   * Solo cuenta si YA EMPEZÓ: mientras no haya `started_at` no hay reloj que
   * corriera, y quien recibió el enlace ayer y aún no lo ha abierto no debe
   * encontrárselo cerrado.
   */
  select a.started_at is not null
     and s.ventana_minutos is not null
     and a.started_at + make_interval(mins => s.ventana_minutos) < now()
    into v_vencida
  from public.assignments a
  join public.assessments s on s.id = a.assessment_id
  where a.id = v_asig;

  if v_vencida then
    raise exception 'Se acabó el tiempo para completar esta evaluación.'
      using hint = 'La prueba tiene un tiempo límite desde que se empieza. Habla con la empresa que te convocó.';
  end if;

  return v_asig;
end;
$$;

revoke all on function public.asignacion_de_pase(text) from public;

-- -----------------------------------------------------------------------------
-- El catálogo enseña su ventana
--
-- `assessments` está cerrado a todo el mundo salvo al profesional desde la
-- migración 0018 —el banco de ítems es el producto—, así que la pantalla de
-- configuración lee por aquí y no por la tabla.
-- -----------------------------------------------------------------------------
create or replace function public.instrumentos_configurables()
returns table (
  clave           text,
  nombre          text,
  descripcion     text,
  ventana_minutos integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional ve la configuración de las evaluaciones.';
  end if;

  return query
  select s.clave, s.nombre, s.descripcion, s.ventana_minutos
  from public.assessments s
  where s.activo
  order by s.nombre;
end;
$$;

revoke all on function public.instrumentos_configurables() from public;
grant execute on function public.instrumentos_configurables() to authenticated;

-- =============================================================================
-- La pantalla es la que deja constancia
--
-- `evaluacion_de_pase` es lo primero que se llama al abrir un enlace, y no
-- lanza: puede escribir y que la escritura se confirme. Aquí es donde una
-- evaluación abandonada pasa a `vencida`.
--
-- Sin esto se quedaría en «en curso» indefinidamente y la empresa vería
-- esperando a alguien que ya no puede responder.
--
-- QUEDA UN RESIDUO CONOCIDO: si nadie vuelve a abrir el enlace, nadie la marca.
-- El estado real se corrige en cuanto alguien la mira, y cerrar ese hueco del
-- todo pide un barrido periódico que hoy no existe.
-- =============================================================================
create or replace function public.evaluacion_de_pase(p_token text)
returns table (
  assignment_id  uuid,
  estado         text,
  instrumento    text,
  clave          text,
  persona        text,
  empresa        text,
  consentimiento text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_visible_de_pase(p_token);
begin
  update public.assignments a
  set status = 'vencida'
  from public.assessments s
  where a.id = v_asig
    and s.id = a.assessment_id
    and a.status = 'en_curso'
    and a.started_at is not null
    and s.ventana_minutos is not null
    and a.started_at + make_interval(mins => s.ventana_minutos) < now();

  return query
  select a.id,
         a.status::text,
         s.nombre,
         s.clave,
         trim(coalesce(op.nombre, '') || ' ' || coalesce(op.apellidos, '')),
         o.nombre,
         coalesce(public.consentimiento_de(a.id), 'sin_decidir')
  from public.assignments a
  join public.assessments s on s.id = a.assessment_id
  join public.organization_people op on op.id = a.person_id
  left join public.organizations o on o.id = a.organization_id
  where a.id = v_asig;
end;
$$;

grant execute on function public.evaluacion_de_pase(text) to anon, authenticated;
