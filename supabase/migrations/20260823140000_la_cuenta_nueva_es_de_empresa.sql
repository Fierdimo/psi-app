-- =============================================================================
-- 0058 · Una cuenta nueva es de empresa, y nace con su organización
--
-- SPEC-EVALUACIONES.md §2.1
--
-- Hasta hoy `/registro` creaba un PACIENTE: el disparador ponía el rol por
-- defecto y `registrar_empresa()` existía en la base sin ninguna puerta en la
-- interfaz. Con el giro a evaluaciones por encargo, el alta pública es la de
-- una empresa y no hay ninguna otra.
--
-- -----------------------------------------------------------------------------
-- SE CREA TODO EN EL DISPARADOR, Y NO EN DOS PASOS
--
-- El SPEC proponía otra cosa: guardar los datos de la empresa en los metadatos
-- del registro y llamar a `registrar_empresa()` al primer ingreso, porque esa
-- función necesita `auth.uid()` y no hay sesión hasta que se verifica el
-- correo.
--
-- Al implementarlo se vio que el rodeo sobraba. AQUÍ NO HACE FALTA `auth.uid()`:
-- el disparador tiene `new.id` delante. Y hacerlo en un solo paso elimina de un
-- golpe toda una familia de estados a medias —cuenta verificada sin empresa,
-- metadatos perdidos, la llamada que falla y nadie reintenta— que el diseño de
-- dos pasos obligaba a atender con una pantalla de rescate.
--
-- La cuenta y su organización nacen en la misma transacción, o no nace ninguna.
--
-- -----------------------------------------------------------------------------
-- QUE SE CREE ANTES DE VERIFICAR EL CORREO NO ES UN PROBLEMA
--
-- Una organización sin cuenta verificada detrás es inerte: nadie puede entrar,
-- no obtiene ningún dato por existir y nada ocurre hasta que solicita usos y el
-- profesional los autoriza comprobando un pago. Lo máximo que consigue un alta
-- falsa es ocupar una línea. Es el mismo razonamiento que ya justificaba que
-- una empresa pudiera darse de alta sola.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa text := nullif(btrim(new.raw_user_meta_data ->> 'empresa_nombre'), '');
  v_nombre  text := nullif(btrim(new.raw_user_meta_data ->> 'nombre'), '');
  v_apellidos text := nullif(btrim(new.raw_user_meta_data ->> 'apellidos'), '');
  v_org     uuid;
begin
  if v_empresa is not null then
    insert into public.organizations
      (nombre, nit, contacto_nombre, contacto_email, contacto_telefono)
    values (
      v_empresa,
      nullif(btrim(new.raw_user_meta_data ->> 'empresa_nit'), ''),
      nullif(btrim(coalesce(v_nombre, '') || ' ' || coalesce(v_apellidos, '')), ''),
      /*
       * El correo de la cuenta es el de contacto.
       *
       * `registrar_empresa` exige un canal —correo o teléfono— porque el pago
       * se resuelve fuera de la plataforma y sin él la solicitud de usos se
       * queda muerta en la bandeja. Aquí ese canal existe siempre: es la
       * dirección con la que se está registrando.
       */
      new.email,
      nullif(btrim(new.raw_user_meta_data ->> 'empresa_telefono'), '')
    )
    returning id into v_org;
  end if;

  /*
   * `empresa` SIEMPRE, tenga organización o no.
   *
   * Es lo que hace cierto que «una cuenta nueva es de empresa»: no depende de
   * que el formulario mande bien los metadatos ni de que nadie olvide un
   * paso. Una cuenta sin organización —alguien creado por la API de
   * administración, un registro sin datos de empresa— queda en un estado del
   * que solo se sale completando esos datos, y el enrutado la manda allí.
   *
   * El defecto de la columna sigue siendo `paciente` a propósito: la siembra
   * de desarrollo todavía crea pacientes para las pantallas que quedan por
   * retirar, y los pone explícitamente.
   */
  insert into public.profiles (id, role, organization_id, nombre, apellidos)
  values (new.id, 'empresa', v_org, v_nombre, v_apellidos);

  if v_org is not null then
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (new.id, 'empresa.registrada', 'organization', v_org::text,
            jsonb_build_object('nombre', v_empresa, 'via', 'registro'));
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Completar los datos de una cuenta que se quedó sin empresa
--
-- `registrar_empresa()` ya hacía esto y se conserva tal cual: comprueba que
-- quien llama no administre ya una organización, que no sea el profesional y
-- que deje un canal de contacto. Lo único que cambia es cuándo se usa — antes
-- era la puerta principal que nadie abría, ahora es la salida de un callejón
-- que casi nunca se pisa.
-- -----------------------------------------------------------------------------
comment on function public.registrar_empresa(text, text, text, text, text) is
  'Completa el alta de una cuenta que quedó sin organización. El camino normal '
  'es `handle_new_user`, que la crea junto a la cuenta.';
