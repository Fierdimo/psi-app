-- =============================================================================
-- 0045 · La empresa no sabe si alguien tiene cuenta
--
-- `pases_de_acceso` devolvía `tiene_cuenta`, y la pantalla de la empresa lo
-- pintaba: «Ya tiene cuenta» junto al nombre de cada convocado.
--
-- POR QUÉ IMPORTA. Tener cuenta en esta plataforma no significa «ya se
-- registró para esta prueba»: significa que esa persona tiene o tuvo relación
-- con la consulta. Puede ser paciente. Decírselo a su empleador —o a la
-- empresa donde aspira a un puesto— es revelar un dato de salud por la puerta
-- de atrás, sin que la persona lo autorizara y sin que nadie lo pretendiera.
--
-- Y desde que las evaluaciones de empresa son descartables, el dato tampoco
-- servía para nada: todos reciben el mismo pase y responden igual. Era una
-- filtración sin contrapartida.
--
-- Se quita de la función, no solo de la pantalla. Un dato que no debe salir no
-- se esconde en la vista: se deja de entregar.
-- =============================================================================

drop function if exists public.pases_de_acceso(uuid);

create or replace function public.pases_de_acceso(p_appointment_id uuid)
returns table (
  person_id uuid,
  nombre    text,
  apellidos text,
  documento text,
  email     text,
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
  order by op.nombre, op.apellidos;
end;
$$;

grant execute on function public.pases_de_acceso(uuid) to authenticated;

-- Lo mismo en el pase de una persona suelta, que la empresa también puede pedir.
drop function if exists public.pase_de_persona(uuid);

create or replace function public.pase_de_persona(p_person_id uuid)
returns table (
  nombre    text,
  apellidos text,
  documento text,
  email     text,
  token     text
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

  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esa persona no es de tu empresa.';
  end if;

  return query
  select op.nombre, op.apellidos, op.documento, op.email,
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

grant execute on function public.pase_de_persona(uuid) to authenticated;

/*
 * Y la columna `profile_id` deja de leerse desde la empresa.
 *
 * El listado de personas pintaba «Cuenta activa» o «Sin aceptar» a partir de
 * ella: la misma filtración por otro sitio. La política se estrecha para que
 * el dato no salga aunque una pantalla lo pida.
 */
/*
 * Se retira el permiso de TABLA y se concede columna a columna.
 *
 * Revocar solo la columna no sirve: mientras exista el permiso sobre la tabla,
 * Postgres lo considera suficiente para cualquier columna y el `revoke` no
 * cambia nada. Es un fallo que compila, se aplica sin error y no protege
 * nada — se vio consultando la columna con el rol ya restringido.
 *
 * Sin esto, una empresa podía preguntarle a la API por `profile_id` de su
 * propia gente y deducir quién tiene cuenta, aunque ninguna pantalla lo
 * pintara.
 */
revoke select on public.organization_people from authenticated;
grant select (
  id, organization_id, documento, nombre, apellidos, email, cargo, vinculo,
  created_at, updated_at
) on public.organization_people to authenticated;

-- Y en el reparto del día, que la empresa dueña de la sesión también consulta.
drop function if exists public.reparto_de_sesion(uuid);

create or replace function public.reparto_de_sesion(p_appointment_id uuid)
returns table (
  person_id uuid,
  nombre    text,
  apellidos text,
  documento text,
  cargo     text,
  vinculo   text,
  starts_at timestamptz,
  ends_at   timestamptz
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
         op.vinculo::text, aa.starts_at, aa.ends_at
  from public.appointment_attendees aa
  join public.organization_people op on op.id = aa.person_id
  where aa.appointment_id = p_appointment_id
  order by aa.starts_at nulls last, op.nombre, op.apellidos;
end;
$$;

grant execute on function public.reparto_de_sesion(uuid) to authenticated;
