-- =============================================================================
-- 0025 · Consentir abre el examen
--
-- Quita un paso del circuito. Antes hacían falta cuatro actos para que una
-- persona pudiera responder:
--
--   confirmar la sesión → asignar el instrumento → que ella consienta →
--   que el profesional le ABRA el examen, una por una
--
-- Los tres primeros son decisiones de alguien. El cuarto no: en cuanto la
-- persona ha consentido, abrirle el examen no añade criterio, solo trabajo —y
-- trabajo que crece con cada convocado, justo en las sesiones grandes que son
-- las que más cuestan.
--
-- Ahora aceptar el consentimiento abre el examen. Sigue habiendo tres
-- candados, que son los que de verdad deciden algo:
--
--   · sin sesión confirmada no se asigna,
--   · sin asignación no hay examen,
--   · SIN CONSENTIMIENTO NO SE RESPONDE.
--
-- `habilitado_at` se conserva y se sigue escribiendo: deja constancia de
-- CUÁNDO quedó disponible, que es dato de auditoría. Y `habilitar_examen`
-- sigue existiendo para abrir a mano un caso suelto.
--
-- Si algún día conviene que la prueba no pueda responderse antes de la sesión
-- presencial, la vuelta atrás es dejar de escribir `habilitado_at` aquí: el
-- candado de `iniciar_prueba` sigue en su sitio, intacto.
-- =============================================================================

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

  -- Y queda disponible. Solo la primera vez: si retiró el consentimiento y
  -- vuelve a aceptar, la fecha de apertura sigue siendo la original.
  if p_decision = 'aceptado' then
    update public.assignments
    set habilitado_at = coalesce(habilitado_at, now())
    where id = p_assignment_id and status = 'asignada';
  end if;
end;
$$;
