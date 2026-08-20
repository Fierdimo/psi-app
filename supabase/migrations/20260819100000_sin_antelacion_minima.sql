-- =============================================================================
-- 0034 · Se puede pedir cita para hoy
--
-- La consulta exigía 24 horas de anticipación. Era un valor configurable
-- —`clinic_settings.min_notice_hours`— pero nadie lo había cambiado nunca, así
-- que en la práctica funcionaba como una regla fija: una empresa que llamaba
-- por la mañana para evaluar esa misma tarde no podía ni pedirlo desde la
-- plataforma, y el trámite se iba por WhatsApp.
--
-- Se pone en cero, que NO es lo mismo que quitar la comprobación. Las tres
-- funciones que la usan siguen comparando contra `now()`, así que sigue siendo
-- imposible pedir una cita para ayer. Lo que desaparece es el margen, no el
-- suelo.
--
-- Sigue siendo un ajuste: el día que la consulta quiera volver a exigir
-- antelación, se cambia este número y las tres funciones y las cuatro
-- pantallas lo obedecen sin tocar código.
-- =============================================================================

alter table public.clinic_settings
  alter column min_notice_hours set default 0;

update public.clinic_settings set min_notice_hours = 0;

comment on column public.clinic_settings.min_notice_hours is
  'Horas de antelación mínima para pedir cita. Cero significa «hasta el último '
  'momento», no «sin comprobar»: nunca se puede pedir para un instante pasado.';
