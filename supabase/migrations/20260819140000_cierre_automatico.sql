-- =============================================================================
-- 0038 · La evaluación se cierra sola al enviarse
--
-- DECISIÓN DEL CLIENTE, TOMADA SABIENDO LO QUE CUESTA. Hasta ahora ningún
-- resultado existía para nadie hasta que el profesional lo leía y lo firmaba:
-- estaba en la base, en la pantalla, en el consentimiento que firmaba cada
-- evaluado y en la política de privacidad. A partir de aquí, en cuanto la
-- persona pulsa «enviar», el sistema califica, publica y le manda el informe a
-- la empresa que lo encargó.
--
-- Lo que se pierde: la interpretación profesional deja de estar entre el
-- resultado y quien lo recibe. Lo que llega es lo que propuso el motor. Bajo la
-- Ley 1090 quien responde por una interpretación psicológica sigue siendo el
-- psicólogo, así que esto traslada un riesgo de la plataforma a él. Los
-- documentos legales se reescriben en el mismo cambio para que no prometan lo
-- contrario de lo que ocurre.
--
-- Lo que NO se pierde: el informe queda guardado igual, se puede volver a
-- mirar, corregir y reenviar. Publicar automáticamente no borra la capacidad
-- de revisar; quita el paso obligatorio.
--
-- La puerta es SOLO para el servidor. Un rol con sesión no puede llamar a esto:
-- si `authenticated` pudiera publicar sin pasar por `publicar_resultado`,
-- cualquier empresa podría firmar sus propios informes.
-- =============================================================================

alter table public.results
  add column if not exists released_automatically boolean not null default false;

comment on column public.results.released_automatically is
  'Verdadero si salió sin que ningún profesional lo leyera. Es la diferencia '
  'entre un informe publicado y un informe firmado.';

create or replace function public.cerrar_evaluacion_automaticamente(
  p_assignment_id uuid,
  p_valores       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.assignment_status;
begin
  select status into v_estado
  from public.assignments where id = p_assignment_id;

  if v_estado is null then
    raise exception 'Esa evaluación no existe.';
  end if;

  /*
   * Solo desde «enviada».
   *
   * Es el único estado que significa «la persona terminó». Cerrar desde otro
   * publicaría un informe de una prueba a medio responder, y el motor habría
   * calificado huecos.
   */
  if v_estado <> 'enviada' then
    raise exception 'Solo se cierra una evaluación recién enviada.';
  end if;

  insert into public.results (assignment_id)
  values (p_assignment_id)
  on conflict (assignment_id) do update set scored_at = now();

  delete from public.result_values where assignment_id = p_assignment_id;

  /*
   * Las mismas claves y los mismos tipos que `calificar_evaluacion`.
   *
   * Aquí decía `parametro` en vez de `parameter_key` y convertía el valor a
   * numérico cuando la columna es jsonb. Compilaba —plpgsql no valida el
   * cuerpo hasta ejecutarlo— y fallaba al enviar la primera prueba de verdad.
   * Es el mismo bloque que la calificación manual, y tiene que serlo: si los
   * dos caminos escribieran distinto, un informe se leería según por dónde
   * salió.
   */
  insert into public.result_values (assignment_id, parameter_key, valor, sugerido)
  select p_assignment_id,
         v->>'parameter_key',
         v->'valor',
         v->>'sugerido'
  from jsonb_array_elements(p_valores) as v;

  /*
   * Publicado y firmado NO son lo mismo, y la diferencia queda escrita.
   *
   * `released_at` dice cuándo salió y `released_by` queda NULO: no lo firmó
   * nadie. El día que haya que responder por un informe, la base tiene que
   * poder distinguir los que un profesional leyó de los que salieron solos.
   */
  update public.results
  set released_at = now(),
      released_automatically = true
  where assignment_id = p_assignment_id;

  update public.assignments
  set status = 'publicada'
  where id = p_assignment_id;
end;
$$;

revoke all on function public.cerrar_evaluacion_automaticamente(uuid, jsonb) from public;
grant execute on function public.cerrar_evaluacion_automaticamente(uuid, jsonb)
  to service_role;
