-- =============================================================================
-- 0046 · El pase dice a qué hora
--
-- La empresa reparte los enlaces, y con el enlace tiene que ir la hora: quien
-- lo recibe necesita saber cuándo presentarse. Sin ella, el mensaje que manda
-- la empresa es «entra por aquí» y la persona pregunta «¿a qué hora?», que es
-- justo el ida y vuelta que esta pantalla existe para evitar.
--
-- Es además el dato que ocupa el sitio donde antes se decía quién tenía cuenta:
-- uno que la empresa no debía ver, cambiado por otro que sí necesita.
-- =============================================================================

drop function if exists public.pases_de_acceso(uuid);

create or replace function public.pases_de_acceso(p_appointment_id uuid)
returns table (
  person_id uuid,
  nombre    text,
  apellidos text,
  documento text,
  email     text,
  starts_at timestamptz,
  token     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
  v_mia    uuid := public.mi_organizacion();
begin
  select status, organization_id into v_estado, v_org
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La sesión no existe.';
  end if;

  if v_org is null then
    raise exception 'Los pases son para sesiones de evaluación de una empresa.';
  end if;

  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esta sesión no es tuya.';
  end if;

  if v_estado not in ('confirmada', 'realizada') then
    raise exception 'La sesión debe estar confirmada para repartir accesos.'
      using hint = 'Hasta que el profesional la acepte, la fecha puede cambiar.';
  end if;

  return query
  select op.id, op.nombre, op.apellidos, op.documento, op.email,
         -- Nula mientras el profesional no haya repartido el día: la pantalla
         -- lo dice en vez de inventar una hora.
         aa.starts_at,
         (
           select i.token
           from public.invitations i
           where i.person_id = op.id
             and i.appointment_id = p_appointment_id
             and i.accepted_at is null
             and i.expires_at > now()
             and i.token is not null
           order by i.created_at desc
           limit 1
         )
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  where aa.appointment_id = p_appointment_id
  order by aa.starts_at nulls last, op.nombre, op.apellidos;
end;
$$;

grant execute on function public.pases_de_acceso(uuid) to authenticated;
