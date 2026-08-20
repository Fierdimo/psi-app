-- =============================================================================
-- 0039 · Lo que el servidor necesita leer para cerrar una evaluación
--
-- El cierre automático califica en el servidor: lee las preguntas, las
-- respuestas y los textos del instrumento, y llama a la función que publica.
-- La publicación va por una función definidora, así que no necesita permisos;
-- las LECTURAS sí, y `service_role` no los tenía.
--
-- Esto no se vio en ninguna prueba de base —ahí las consultas corren como
-- `postgres`— ni en el tipado. Se vio al enviar una prueba de verdad: el
-- examen se enviaba, el motor no encontraba respuestas y la evaluación se
-- quedaba en «enviada» sin decir nada. Un fallo silencioso, que es el peor
-- tipo, porque desde fuera parece que el informe «todavía no ha llegado».
--
-- Se conceden de una en una y solo de lectura, que es la norma de este
-- proyecto: `service_role` salta RLS, así que cada línea de aquí es una
-- excepción deliberada y no un permiso por comodidad.
-- =============================================================================

grant select on public.assignments      to service_role;
grant select on public.responses        to service_role;
grant select on public.assessments      to service_role;
grant select on public.assessment_items to service_role;
grant select on public.assessment_texts to service_role;

comment on table public.responses is
  'Lo que marcó cada persona. `service_role` solo LEE: escribir es siempre de '
  'la persona evaluada, por sus propias funciones.';
