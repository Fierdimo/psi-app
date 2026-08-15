-- =============================================================================
-- 0022 · Las transiciones de una evaluación
--
-- SPEC.md §9.2
--
-- Toda escritura pasa por aquí. Las tablas solo conceden SELECT, así que estas
-- funciones son la ÚNICA forma de mover una evaluación — y cada una comprueba
-- quién la llama y desde qué estado.
--
-- El orden no es decorativo:
--
--   asignada  → el profesional decide qué instrumento se aplica
--   (consentimiento de la persona, reversible en las dos direcciones)
--   habilitada → el profesional la abre EN la sesión presencial
--   en_curso  → la persona responde
--   enviada   → terminó
--   calificada→ el sistema puntuó; NADIE lo ve todavía
--   publicada → el profesional firma; recién ahí existe para sus destinatarios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La decisión vigente sobre una evaluación
--
-- No es «¿hay una fila?» sino «¿cuál fue la ÚLTIMA?». Quien rechazó puede
-- aceptar después —y quien aceptó puede retirarlo, que es lo que el propio
-- texto del consentimiento promete.
-- -----------------------------------------------------------------------------
create or replace function public.consentimiento_de(p_assignment uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decision
  from public.consents
  where assignment_id = p_assignment
  order by accepted_at desc, id desc
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Asignar: UN acto para toda la sesión
--
-- Cuando una empresa encarga una evaluación, el profesional no asigna persona
-- por persona: elige el instrumento una vez y alcanza a todos los convocados.
-- Era el pedido explícito, y además es lo que evita el error de dejarse a
-- alguien fuera de una tanda de veinte.
-- -----------------------------------------------------------------------------
create or replace function public.asignar_evaluacion(
  p_appointment_id uuid,
  p_assessment_id  uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_cita  record;
  v_n     integer := 0;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional asigna evaluaciones.';
  end if;

  select id, status, patient_id, organization_id
    into v_cita
  from public.appointments
  where id = p_appointment_id;

  if v_cita.id is null then
    raise exception 'Esa sesión no existe.';
  end if;

  -- Confirmada quiere decir que la sesión va a ocurrir. Asignar sobre una
  -- solicitud sin confirmar sería comprometer un instrumento a una fecha que
  -- todavía puede no existir.
  if v_cita.status <> 'confirmada' then
    raise exception 'La sesión tiene que estar confirmada para asignar una evaluación.';
  end if;

  if not exists (select 1 from public.assessments
                 where id = p_assessment_id and activo) then
    raise exception 'Ese instrumento no existe o está inactivo.';
  end if;

  if v_cita.organization_id is not null then
    insert into public.assignments
      (assessment_id, appointment_id, person_id, organization_id, assigned_by)
    select p_assessment_id, p_appointment_id, a.person_id,
           v_cita.organization_id, v_uid
    from public.appointment_attendees a
    where a.appointment_id = p_appointment_id
    on conflict do nothing;

    get diagnostics v_n = row_count;
  else
    insert into public.assignments
      (assessment_id, appointment_id, patient_id, assigned_by)
    values (p_assessment_id, p_appointment_id, v_cita.patient_id, v_uid);

    v_n := 1;
  end if;

  return v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Consentir, o no consentir, y poder cambiar de idea
-- -----------------------------------------------------------------------------
create or replace function public.consentir_evaluacion(
  p_assignment_id uuid,
  p_decision      text,
  p_version       text default '1'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_decision not in ('aceptado', 'rechazado') then
    raise exception 'Decisión no válida.';
  end if;

  -- Lo firma LA PERSONA EVALUADA. Ni su empresa ni el profesional pueden
  -- consentir por ella: es el punto entero del consentimiento informado.
  if not public.mi_asignacion(p_assignment_id) then
    raise exception 'Solo la persona evaluada decide sobre su evaluación.';
  end if;

  /*
   * Aceptar dos veces no es un error, es la misma decisión repetida: se
   * ignora. Pero rechazar DESPUÉS de aceptar sí escribe, porque es una
   * decisión nueva y contraria, y borrar la aceptación anterior destruiría la
   * evidencia de que en su momento sí consintió.
   */
  if p_decision = 'aceptado'
     and public.consentimiento_de(p_assignment_id) = 'aceptado' then
    return;
  end if;

  insert into public.consents
    (user_id, document_key, version, decision, assignment_id)
  values (v_uid, 'consentimiento_evaluacion', p_version, p_decision,
          p_assignment_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Habilitar: lo abre el profesional, en la sesión
-- -----------------------------------------------------------------------------
create or replace function public.habilitar_examen(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional abre un examen.';
  end if;

  if public.consentimiento_de(p_assignment_id) is distinct from 'aceptado' then
    raise exception 'Esa persona no ha aceptado esta evaluación.'
      using hint = 'Sin su consentimiento no se abre el examen.';
  end if;

  update public.assignments
  set habilitado_at = now()
  where id = p_assignment_id and status = 'asignada';

  if not found then
    raise exception 'Esa evaluación no está pendiente de abrirse.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Responder
-- -----------------------------------------------------------------------------
create or replace function public.iniciar_prueba(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mi_asignacion(p_assignment_id) then
    raise exception 'Esa evaluación no es tuya.';
  end if;

  if public.consentimiento_de(p_assignment_id) is distinct from 'aceptado' then
    raise exception 'Tienes que aceptar el consentimiento antes de empezar.';
  end if;

  update public.assignments
  set status = 'en_curso', started_at = coalesce(started_at, now())
  where id = p_assignment_id
    and status = 'asignada'
    and habilitado_at is not null;

  if not found then
    raise exception 'Esta evaluación todavía no está abierta.'
      using hint = 'El profesional la abre durante la sesión.';
  end if;
end;
$$;

/*
 * Una fila por respuesta, escrita según se responde.
 *
 * Perder veintiocho respuestas por una caída de red es perder la prueba
 * entera y hacer volver a la persona otro día, así que no se acumulan en el
 * navegador hasta el final.
 */
create or replace function public.responder(
  p_assignment_id uuid,
  p_item_id       uuid,
  p_valor         jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mi_asignacion(p_assignment_id) then
    raise exception 'Esa evaluación no es tuya.';
  end if;

  if not exists (select 1 from public.assignments
                 where id = p_assignment_id and status = 'en_curso') then
    raise exception 'Esta evaluación no está en curso.';
  end if;

  -- Que el ítem pertenezca a ESTE instrumento. Sin esto, una petición hecha a
  -- mano podría sembrar respuestas de otra prueba.
  if not exists (
    select 1
    from public.assessment_items i
    join public.assignments a on a.assessment_id = i.assessment_id
    where i.id = p_item_id and a.id = p_assignment_id
  ) then
    raise exception 'Ese ítem no pertenece a esta evaluación.';
  end if;

  insert into public.responses (assignment_id, item_id, valor)
  values (p_assignment_id, p_item_id, p_valor)
  on conflict (assignment_id, item_id)
  do update set valor = excluded.valor, answered_at = now();
end;
$$;

create or replace function public.enviar_prueba(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mi_asignacion(p_assignment_id) then
    raise exception 'Esa evaluación no es tuya.';
  end if;

  update public.assignments
  set status = 'enviada', submitted_at = now()
  where id = p_assignment_id and status = 'en_curso';

  if not found then
    raise exception 'Esta evaluación no está en curso.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Calificar y publicar: dos actos, y en ese orden
-- -----------------------------------------------------------------------------
create or replace function public.calificar_evaluacion(
  p_assignment_id uuid,
  p_valores       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional califica.';
  end if;

  if not exists (select 1 from public.assignments
                 where id = p_assignment_id
                   and status in ('enviada', 'calificada')) then
    raise exception 'Esa evaluación no está lista para calificarse.';
  end if;

  insert into public.results (assignment_id)
  values (p_assignment_id)
  on conflict (assignment_id) do update set scored_at = now();

  -- Se reemplaza el bloque entero: recalificar tiene que dar el mismo
  -- resultado que calificar por primera vez, no la mezcla de dos pasadas.
  delete from public.result_values where assignment_id = p_assignment_id;

  insert into public.result_values (assignment_id, parameter_key, valor, sugerido)
  select p_assignment_id,
         v->>'parameter_key',
         v->'valor',
         v->>'sugerido'
  from jsonb_array_elements(p_valores) as v;

  update public.assignments
  set status = 'calificada'
  where id = p_assignment_id;
end;
$$;

/** Lo que el profesional escribe encima de lo que propuso el motor. */
create or replace function public.redactar_resultado(
  p_assignment_id uuid,
  p_parameter_key text,
  p_nota          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional redacta un informe.';
  end if;

  update public.result_values
  set nota = p_nota
  where assignment_id = p_assignment_id and parameter_key = p_parameter_key;

  if not found then
    raise exception 'Ese apartado no existe en este informe.';
  end if;
end;
$$;

/*
 * Publicar es un acto deliberado y separado.
 *
 * Calificar es lo que hace la máquina; publicar es lo que firma el
 * profesional. Que sean dos funciones y no una es la diferencia entre un
 * informe revisado y un informe automático enviado a la empresa de alguien.
 */
create or replace function public.publicar_resultado(
  p_assignment_id uuid,
  p_nota_global   text default null
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
    raise exception 'Solo el profesional publica un informe.';
  end if;

  -- Si la persona retiró su consentimiento, no se publica. El texto que firmó
  -- dice que puede retirarlo en cualquier momento; publicar igualmente
  -- convertiría esa promesa en letra muerta.
  if public.consentimiento_de(p_assignment_id) is distinct from 'aceptado' then
    raise exception 'Esa persona retiró su consentimiento.'
      using hint = 'No se publica un informe sin consentimiento vigente.';
  end if;

  update public.results
  set released_at = now(), released_by = v_uid,
      nota_global = coalesce(p_nota_global, nota_global)
  where assignment_id = p_assignment_id;

  if not found then
    raise exception 'Ese informe no está calificado todavía.';
  end if;

  update public.assignments
  set status = 'publicada'
  where id = p_assignment_id and status = 'calificada';

  if not found then
    raise exception 'Esa evaluación no está calificada.';
  end if;
end;
$$;

grant execute on function public.asignar_evaluacion(uuid, uuid)        to authenticated;
grant execute on function public.consentir_evaluacion(uuid, text, text) to authenticated;
grant execute on function public.habilitar_examen(uuid)                to authenticated;
grant execute on function public.iniciar_prueba(uuid)                  to authenticated;
grant execute on function public.responder(uuid, uuid, jsonb)          to authenticated;
grant execute on function public.enviar_prueba(uuid)                   to authenticated;
grant execute on function public.calificar_evaluacion(uuid, jsonb)     to authenticated;
grant execute on function public.redactar_resultado(uuid, text, text)  to authenticated;
grant execute on function public.publicar_resultado(uuid, text)        to authenticated;
