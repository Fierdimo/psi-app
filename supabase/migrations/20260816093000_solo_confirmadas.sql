-- =============================================================================
-- 0028 · La persona convocada solo ve la sesión una vez CONFIRMADA
--
-- Hasta ahora veía también las que estaban sin confirmar, y eso es información
-- que no le toca: una fecha propuesta es la negociación entre su empresa y el
-- profesional, y puede cambiar o no ocurrir. Enseñársela le hace apuntarse un
-- día que quizá nadie le pidió, y de paso le cuenta que hay un trámite en
-- curso —cuándo se pidió, para cuándo, si se rechazó— que no es asunto suyo.
--
-- Se cierra AQUÍ y no en la pantalla. Una condición escrita en la política es
-- la misma para el calendario, para el detalle, para una exportación de datos
-- y para cualquier consulta que se escriba mañana; en la pantalla habría que
-- acordarse cada vez, y ya se olvidó una vez —el detalle seguía respondiendo
-- con datos que el calendario ocultaba—.
--
-- `realizada` sí se ve: es una sesión a la que fue, y su propio historial.
--
-- PENDIENTE, y conviene tenerlo escrito: si una sesión CONFIRMADA se cancela,
-- desaparece de su calendario sin avisarle. Quien ya se había organizado para
-- ese día se entera por no verla. Hace falta avisar al convocado de la
-- cancelación —hoy el aviso solo llega a la empresa— y hasta entonces esto es
-- un agujero conocido, no un descuido.
-- =============================================================================

drop policy if exists "convocado: ve las citas a las que asiste"
  on public.appointments;

create policy "convocado: ve las citas confirmadas a las que asiste"
  on public.appointments for select
  to authenticated
  using (
    public.asisto_a_cita(id)
    and status in ('confirmada', 'realizada')
  );
