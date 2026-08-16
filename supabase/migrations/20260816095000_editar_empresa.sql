-- =============================================================================
-- 0030 · La empresa puede corregir sus propios datos
--
-- La ficha se rellenaba al registrarse y no se volvía a tocar. Un correo de
-- contacto que ya no se lee no es un detalle: por ahí le escribe el
-- profesional para resolver el trámite antes de confirmar una sesión, así que
-- una dirección obsoleta detiene el circuito entero sin que nadie sepa por qué.
--
-- Se escribe por función y no abriendo un `update` en la tabla: así queda en
-- un solo sitio qué se puede cambiar y qué no. El identificador no, y el
-- vínculo con los perfiles tampoco.
-- =============================================================================

create or replace function public.actualizar_empresa(
  p_nombre    text,
  p_nit       text,
  p_contacto_nombre   text,
  p_contacto_email    text,
  p_contacto_telefono text
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
    raise exception 'Solo una empresa edita sus datos.';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre de la empresa no puede quedar vacío.';
  end if;

  /*
   * Algún canal de contacto, el que sea.
   *
   * Es la misma regla que al registrarse (`registrar_empresa`), y por el mismo
   * motivo: una sesión no se confirma hasta que el profesional resuelve el
   * trámite, y para eso tiene que poder escribir o llamar. Dejar la ficha sin
   * ningún canal es dejar las solicitudes en un limbo.
   */
  if coalesce(trim(p_contacto_email), '') = ''
     and coalesce(trim(p_contacto_telefono), '') = '' then
    raise exception 'Deja al menos un correo o un teléfono de contacto.'
      using hint = 'Es por donde el profesional resuelve el trámite de una sesión.';
  end if;

  update public.organizations
  set nombre            = trim(p_nombre),
      nit               = nullif(trim(p_nit), ''),
      contacto_nombre   = nullif(trim(p_contacto_nombre), ''),
      contacto_email    = nullif(trim(p_contacto_email), ''),
      contacto_telefono = nullif(trim(p_contacto_telefono), ''),
      updated_at        = now()
  where id = v_org;
end;
$$;

grant execute on function public.actualizar_empresa(text, text, text, text, text)
  to authenticated;
