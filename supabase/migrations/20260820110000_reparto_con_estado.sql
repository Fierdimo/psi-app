-- =============================================================================
-- 0047 · El reparto trae también el estado de la evaluación
--
-- La pantalla de una sesión listaba a la misma gente TRES veces: una para
-- ponerles hora, otra para repartir sus accesos y otra para ver en qué estado
-- iba su evaluación. Tres listas de los mismos nombres, cada una con un trozo
-- de la verdad, y entre las tres se comían la altura de la pantalla.
--
-- Con estas dos columnas basta una fila por persona: su hora, su acceso y cómo
-- va. La consulta ya recorría las mismas tablas.
-- =============================================================================

drop function if exists public.reparto_de_sesion(uuid);

create or replace function public.reparto_de_sesion(p_appointment_id uuid)
returns table (
  person_id      uuid,
  nombre         text,
  apellidos      text,
  documento      text,
  cargo          text,
  vinculo        text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  assignment_id  uuid,
  estado         text,
  consentimiento text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_mia uuid := public.mi_organizacion();
begin
  select organization_id into v_org
  from public.appointments where id = p_appointment_id;

  if v_org is null then
    raise exception 'Esta sesión no es de una empresa.';
  end if;

  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esta sesión no es tuya.';
  end if;

  return query
  select op.id, op.nombre, op.apellidos, op.documento, op.cargo,
         op.vinculo::text, aa.starts_at, aa.ends_at,
         a.id,
         a.status::text,
         -- Nulo mientras no haya evaluación asignada: no es lo mismo que «no
         -- ha decidido», y la pantalla los distingue.
         case when a.id is null then null
              else coalesce(public.consentimiento_de(a.id), 'sin_decidir') end
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  left join public.assignments a
    on a.appointment_id = p_appointment_id
   and a.person_id = op.id
  where aa.appointment_id = p_appointment_id
  order by aa.starts_at nulls last, op.nombre, op.apellidos;
end;
$$;

grant execute on function public.reparto_de_sesion(uuid) to authenticated;
