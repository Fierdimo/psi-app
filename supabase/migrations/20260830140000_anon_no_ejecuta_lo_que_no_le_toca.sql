-- =============================================================================
-- 0061 · `anon` deja de poder ejecutar lo que nunca fue suyo
--
-- NO ARREGLA UN FALLO DEL CÓDIGO: arregla una DERIVA entre local y producción
-- que ninguna migración había mirado, porque en local no existe.
--
-- El Supabase autoalojado del VPS trae en su arranque un `alter default
-- privileges ... grant all on functions to anon`. El CLI que levanta la base de
-- desarrollo, no. Resultado: cada función que crea una migración nace en
-- producción con EXECUTE para `anon`, y en local sin él. Nadie lo escribió;
-- viene de fábrica y no se ve en ningún diff.
--
-- La cuenta, comparando las dos bases: 265 funciones ejecutables por `anon` en
-- producción contra 233 en local. Las 32 de diferencia son las que revoca esta
-- migración.
--
-- -----------------------------------------------------------------------------
-- QUÉ SE PODÍA HACER CON ELLAS
--
-- La clave anónima viaja en el paquete del navegador, así que `anon` es
-- cualquiera. Seis de las 32 son `security definer` y NO comprueban identidad
-- —se escribieron para que las llamara `service_role`, y a nadie le hizo falta
-- una comprobación que el permiso ya daba por hecha—:
--
--   informe_publicado(uuid)                     el informe entero: parámetros,
--                                               textos y nota global
--   cerrar_evaluacion_automaticamente(uuid,jsonb)  publicar un informe con los
--                                               valores que uno quiera
--   cerrar_pase(uuid)                           apagarle el acceso a alguien
--   preparar_invitaciones(uuid)                 emitir invitaciones de una cita
--   asignacion_de_pase(text)                    resolver un testigo
--   citas_para_recordar(int)                    identificadores de cita, y sin
--                                               necesitar ningún secreto
--
-- Las cinco primeras piden un UUID que hay que conocer, así que no es un
-- volcado abierto. La última no pide nada y devuelve justo los UUID que las
-- otras necesitan, que es lo que convierte dos huecos separados en una cadena.
--
-- El resto de las 32 —`autorizar_usos`, `registrar_empresa`, `agendar_cita`…—
-- sí comprueban quién llama y con `anon` fallaban solas. Se revocan igual: que
-- una función esté defendida por dentro no es motivo para dejarla al alcance.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ ES SEGURO REVOCARLAS
--
-- Se revisó quién llama a cada una en la aplicación: `service_role` (el cliente
-- de administración) o una sesión autenticada. NINGUNA se llama con el cliente
-- anónimo. El circuito del pase no se toca — `evaluacion_de_pase`,
-- `consentir_con_pase`, `iniciar_con_pase`, `responder_con_pase`,
-- `enviar_con_pase`, `informe_de_pase`, `preguntas_de_pase` y los demás
-- conservan su EXECUTE, que es explícito y está en sus migraciones.
--
-- El criterio no es una lista escrita a mano: es «que producción se parezca a
-- local», que es la configuración contra la que corren los 295 tests de RLS.
--
-- Y SE CIERRA EL GRIFO, no solo el charco. Sin tocar los privilegios por
-- defecto, la próxima migración que cree una función volvería a abrirla en
-- producción y esto habría que repetirlo.
-- =============================================================================

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'aceptar_invitacion', 'actualizar_plazo_para_empezar', 'actualizar_ventana',
        'agendar_cita', 'asignacion_de_pase', 'asignacion_visible_de_pase',
        'autorizar_usos', 'cancelar_cita', 'cargar_personas', 'cerrar_cita',
        'cerrar_cita_evaluacion', 'cerrar_evaluacion_automaticamente', 'cerrar_pase',
        'citas_para_recordar', 'confirmar_cita', 'emitir_invitaciones',
        'informe_publicado', 'instrumentos_configurables', 'marcar_recordatorio_enviado',
        'pase_de_evaluacion', 'preparar_invitaciones', 'reagendar_solicitud',
        'rechazar_cita', 'rechazar_usos', 'registrar_cambio_cita', 'registrar_empresa',
        'saldo_de_usos', 'solicitar_cita', 'solicitar_cita_evaluacion',
        'solicitar_evaluacion', 'solicitar_reprogramacion', 'solicitar_usos'
      )
  loop
    execute format('revoke execute on function %s from anon', f.firma);
  end loop;
end $$;

/*
 * El grifo, y va SOLO para `postgres`.
 *
 * Los privilegios por defecto se guardan POR ROL QUE CREA el objeto, y quien
 * crea las funciones aquí es `postgres`: es el usuario con el que `db push`
 * aplica las migraciones. Con eso basta para que la deriva no vuelva.
 *
 * El primer intento añadía la misma línea `for role supabase_admin`, pensando
 * en el rol con el que arranca el autoalojado. No se puede: cambiar los
 * privilegios por defecto de OTRO rol exige ser ese rol o superusuario, y
 * `postgres` no es ninguna de las dos cosas. La migración entera abortaba con
 * «permission denied to change default privileges», el `db reset` se paraba ahí
 * y el seed no llegaba a correr.
 *
 * Lo peligroso fue el síntoma: los 295 tests de pgtap SEGUÍAN EN VERDE, porque
 * montan sus propios datos y no necesitan el seed. Lo cazó el e2e del pase, que
 * sí lo necesita, y se quejó de algo que parecía no tener nada que ver —«el rol
 * de servicio no puede leer profiles»—.
 *
 * En local esto no encuentra nada que quitar y no pasa nada: es idempotente y
 * deja las dos bases diciendo lo mismo, que es el objetivo.
 */
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

/*
 * Y las tablas, por lo mismo aunque hoy no haga daño.
 *
 * En producción `anon` tiene select, insert, update y delete sobre las 21
 * tablas; en local, ninguno de los cuatro. Hoy es inocuo y se comprobó: RLS
 * está activada en las 21 y NINGUNA política alcanza a `anon`, ni por rol
 * explícito ni por PUBLIC, así que un select devuelve cero filas y una
 * escritura se rechaza.
 *
 * Pero es una red de una sola capa. El día que alguien escriba una política
 * `to public` pensando en usuarios con sesión, en producción la estaría
 * abriendo también a la calle, y en local no lo vería.
 */
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'revoke select, insert, update, delete on public.%I from anon', t.relname);
  end loop;
end $$;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon;
