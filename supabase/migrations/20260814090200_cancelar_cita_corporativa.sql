-- =============================================================================
-- 0010 · `cancelar_cita` entiende las citas corporativas
--
-- CORRIGE UN AGUJERO INTRODUCIDO POR LA MIGRACIÓN 0009.
--
-- Al volver `patient_id` nulable, la comprobación de propiedad de
-- `cancelar_cita` dejó de funcionar sin dar ninguna señal:
--
--     v_es_propia := (patient_id = v_uid);           -- NULL en cita corporativa
--     if not v_es_propia and not is_professional()   -- NULL and true = NULL
--       then raise ...                               -- el IF no se cumple
--
-- Comparar con NULL no da falso: da NULL, y NULL no detiene a nadie. El
-- resultado era que **cualquier usuario con sesión podía cancelar la
-- evaluación de una empresa que no conoce**, porque la función estaba
-- concedida a `authenticated` y la única barrera evaluaba a NULL.
--
-- La lección, que vale para toda esta base: cuando una columna pasa a ser
-- nulable hay que revisar TODA comparación que la use, no solo las consultas.
-- Una condición que antes era falsa ahora es desconocida, y en SQL eso no es
-- lo mismo ni de lejos.
--
-- Lo encontró una prueba escrita a propósito para el caso corporativo. Sin
-- ella habría llegado a producción sin ruido.
-- =============================================================================

create or replace function public.cancelar_cita(
  p_appointment_id uuid,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_estado  public.appointment_status;
  v_patient uuid;
  v_org     uuid;
  v_puede   boolean;
begin
  select status, patient_id, organization_id
  into v_estado, v_patient, v_org
  from public.appointments
  where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La cita no existe.';
  end if;

  -- `is not distinct from` en vez de `=`, y no es un adorno.
  --
  -- El primer intento de arreglo protegía solo el lado izquierdo:
  --
  --     (v_org is not null and v_org = public.mi_organizacion())
  --
  -- y volvía a fallar, porque `mi_organizacion()` es NULL para quien no
  -- administra ninguna empresa. `acme = NULL` es NULL otra vez, y un paciente
  -- cualquiera seguía cancelando la evaluación de una empresa. El mismo error,
  -- en el otro lado del igual.
  --
  -- `is not distinct from` devuelve siempre verdadero o falso, nunca NULL. Los
  -- `is not null` se quedan porque declaran la intención y porque, sin ellos,
  -- dos NULL se considerarían iguales.
  --
  -- Puede cancelar: el profesional, la persona cuya cita individual es, o la
  -- empresa que encargó la evaluación. Nadie más, y en particular ninguna otra
  -- empresa.
  v_puede :=
        public.is_professional()
     or (v_patient is not null and v_patient is not distinct from v_uid)
     or (v_org is not null and v_org is not distinct from public.mi_organizacion());

  if not v_puede then
    raise exception 'No puedes cancelar una cita que no es tuya.';
  end if;

  if v_estado in ('cancelada', 'rechazada', 'realizada', 'no_asistio') then
    raise exception 'Esta cita ya está cerrada y no puede cancelarse.';
  end if;

  update public.appointments
  set status = 'cancelada',
      proposed_starts_at = null,
      proposed_ends_at = null
  where id = p_appointment_id;

  perform public.registrar_cambio_cita(p_appointment_id, v_estado, 'cancelada', p_reason);
end;
$$;

comment on function public.cancelar_cita(uuid, text) is
  'Cancela una cita individual o corporativa. Cancelar NO retira lo ya '
  'evaluado: si alguien respondió, su informe se produce igual (SPEC §9.2).';

revoke execute on function public.cancelar_cita(uuid, text) from public;
grant  execute on function public.cancelar_cita(uuid, text) to authenticated;
