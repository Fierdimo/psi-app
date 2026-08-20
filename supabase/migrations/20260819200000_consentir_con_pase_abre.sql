-- =============================================================================
-- 0044 · Consentir por el pase abre el examen igual
--
-- `consentir_evaluacion` marca `habilitado_at` al aceptar: es lo que quitó el
-- paso manual del profesional abriendo pruebas una por una. Su gemela para el
-- pase no lo hacía, así que quien entraba por el enlace consentía y la
-- evaluación quedaba sin abrir.
--
-- No rompía el circuito —`iniciar_con_pase` mira el consentimiento, no ese
-- campo— y por eso pasó desapercibido. Pero `habilitado_at` es lo que el
-- profesional ve para saber quién está listo, así que su pantalla mostraba a
-- todo el mundo pendiente aunque ya hubieran aceptado. Dos caminos hacia el
-- mismo estado que dejaban la base contando cosas distintas.
-- =============================================================================

create or replace function public.consentir_con_pase(
  p_token    text,
  p_decision text,
  p_version  text default '1'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * El resolutor de LECTURA, no el de actuar.
   *
   * Retirar el consentimiento después de haber enviado la prueba es justo lo
   * que la plataforma promete —«si lo retiras, tu informe no se publica»— y con
   * el resolutor estricto era imposible: la evaluación ya no estaba viva y el
   * enlace respondía «no tienes ninguna pendiente». La promesa quedaba escrita
   * en el consentimiento y sin forma de ejercerse.
   */
  v_asig    uuid := public.asignacion_visible_de_pase(p_token);
  v_persona uuid;
begin
  if p_decision not in ('aceptado', 'rechazado') then
    raise exception 'Decisión no válida.';
  end if;

  select person_id into v_persona from public.assignments where id = v_asig;

  if p_decision = 'aceptado'
     and public.consentimiento_de(v_asig) = 'aceptado' then
    return;
  end if;

  insert into public.consents
    (user_id, person_id, document_key, version, decision, assignment_id)
  values (null, v_persona, 'consentimiento_evaluacion', p_version,
          p_decision, v_asig);

  -- Igual que por el otro camino: solo la primera vez, para que retirar y
  -- volver a aceptar no reescriba la fecha de apertura original.
  if p_decision = 'aceptado' then
    update public.assignments
    set habilitado_at = coalesce(habilitado_at, now())
    where id = v_asig and status = 'asignada';
  end if;
end;
$$;

grant execute on function public.consentir_con_pase(text, text, text)
  to anon, authenticated;
