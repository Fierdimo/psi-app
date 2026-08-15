-- =============================================================================
-- 0024 · Se puede volver a aceptar
--
-- CORRIGE UN FALLO DE LA MIGRACIÓN 0018.
--
-- Allí se escribió que el consentimiento de una evaluación es un HISTORIAL de
-- decisiones reversible en las dos direcciones, y acto seguido se le puso un
-- índice único parcial sobre las aceptaciones que lo impedía:
--
--   aceptar → retirar → aceptar   ⇒  duplicate key value violates
--                                     "consents_aceptacion_unica"
--
-- Es decir: la persona podía retirar su consentimiento UNA vez y quedarse sin
-- poder volver atrás. Justo lo contrario de lo que el cliente pidió —«puede
-- que se niegue y después se arrepienta»— y de lo que su propio texto promete.
--
-- El razonamiento equivocado fue tratar «una aceptación viva» como «una fila
-- de aceptación». En un historial, aceptar dos veces con un rechazo en medio
-- son DOS HECHOS distintos y los dos ocurrieron.
--
-- La unicidad sí sigue valiendo para los documentos de plataforma —el
-- consentimiento de atención, la privacidad, los términos—, que se aceptan una
-- vez por versión y no se retiran desde una pantalla. Por eso el índice se
-- conserva para ellos y solo para ellos.
-- =============================================================================

drop index if exists public.consents_aceptacion_unica;

create unique index consents_aceptacion_unica
  on public.consents (user_id, document_key, version)
  where (decision = 'aceptado' and assignment_id is null);

comment on index public.consents_aceptacion_unica is
  'Solo para los documentos de plataforma. El consentimiento de una evaluación '
  'es un historial: manda la última decisión y las anteriores se conservan, '
  'incluidas varias aceptaciones separadas por un rechazo.';
