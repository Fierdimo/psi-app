-- =============================================================================
-- 0016 · Aspirante o empleado
--
-- SPEC.md §9.2
--
-- Buena parte de las evaluaciones NO son para gente que trabaja en la empresa:
-- son para candidatos a un puesto. Llamar «personal» a esas personas es
-- sencillamente falso —no trabajan allí, puede que nunca lo hagan— y la
-- distinción no es de vocabulario:
--
--   · El consentimiento cambia. Uno para un proceso de selección dice cosas
--     que no valen para una evaluación de desarrollo interno, y al revés.
--   · El informe cambia. El del propio profesional titula «CARGO AL QUE
--     ASPIRA», que no es el cargo que alguien ocupa.
--   · La lectura cambia. Un resultado se interpreta distinto si la persona
--     opta a un puesto o si ya lleva tres años en él.
--
-- Por defecto `aspirante`, que es el caso más frecuente, y porque equivocarse
-- hacia ahí es menos dañino: tratar a un empleado como candidato produce un
-- informe algo desenfocado; tratar a un candidato como empleado afirma un
-- vínculo laboral que no existe.
-- =============================================================================

create type public.person_link as enum ('aspirante', 'empleado');

alter table public.organization_people
  add column vinculo public.person_link not null default 'aspirante';

comment on column public.organization_people.vinculo is
  'Si la persona opta a un puesto o ya trabaja en la empresa. Cambia el '
  'consentimiento, el encabezado del informe y cómo se lee el resultado.';

comment on column public.organization_people.cargo is
  'El cargo que ocupa, o al que aspira según `vinculo`.';

-- -----------------------------------------------------------------------------
-- `cargar_personas` aprende el vínculo.
--
-- Si el dato no viene, se asume aspirante: es el caso más frecuente y el error
-- menos dañino de los dos.
-- -----------------------------------------------------------------------------
create or replace function public.cargar_personas(p_personas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.mi_organizacion();
  v_persona  jsonb;
  v_doc      text;
  v_email    text;
  v_vinculo  public.person_link;
  v_cuantas  integer := 0;
begin
  if not public.soy_empresa() then
    raise exception 'Solo una cuenta de empresa puede cargar personal.';
  end if;

  if jsonb_typeof(p_personas) <> 'array' then
    raise exception 'Se esperaba una lista de personas.';
  end if;

  for v_persona in select * from jsonb_array_elements(p_personas)
  loop
    v_doc   := btrim(coalesce(v_persona ->> 'documento', ''));
    v_email := btrim(coalesce(v_persona ->> 'email', ''));

    if v_doc = '' then
      raise exception 'Cada persona necesita su documento de identidad.'
        using hint = 'Es lo que permite reconocerla si otra empresa ya la evaluó.';
    end if;

    if v_email = '' then
      raise exception 'Falta el correo de %, y sin él no se le puede invitar.', v_doc;
    end if;

    v_vinculo := coalesce(
      nullif(btrim(coalesce(v_persona ->> 'vinculo', '')), '')::public.person_link,
      'aspirante'
    );

    insert into public.organization_people
      (organization_id, documento, nombre, apellidos, email, cargo, vinculo)
    values (
      v_org, v_doc,
      btrim(coalesce(v_persona ->> 'nombre', '')),
      nullif(btrim(coalesce(v_persona ->> 'apellidos', '')), ''),
      v_email,
      nullif(btrim(coalesce(v_persona ->> 'cargo', '')), ''),
      v_vinculo
    )
    on conflict (organization_id, documento) do update
      set nombre    = excluded.nombre,
          apellidos = excluded.apellidos,
          email     = excluded.email,
          cargo     = excluded.cargo,
          vinculo   = excluded.vinculo;

    v_cuantas := v_cuantas + 1;
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), 'personal.cargado', 'organization', v_org::text,
          jsonb_build_object('cuantas', v_cuantas));

  return v_cuantas;
end;
$$;

revoke execute on function public.cargar_personas(jsonb) from public;
grant  execute on function public.cargar_personas(jsonb) to authenticated;
