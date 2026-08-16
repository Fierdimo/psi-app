-- =============================================================================
-- 0026 · Poder LEER el informe publicado
--
-- Las políticas ya dejaban ver `results` y `result_values` una vez publicado,
-- pero no `assessment_parameters`, que es donde viven las ETIQUETAS. Sin ellas
-- el informe llega como una lista de claves —«D», «cuadrante_a»,
-- «bajo_presion»— sin nada que diga qué son.
--
-- Se abre solo lo que hace falta para leer lo propio, y solo cuando ya está
-- publicado: quien no tiene un informe publicado de ese instrumento no ve ni
-- sus parámetros.
-- =============================================================================

create policy "evaluado: ve los parametros de su informe publicado"
  on public.assessment_parameters for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.assessment_id = assessment_parameters.assessment_id
        and a.status = 'publicada'
        and public.mi_asignacion(a.id)
    )
  );

create policy "empresa: ve los parametros de los informes que encargo"
  on public.assessment_parameters for select to authenticated
  using (
    public.mi_organizacion() is not null
    and exists (
      select 1 from public.assignments a
      where a.assessment_id = assessment_parameters.assessment_id
        and a.status = 'publicada'
        and a.organization_id is not distinct from public.mi_organizacion()
    )
  );
