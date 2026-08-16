-- =============================================================================
-- 0029 · La empresa puede corregir lo que cargó
--
-- Hasta ahora una empresa podía AÑADIR personas y pedir sesiones, y nada más:
-- ni corregir un documento mal escrito, ni quitar a quien ya no se presenta,
-- ni cambiar la fecha de una solicitud antes de que el profesional la acepte.
-- Un listado que solo crece no se puede mantener.
--
-- Las tres funciones comparten la misma regla: la empresa manda sobre SUS
-- datos y solo mientras no haya consecuencias para nadie más.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Editar una persona del listado
-- -----------------------------------------------------------------------------
create or replace function public.editar_persona(
  p_persona   uuid,
  p_nombre    text,
  p_apellidos text,
  p_email     text,
  p_documento text,
  p_cargo     text,
  p_vinculo   public.person_link
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.mi_organizacion();
  v_perfil uuid;
begin
  if v_org is null then
    raise exception 'Solo una empresa edita su listado.';
  end if;

  select profile_id into v_perfil
  from public.organization_people
  where id = p_persona and organization_id = v_org;

  if not found then
    raise exception 'Esa persona no está en tu listado.';
  end if;

  /*
   * El documento NO se toca una vez la persona tiene cuenta.
   *
   * Es lo que la identifica: por él se enlazó su cuenta y por él se junta lo
   * que otra empresa evaluó antes. Cambiarlo después la convertiría en otra
   * persona y dejaría su historial colgando. Antes de que acepte sí se puede,
   * que es cuando se corrige una errata al cargarla.
   */
  if v_perfil is not null and p_documento is distinct from (
    select documento from public.organization_people where id = p_persona
  ) then
    raise exception 'No se puede cambiar el documento de alguien que ya activó su cuenta.'
      using hint = 'Es lo que identifica a la persona y enlaza su historial.';
  end if;

  update public.organization_people
  set nombre     = p_nombre,
      apellidos  = p_apellidos,
      email      = p_email,
      documento  = p_documento,
      cargo      = p_cargo,
      vinculo    = p_vinculo,
      updated_at = now()
  where id = p_persona;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quitar a alguien del listado
-- -----------------------------------------------------------------------------
create or replace function public.quitar_persona(p_persona uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.mi_organizacion();
begin
  if v_org is null then
    raise exception 'Solo una empresa edita su listado.';
  end if;

  if not exists (
    select 1 from public.organization_people
    where id = p_persona and organization_id = v_org
  ) then
    raise exception 'Esa persona no está en tu listado.';
  end if;

  /*
   * No se borra a quien ya fue evaluado.
   *
   * Su informe existe y la empresa lo pagó; borrar la ficha lo dejaría
   * huérfano. Y al revés: tampoco puede usarse el borrado para hacer
   * desaparecer una evaluación incómoda. Quitar del listado es para quien se
   * cargó por error o para quien nunca llegó a presentarse.
   */
  if exists (select 1 from public.assignments where person_id = p_persona) then
    raise exception 'Esa persona ya tiene una evaluación asignada.'
      using hint = 'No se puede quitar del listado sin borrar su informe.';
  end if;

  -- De las sesiones aún sin confirmar sí se la retira: todavía no hay nada
  -- comprometido.
  delete from public.appointment_attendees a
  using public.appointments c
  where a.person_id = p_persona
    and a.appointment_id = c.id
    and c.status in ('solicitada', 'reprogramacion_solicitada');

  if exists (
    select 1 from public.appointment_attendees where person_id = p_persona
  ) then
    raise exception 'Esa persona está convocada a una sesión ya confirmada.'
      using hint = 'Cancela la sesión o espera a que pase.';
  end if;

  delete from public.organization_people where id = p_persona;
end;
$$;

-- -----------------------------------------------------------------------------
-- Corregir una solicitud de sesión, mientras siga siendo una solicitud
-- -----------------------------------------------------------------------------
create or replace function public.editar_solicitud_evaluacion(
  p_cita     uuid,
  p_inicio   timestamptz,
  p_fin      timestamptz,
  p_modalidad public.appointment_modality,
  p_lugar    text,
  p_nota     text,
  p_personas uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.mi_organizacion();
begin
  if v_org is null then
    raise exception 'Solo una empresa edita sus solicitudes.';
  end if;

  /*
   * Solo mientras esté SOLICITADA.
   *
   * Una vez el profesional la confirma, la fecha es un compromiso de dos y a
   * los convocados ya se les avisó: cambiarla por detrás haría que alguien se
   * presentara el día que no era. A partir de ahí se pide reprogramación, que
   * es otra cosa y pasa por él.
   */
  if not exists (
    select 1 from public.appointments
    where id = p_cita
      and organization_id = v_org
      and status = 'solicitada'
  ) then
    raise exception 'Esa solicitud ya no se puede editar.'
      using hint = 'Solo mientras el profesional no la haya respondido.';
  end if;

  if p_fin <= p_inicio then
    raise exception 'La sesión tiene que terminar después de empezar.';
  end if;

  if p_inicio <= now() then
    raise exception 'La fecha ya pasó.';
  end if;

  update public.appointments
  set starts_at  = p_inicio,
      ends_at    = p_fin,
      modality   = p_modalidad,
      location   = p_lugar,
      patient_note = p_nota,
      updated_at = now()
  where id = p_cita;

  -- Los convocados se reemplazan enteros: es más simple de entender que un
  -- juego de altas y bajas, y el resultado es exactamente lo que se ve en la
  -- pantalla al guardar.
  delete from public.appointment_attendees where appointment_id = p_cita;

  insert into public.appointment_attendees (appointment_id, person_id)
  select p_cita, p.id
  from public.organization_people p
  where p.id = any(p_personas) and p.organization_id = v_org;

  if not exists (
    select 1 from public.appointment_attendees where appointment_id = p_cita
  ) then
    raise exception 'Hay que convocar al menos a una persona.';
  end if;
end;
$$;

grant execute on function public.editar_persona(uuid, text, text, text, text, text, public.person_link) to authenticated;
grant execute on function public.quitar_persona(uuid) to authenticated;
grant execute on function public.editar_solicitud_evaluacion(uuid, timestamptz, timestamptz, public.appointment_modality, text, text, uuid[]) to authenticated;
