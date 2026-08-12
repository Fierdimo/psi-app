-- =============================================================================
-- 0005 · Permisos del rol de servicio
--
-- Supabase NO concede permisos de escritura a `service_role` sobre las tablas
-- que creamos: solo hereda REFERENCES, TRIGGER y TRUNCATE. Hay que concederlos
-- de forma explícita, y eso es una ventaja: obliga a decidir tabla por tabla en
-- vez de repartir un permiso general.
--
-- `service_role` SALTA RLS. Cada línea de aquí abajo es una excepción al
-- modelo de seguridad, así que se concede lo mínimo y se justifica el porqué.
-- Ante la duda, no se añade nada: casi todo debe pasar por el cliente del
-- usuario, con RLS aplicando el filtro.
-- =============================================================================

-- Registro de consentimientos.
--
-- El servidor escribe aquí porque la IP y el agente deben tomarse de la
-- petición real. Si lo hiciera el cliente, serían lo que el navegador quisiera
-- declarar y no servirían como evidencia.
--
-- Se concede INSERT y SELECT, nunca UPDATE ni DELETE: un consentimiento es
-- prueba de algo que ocurrió, y la prueba no se edita ni se borra. Si el texto
-- cambia se sube la versión y se registra una aceptación nueva.
grant select, insert on public.consents to service_role;

-- Auditoría. Solo se añade; nunca se modifica ni se borra, por el mismo motivo.
grant select, insert on public.audit_log to service_role;
