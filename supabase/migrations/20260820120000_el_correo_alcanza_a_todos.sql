-- =============================================================================
-- 0048 · El correo alcanza a todos los convocados
--
-- `emitir_invitaciones` saltaba a quien ya tuviera cuenta: se daba por hecho
-- que esa persona entraría por su perfil y no necesitaba enlace.
--
-- Dejó de ser cierto hace dos cambios. Las evaluaciones de empresa no viven en
-- el perfil de nadie —son de la convocatoria— y todos reciben pase. Con este
-- filtro en pie, a quien tenía cuenta se le creaba su pase y NO se le mandaba:
-- se quedaba esperando un correo que nunca salía, mientras la pantalla decía
-- que todo estaba enviado.
--
-- El único filtro que queda es tener dirección: sin correo no hay a dónde
-- escribir, y a esa persona se le entrega el pase a mano.
-- =============================================================================

create or replace function public.emitir_invitaciones(p_appointment_id uuid)
returns table (person_id uuid, nombre text, email text, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional emite invitaciones.';
  end if;

  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_org is null then
    raise exception 'Las invitaciones son para sesiones de evaluación.';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'La sesión debe estar confirmada antes de invitar.';
  end if;

  perform public.preparar_invitaciones(p_appointment_id);

  return query
  select op.id, op.nombre, op.email, i.token
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  join lateral (
    select i.token, i.created_at
    from public.invitations i
    where i.person_id = op.id
      and i.appointment_id = p_appointment_id
      and i.accepted_at is null
      and i.expires_at > now()
      and i.token is not null
    order by i.created_at desc
    limit 1
  ) i on true
  where aa.appointment_id = p_appointment_id
    -- Sin dirección no hay a dónde escribir. Es el único motivo para saltarse
    -- a alguien: su pase existe igual y se le entrega en mano.
    and op.email is not null;
end;
$$;
