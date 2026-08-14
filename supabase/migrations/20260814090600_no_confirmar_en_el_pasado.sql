-- =============================================================================
-- 0014 · No se confirma una cita cuya fecha ya pasó
--
-- SPEC.md §9.2
--
-- El caso real: la empresa propone el 20, el profesional espera el pago, el
-- pago entra el 25. Si confirma entonces, la sesión queda `confirmada` con una
-- fecha que ya pasó, y `emitir_invitaciones` convocaría a diez personas a algo
-- que ocurrió la semana anterior.
--
-- `confirmar_cita` nunca miró la fecha. En v1 casi no importaba —un paciente
-- pide para dentro de unos días y se le responde el mismo día— pero el
-- circuito corporativo mete un trámite de pago en medio, y ahí los días se
-- acumulan.
--
-- Se cierra por los dos lados: confirmar se niega, y aparece la forma de
-- arreglarlo sin perder la solicitud ni el historial.
-- =============================================================================

create or replace function public.confirmar_cita(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado   public.appointment_status;
  v_inicio   timestamptz;
  v_prop_ini timestamptz;
  v_prop_fin timestamptz;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional puede confirmar citas.';
  end if;

  select status, starts_at, proposed_starts_at, proposed_ends_at
  into v_estado, v_inicio, v_prop_ini, v_prop_fin
  from public.appointments
  where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_estado not in ('solicitada', 'reprogramacion_solicitada') then
    raise exception 'Solo se confirma una cita solicitada o con cambio pedido.';
  end if;

  -- Al confirmar una reprogramación, la fecha que cuenta es la propuesta.
  if coalesce(v_prop_ini, v_inicio) <= now() then
    raise exception 'Esa fecha ya pasó; no se puede confirmar.'
      using hint = 'Acuerda una fecha nueva con reagendar_solicitud y confirma después.';
  end if;

  update public.appointments
  set starts_at = coalesce(v_prop_ini, starts_at),
      ends_at   = coalesce(v_prop_fin, ends_at),
      proposed_starts_at = null,
      proposed_ends_at = null,
      status = 'confirmada'
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(p_appointment_id, v_estado, 'confirmada', null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Mover la fecha de una solicitud que todavía no se ha confirmado.
--
-- Es la salida al caso de arriba, y hacía falta de todos modos: hasta ahora el
-- profesional solo podía confirmar o rechazar una solicitud. Si la fecha ya no
-- servía —porque el pago tardó, o porque le surgió algo— tenía que rechazarla y
-- pedirle a la empresa que volviera a pedir, perdiendo la solicitud original y
-- su historial.
--
-- La fecha se acuerda por teléfono o correo, que para eso una empresa no
-- existe sin canal de contacto. Esto solo registra lo acordado.
-- -----------------------------------------------------------------------------
create or replace function public.reagendar_solicitud(
  p_appointment_id uuid,
  p_starts_at      timestamptz,
  p_ends_at        timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional reagenda una solicitud.';
  end if;

  select status into v_estado
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  if v_estado not in ('solicitada', 'reprogramacion_solicitada') then
    raise exception 'Esto es para solicitudes pendientes.'
      using hint = 'Una cita ya confirmada se mueve con solicitar_reprogramacion.';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'La hora de fin debe ser posterior a la de inicio.';
  end if;

  if p_starts_at <= now() then
    raise exception 'La fecha nueva tiene que estar en el futuro.';
  end if;

  -- Se mueve la fecha REAL y se limpia cualquier propuesta a medias: lo
  -- acordado por fuera manda sobre lo que se hubiera pedido antes.
  update public.appointments
  set starts_at = p_starts_at,
      ends_at   = p_ends_at,
      proposed_starts_at = null,
      proposed_ends_at = null,
      status = 'solicitada'
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(
    p_appointment_id, v_estado, 'solicitada', 'Fecha reacordada con el cliente'
  );
end;
$$;

revoke execute on function public.confirmar_cita(uuid) from public;
revoke execute on function public.reagendar_solicitud(uuid, timestamptz, timestamptz) from public;

grant execute on function public.confirmar_cita(uuid) to authenticated;
grant execute on function public.reagendar_solicitud(uuid, timestamptz, timestamptz) to authenticated;
