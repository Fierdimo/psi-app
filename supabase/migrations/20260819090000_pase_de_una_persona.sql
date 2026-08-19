-- =============================================================================
-- 0033 · El pase de UNA persona
--
-- `pases_de_acceso` devuelve los de una sesión entera, que es lo que hace
-- falta para repartirlos. Pero cuando el profesional está trabajando su cola de
-- evaluaciones no piensa en sesiones: tiene delante a una persona que no puede
-- entrar, y quiere su enlace, no el de las otras veinte.
--
-- Se pide por persona y no por evaluación a propósito. El acceso es de la
-- PERSONA —le sirve para cualquier prueba que se le asigne, y para la que le
-- asignen el año que viene—, así que atarlo a una evaluación concreta habría
-- sido una coincidencia, no una relación.
-- =============================================================================

create or replace function public.pase_de_persona(p_person_id uuid)
returns table (
  nombre       text,
  apellidos    text,
  documento    text,
  email        text,
  tiene_cuenta boolean,
  token        text
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
  from public.organization_people where id = p_person_id;

  if v_org is null then
    raise exception 'Esa persona no existe.';
  end if;

  -- El profesional, o la empresa que la cargó. Se comprueba aquí porque dentro
  -- de una función `security definer` no rigen las políticas de la tabla.
  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esa persona no es de tu empresa.';
  end if;

  return query
  select op.nombre,
         op.apellidos,
         op.documento,
         op.email,
         op.profile_id is not null,
         (
           select i.token
           from public.invitations i
           where i.person_id = op.id
             and i.accepted_at is null
             and i.expires_at > now()
             and i.token is not null
           order by i.created_at desc
           limit 1
         )
  from public.organization_people op
  where op.id = p_person_id;
end;
$$;

comment on function public.pase_de_persona(uuid) is
  'El acceso de una persona concreta: su invitación viva si no tiene cuenta. '
  'Lo puede pedir el profesional o la empresa que la cargó.';

grant execute on function public.pase_de_persona(uuid) to authenticated;
