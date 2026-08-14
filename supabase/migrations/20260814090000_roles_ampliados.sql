-- =============================================================================
-- 0008 · Roles de empresa y empleado
--
-- SPEC.md §3.1
--
-- Esta migración hace UNA sola cosa, y por una razón técnica que no es
-- opcional: Postgres no permite usar un valor de enum recién añadido dentro de
-- la misma transacción en que se añadió, y cada archivo de migración corre en
-- su propia transacción. Si aquí mismo escribiéramos una política que compare
-- contra 'empresa', fallaría con «unsafe use of new value of enum type».
--
-- Por eso los valores se añaden solos y todo lo que los usa vive en 0009.
-- =============================================================================

alter type public.user_role add value if not exists 'empresa';
alter type public.user_role add value if not exists 'empleado';

comment on type public.user_role is
  'paciente y empleado reciben atención o evaluación; empresa contrata; '
  'profesional autoriza. Un empleado NO es un paciente: no hay relación '
  'clínica, no pide su cita y su informe tiene un segundo destinatario.';
