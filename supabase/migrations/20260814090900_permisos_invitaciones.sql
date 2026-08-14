-- =============================================================================
-- 0017 · El servidor puede leer una invitación
--
-- CORRIGE UN FALLO INTRODUCIDO POR LA MIGRACIÓN 0013.
--
-- `invitations` se creó con RLS activo y SIN una sola política, con el
-- razonamiento de que nadie debía consultarla por la API. El razonamiento era
-- correcto para los usuarios y equivocado para el servidor: activar RLS no
-- exime de los permisos de tabla, y `service_role` tampoco los hereda —solo
-- recibe REFERENCES, TRIGGER y TRUNCATE (ver 0005).
--
-- El resultado: la pantalla pública que muestra «te ha convocado tal empresa»
-- antes de pedir nada NO PODÍA LEER la invitación, y respondía siempre «esta
-- invitación no es válida». Un enlace perfectamente bueno parecía roto.
--
-- Costó encontrarlo porque el código ignoraba el error de la consulta y trataba
-- «sin datos» y «sin permiso» como lo mismo. Ya no: la pantalla distingue.
--
-- Se concede SELECT y nada más. Emitir y aceptar siguen pasando por funciones
-- `security definer`, que corren como su propietario y no necesitan esto.
-- =============================================================================

grant select on public.invitations to service_role;

-- Y las tablas del circuito corporativo que el servidor necesita leer para
-- redactar un correo: a quién se convoca y de parte de qué empresa. Solo
-- lectura; toda escritura sigue pasando por las funciones de transición.
grant select on public.organizations         to service_role;
grant select on public.organization_people   to service_role;
grant select on public.appointment_attendees to service_role;
