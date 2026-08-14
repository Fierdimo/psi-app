-- =============================================================================
-- 0008 · El rol de empresa
--
-- SPEC.md §3.1
--
-- Esta migración hace UNA sola cosa, y por una razón técnica que no es
-- opcional: Postgres no permite usar un valor de enum recién añadido dentro de
-- la misma transacción en que se añadió, y cada archivo de migración corre en
-- su propia transacción. Si aquí mismo escribiéramos una política que compare
-- contra 'empresa', fallaría con «unsafe use of new value of enum type».
--
-- Por eso el valor se añade solo y todo lo que lo usa vive en 0009.
--
-- -----------------------------------------------------------------------------
-- NO existe un rol `empleado`, y esa ausencia es una decisión.
--
-- Una persona evaluada por encargo de su empresa sigue siendo una persona: la
-- relación con esa empresa es un ENCARGO, no una identidad. Modelarla como rol
-- traía tres problemas:
--
--   1. Quien fuera evaluado por su empresa no podría después contratar una
--      asesoría individual con la misma cuenta, que es justo el cruce que el
--      negocio quiere explotar.
--   2. La pertenencia no caducaría: quien deja la empresa seguiría siendo suyo.
--   3. La empresa vería informes por identidad —«esta persona es mía»— en vez
--      de por contrato —«yo pagué esta evaluación»—.
--
-- El derecho de una empresa a ver un informe nace de la evaluación que
-- encargó, y se extingue con ella.
-- =============================================================================

alter type public.user_role add value if not exists 'empresa';

comment on type public.user_role is
  'paciente: cualquier persona con cuenta, la evalúe una empresa o no. '
  'empresa: quien administra una organización cliente. '
  'profesional: quien autoriza. No hay rol de empleado, a propósito.';
