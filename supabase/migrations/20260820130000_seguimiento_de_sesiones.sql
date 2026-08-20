-- =============================================================================
-- 0049 · El seguimiento de una sesión ya aceptada
--
-- «Solicitudes» solo enseñaba lo que esperaba una decisión, y en cuanto se
-- confirmaba una sesión desaparecía de la vista. El profesional perdía el hilo
-- justo cuando empieza lo que importa: si la gente consintió, si está
-- respondiendo, si ya hay informes. Para saberlo había que recordar qué
-- empresa había pedido qué y entrar a buscarla.
--
-- Esto devuelve una fila por sesión en pie con el recuento de cómo va. Se
-- calcula en la base y no juntando consultas en la aplicación: son cinco
-- agregados sobre las mismas dos tablas, y traerse todos los convocados de
-- todas las sesiones para contarlos en memoria es la clase de cosa que
-- funciona con diez y se cae con quinientos.
-- =============================================================================

create or replace function public.seguimiento_de_sesiones()
returns table (
  appointment_id uuid,
  empresa        text,
  starts_at      timestamptz,
  estado         text,
  convocados     integer,
  con_hora       integer,
  consintieron   integer,
  respondiendo   integer,
  enviadas       integer,
  publicadas     integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional ve su seguimiento.';
  end if;

  return query
  select a.id,
         o.nombre,
         a.starts_at,
         a.status::text,
         count(aa.person_id)::int,
         count(aa.starts_at)::int,
         count(*) filter (
           where public.consentimiento_de(asg.id) = 'aceptado'
         )::int,
         count(*) filter (where asg.status = 'en_curso')::int,
         count(*) filter (where asg.status in ('enviada', 'calificada'))::int,
         count(*) filter (where asg.status = 'publicada')::int
  from public.appointments a
  join public.organizations o on o.id = a.organization_id
  join public.appointment_attendees aa on aa.appointment_id = a.id
  left join public.assignments asg
    on asg.appointment_id = a.id and asg.person_id = aa.person_id
  where a.organization_id is not null
    and a.status in ('confirmada', 'realizada')
    /*
     * Lo que sigue vivo, no el archivo entero.
     *
     * Una sesión cuyos informes ya salieron todos no necesita seguimiento: se
     * consulta en Evaluaciones. Se conserva un mes hacia atrás porque el
     * trabajo de una sesión no termina el día que se celebra —quedan pruebas
     * por calificar y por firmar.
     */
    and a.ends_at > now() - interval '30 days'
  group by a.id, o.nombre, a.starts_at, a.status
  order by a.starts_at;
end;
$$;

grant execute on function public.seguimiento_de_sesiones() to authenticated;
