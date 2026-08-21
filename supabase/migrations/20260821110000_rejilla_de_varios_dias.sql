-- =============================================================================
-- 0051 · La rejilla de varios días, de un viaje
--
-- Con la tanda repartida en dos días, mover a alguien DENTRO de su día era
-- imposible sin cambiar antes la pantalla de fecha: su desplegable ofrecía los
-- bloques del día que se estaba mirando, no los del suyo. Colocar a alguien el
-- martes a las nueve y querer pasarlo a las once eran tres pasos y un viaje de
-- ida y vuelta por el calendario.
--
-- Para arreglarlo hace falta tener a la vez la rejilla de todos los días en los
-- que hay gente. Pedirlas de una en una son N llamadas para lo que es una sola
-- pregunta —«¿cómo están estos tres días?»— y deja la pantalla parpadeando
-- mientras llegan.
--
-- No se reescribe la regla de qué está ocupado: se llama a `franjas_del_dia`
-- una vez por día. Esa regla ya se corrigió una vez, y con dos copias la
-- próxima corrección arreglaría una y dejaría la otra mintiendo.
-- =============================================================================

create or replace function public.franjas_de_dias(
  p_dias    date[],
  p_zona    text default 'America/Bogota',
  /** La sesión que se está organizando, para excluirla del cálculo. */
  p_excepto uuid default null
)
returns table (dia date, inicio timestamptz, fin timestamptz, ocupada boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Un techo, porque el arreglo lo compone el navegador.
   *
   * Son los días en los que hay alguien citado: en la práctica dos o tres, y
   * una tanda enorme repartida en un mes son veinte. Treinta y uno deja sitio
   * de sobra y evita que una llamada con mil fechas arme mil rejillas.
   */
  c_tope constant integer := 31;
  v_dia date;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional organiza su día.';
  end if;

  if p_dias is null or array_length(p_dias, 1) is null then
    return;
  end if;

  if array_length(p_dias, 1) > c_tope then
    raise exception 'Son demasiados días de una vez.'
      using hint = 'Una sesión no se reparte en más de un mes.';
  end if;

  -- Sin repetidos y en orden: el día visible suele estar ya entre los del
  -- reparto, y armar su rejilla dos veces no cambia nada pero se nota.
  foreach v_dia in array (select array_agg(distinct d order by d) from unnest(p_dias) as d)
  loop
    return query
    select v_dia, f.inicio, f.fin, f.ocupada
    from public.franjas_del_dia(v_dia, p_zona, p_excepto) f;
  end loop;
end;
$$;

comment on function public.franjas_de_dias(date[], text, uuid) is
  'Las franjas de varios días de una sola llamada. Es lo que permite que cada '
  'persona de una tanda repartida elija entre las horas de SU día sin que la '
  'pantalla tenga que cambiar de fecha primero.';

grant execute on function public.franjas_de_dias(date[], text, uuid) to authenticated;
