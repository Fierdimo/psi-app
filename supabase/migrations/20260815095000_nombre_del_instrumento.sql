-- =============================================================================
-- 0023 · Quien es evaluado puede saber QUÉ le aplicaron
--
-- CORRIGE UN EXCESO DE LA MIGRACIÓN 0018.
--
-- Allí el catálogo de instrumentos se cerró a todo el mundo salvo al
-- profesional, con un razonamiento correcto: el banco de ítems es el producto,
-- y cualquiera con una cuenta no debe poder descargárselo para estudiárselo.
--
-- Pero se cerró de más. El NOMBRE de la prueba que a uno le asignaron no es el
-- catálogo: es lo mínimo que hace falta para saber a qué te estás sometiendo.
-- Sin esto, la pantalla de la persona decía «Evaluación» a secas y su informe
-- publicado no podía nombrar el instrumento del que salía.
--
-- Se abre SOLO la fila del instrumento que tiene asignado —o que encargó, si
-- es una empresa—. Los ítems siguen cerrados como estaban: se ven mientras se
-- responde y nunca antes.
-- =============================================================================

create policy "evaluado: ve el instrumento que le asignaron"
  on public.assessments for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.assessment_id = assessments.id
        and public.mi_asignacion(a.id)
    )
  );

create policy "empresa: ve el instrumento que encargo"
  on public.assessments for select to authenticated
  using (
    public.mi_organizacion() is not null
    and exists (
      select 1 from public.assignments a
      where a.assessment_id = assessments.id
        and a.organization_id is not distinct from public.mi_organizacion()
    )
  );

-- -----------------------------------------------------------------------------
-- Y quién la pidió
--
-- El mismo principio que rige el correo de invitación: quien va a ser evaluado
-- tiene derecho a saber DE PARTE DE QUIÉN, y a saberlo antes de responder. Sin
-- esta política su pantalla decía «solicitada por tu profesional» sobre una
-- evaluación que había encargado una empresa — una respuesta falsa, no una
-- omisión.
--
-- Solo la organización que encargó ALGO SUYO. No abre el listado de empresas.
-- -----------------------------------------------------------------------------
create policy "evaluado: ve quien encargo su evaluacion"
  on public.organizations for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.organization_id = organizations.id
        and public.mi_asignacion(a.id)
    )
  );
