-- =============================================================================
-- 0015 · El documento de identidad se recoge al crear la cuenta
--
-- SPEC.md §9.2
--
-- La cédula ya era la identidad DENTRO del listado de una empresa, pero en una
-- cuenta personal era opcional y el registro no la pedía. Quedaba a medias:
-- servía para reconocer a alguien entre empresas y no estaba garantizada en la
-- plataforma.
--
-- Consecuencias de tenerla siempre:
--   - Se puede reconocer a quien YA tiene cuenta antes de invitarlo, en vez de
--     esperar a que acepte.
--   - Una historia clínica queda identificada, que es exigencia aparte y más
--     legal que técnica.
--
-- El disparador la copia del metadato del registro, igual que ya hacía con el
-- nombre. Sin esto, el campo del formulario se rellenaría y se perdería.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, apellidos, documento)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'nombre', ''),
    nullif(new.raw_user_meta_data ->> 'apellidos', ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'documento', '')), '')
  );
  return new;
end;
$$;

-- El documento se edita como el resto de los datos personales. NO se añade a
-- la lista blanca ninguna columna nueva: `documento` ya estaba en ella desde
-- la migración 0001, así que quien corrige un dígito puede hacerlo.
--
-- El índice único `profiles_documento_unico` de 0009 sigue siendo la barrera:
-- dos cuentas no pueden compartir documento, y el intento se traduce a un
-- mensaje entendible en la acción de registro.
