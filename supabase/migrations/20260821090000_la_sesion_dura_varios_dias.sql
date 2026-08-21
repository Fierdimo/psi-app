-- =============================================================================
-- 0050 · Una tanda que no cabe en un día se reparte en los siguientes
--
-- El modelo ya lo permitía: cada convocado tiene SU hora en
-- `appointment_attendees`, sin ninguna regla que los obligue a caer el mismo
-- día, y `organizar_sesion` valida los choques por rango de tiempo contra la
-- agenda entera. Lo que faltaba era poder PREGUNTARLO.
--
-- `franjas_del_dia` responde por un día. Con doce convocados y una jornada de
-- ocho bloques, la pregunta real es otra: «dame los doce próximos huecos, me
-- da igual en qué día caigan». Resolverlo pidiendo un día tras otro desde el
-- navegador son N viajes y una rejilla entera descartada por cada uno.
--
-- Y `jornadas_de_sesion` es la vuelta: una sesión repartida en tres días
-- guardaba `starts_at` = lunes 08:00 y `ends_at` = miércoles 11:00, así que en
-- el calendario aparecía SOLO el lunes y como si durara cincuenta y una horas.
-- El martes y el miércoles había gente citada y la agenda los daba libres.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Los próximos N huecos, caigan donde caigan
-- -----------------------------------------------------------------------------

create or replace function public.huecos_seguidos(
  p_desde   timestamptz,
  p_cuantos integer,
  p_zona    text default 'America/Bogota',
  /** La sesión que se está organizando: sus propias horas no se cuentan como
   *  ocupadas, igual que en `franjas_del_dia`. */
  p_excepto uuid default null
)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Un techo de días mirados, no de días con hueco.
   *
   * Sin él, una consulta sin días laborables —o con la agenda llena hasta el
   * año que viene— deja este bucle girando para siempre. Sesenta días cubren
   * cualquier tanda razonable: si en dos meses no caben, el problema no es de
   * reparto.
   */
  c_horizonte constant integer := 60;
  v_fecha date;
  v_n     integer := 0;
  v_hueco record;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional organiza su día.';
  end if;

  if p_cuantos is null or p_cuantos <= 0 then
    return;
  end if;

  v_fecha := (p_desde at time zone p_zona)::date;

  for v_dia in 0 .. c_horizonte loop
    /*
     * Se reutiliza `franjas_del_dia` en vez de repetir su consulta.
     *
     * Es donde vive lo que significa «ocupado» —la hora de cada persona en las
     * sesiones de empresa, el rango entero en las individuales—, y esa regla
     * ya se corrigió una vez. Con dos copias, la próxima corrección arregla
     * una y deja la otra mintiendo.
     *
     * Los días no laborables no devuelven nada, así que los fines de semana se
     * saltan solos.
     */
    for v_hueco in
      select f.inicio, f.fin
      from public.franjas_del_dia(v_fecha + v_dia, p_zona, p_excepto) f
      where not f.ocupada
        and f.inicio >= p_desde
      order by f.inicio
    loop
      inicio := v_hueco.inicio;
      fin    := v_hueco.fin;
      return next;

      v_n := v_n + 1;
      if v_n >= p_cuantos then
        return;
      end if;
    end loop;
  end loop;
end;
$$;

comment on function public.huecos_seguidos(timestamptz, integer, text, uuid) is
  'Los próximos N huecos libres a partir de un instante, saltando a los días '
  'siguientes cuando el día no da más de sí. Es lo que permite repartir una '
  'tanda de doce en una jornada de ocho bloques.';

grant execute on function public.huecos_seguidos(timestamptz, integer, text, uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- En qué días hay gente citada, y en qué tramo de cada uno
-- -----------------------------------------------------------------------------

create or replace function public.jornadas_de_sesion(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_zona  text default 'America/Bogota'
)
returns table (
  appointment_id uuid,
  dia            date,
  desde          timestamptz,
  hasta          timestamptz,
  personas       integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional ve su agenda.';
  end if;

  return query
  select aa.appointment_id,
         (aa.starts_at at time zone p_zona)::date,
         min(aa.starts_at),
         max(aa.ends_at),
         count(*)::int
  from public.appointment_attendees aa
  join public.appointments a on a.id = aa.appointment_id
  where a.organization_id is not null
    and aa.starts_at is not null
    /*
     * Se filtra por la hora de la PERSONA, no por la de la cita.
     *
     * Filtrar por `a.starts_at` es exactamente el fallo que esto viene a
     * arreglar: la semana del miércoles no contiene el lunes en que empezó la
     * sesión, así que las personas citadas el miércoles no salían por ningún
     * lado.
     */
    and aa.starts_at >= p_desde
    and aa.starts_at <= p_hasta
  group by aa.appointment_id, 2
  order by 3;
end;
$$;

comment on function public.jornadas_de_sesion(timestamptz, timestamptz, text) is
  'Una fila por sesión de empresa y día con gente citada, con el tramo real de '
  'ese día. Una sesión repartida en tres días son tres filas: en el calendario '
  'tiene que aparecer en los tres, y ocupando solo lo que ocupa en cada uno.';

grant execute on function public.jornadas_de_sesion(timestamptz, timestamptz, text)
  to authenticated;
