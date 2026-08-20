-- =============================================================================
-- 0043 · Su informe, por su pase
--
-- Al sacar las evaluaciones de empresa del perfil quedó un hueco: la persona
-- evaluada dejó de tener cómo ver SU informe. El consentimiento que firma dice
-- «el informe lo reciben la empresa y tú», así que sin esto el documento
-- prometía algo que el sistema ya no podía cumplir.
--
-- El pase pasa a abrir también lo ya publicado. Se separa en dos resolutores a
-- propósito: el de ACTUAR sigue exigiendo una evaluación viva —nadie responde
-- una prueba enviada— y el de LEER admite cualquier estado.
-- =============================================================================

create or replace function public.asignacion_visible_de_pase(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv  record;
  v_asig uuid;
begin
  select * into v_inv
  from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

  if v_inv is null then
    raise exception 'Este enlace no es válido.';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'Este enlace ya venció.'
      using hint = 'Pídele uno nuevo a la empresa que te convocó.';
  end if;

  -- Cualquier estado: para leer, una prueba enviada o publicada también cuenta.
  select a.id into v_asig
  from public.assignments a
  where a.person_id = v_inv.person_id
    and a.appointment_id is not distinct from v_inv.appointment_id
  order by a.assigned_at desc
  limit 1;

  if v_asig is null then
    raise exception 'Este enlace no tiene ninguna evaluación.';
  end if;

  return v_asig;
end;
$$;

revoke all on function public.asignacion_visible_de_pase(text) from public;

-- `evaluacion_de_pase` pasa a usar el resolutor de lectura: así la pantalla
-- puede decir «ya la enviaste» o enseñar el informe, en vez de responder que
-- el enlace no sirve.
create or replace function public.evaluacion_de_pase(p_token text)
returns table (
  assignment_id uuid,
  estado        text,
  instrumento   text,
  clave         text,
  persona       text,
  empresa       text,
  consentimiento text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_visible_de_pase(p_token);
begin
  return query
  select a.id,
         a.status::text,
         s.nombre,
         s.clave,
         trim(coalesce(op.nombre, '') || ' ' || coalesce(op.apellidos, '')),
         o.nombre,
         coalesce(public.consentimiento_de(a.id), 'sin_decidir')
  from public.assignments a
  join public.assessments s on s.id = a.assessment_id
  join public.organization_people op on op.id = a.person_id
  left join public.organizations o on o.id = a.organization_id
  where a.id = v_asig;
end;
$$;

grant execute on function public.evaluacion_de_pase(text) to anon, authenticated;

create or replace function public.informe_de_pase(p_token text)
returns table (
  parameter_key text,
  etiqueta      text,
  valor         jsonb,
  texto         text,
  nota_global   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig uuid := public.asignacion_visible_de_pase(p_token);
  v_estado public.assignment_status;
begin
  select status into v_estado from public.assignments where id = v_asig;

  -- Solo lo publicado. Un informe a medio calificar no es un informe.
  if v_estado <> 'publicada' then
    return;
  end if;

  return query
  select rv.parameter_key,
         coalesce(p.etiqueta, rv.parameter_key),
         rv.valor,
         coalesce(rv.nota, rv.sugerido),
         r.nota_global
  from public.result_values rv
  join public.results r on r.assignment_id = rv.assignment_id
  left join public.assessment_parameters p
    on p.assessment_id = (select assessment_id from public.assignments where id = v_asig)
   and p.clave = rv.parameter_key
  where rv.assignment_id = v_asig
  order by p.posicion nulls last, rv.parameter_key;
end;
$$;

grant execute on function public.informe_de_pase(text) to anon, authenticated;
