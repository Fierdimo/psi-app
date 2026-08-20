-- =============================================================================
-- 0041 · El reparto trae todo lo que se sabe de cada convocado
--
-- La pantalla de una sesión listaba a las mismas personas hasta tres veces: el
-- tablero con su hora, «Convocados» con su cargo y su vínculo, y los pases con
-- su enlace. Tres listas de los mismos nombres, y ninguna completa.
--
-- Con estas columnas, una fila por persona basta. La consulta ya recorría esa
-- tabla: traer cuatro campos más no cuesta nada y ahorra dos listados.
-- =============================================================================

drop function if exists public.reparto_de_sesion(uuid);

create or replace function public.reparto_de_sesion(p_appointment_id uuid)
returns table (
  person_id    uuid,
  nombre       text,
  apellidos    text,
  documento    text,
  cargo        text,
  vinculo      text,
  tiene_cuenta boolean,
  starts_at    timestamptz,
  ends_at      timestamptz
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
         op.vinculo::text, op.profile_id is not null,
         aa.starts_at, aa.ends_at
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  where aa.appointment_id = p_appointment_id
  -- Los que ya tienen hora, en orden; los que no, al final por nombre. Quien
  -- organiza necesita ver de un vistazo a quién le falta sitio.
  order by aa.starts_at nulls last, op.nombre, op.apellidos;
end;
$$;

grant execute on function public.reparto_de_sesion(uuid) to authenticated;
