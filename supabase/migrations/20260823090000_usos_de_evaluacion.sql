-- =============================================================================
-- 0053 · Los usos de evaluación
--
-- SPEC-EVALUACIONES.md §3.1–§3.2, §4.1 · PLAN-EVALUACIONES.md F1
--
-- La unidad de negocio deja de ser la sesión y pasa a ser el USO: una empresa
-- compra N, el profesional los autoriza cuando comprueba el pago fuera de la
-- plataforma, y la empresa gasta uno por cada evaluación que encarga.
--
-- Aquí solo está la mitad de la compra —pedir, autorizar, y saber cuánto
-- queda—. El gasto vive en la migración siguiente, con la función que crea la
-- evaluación, porque descontar y encargar tienen que ser el MISMO acto o hay
-- un momento en que el saldo bajó y no existe la prueba que lo justifique.
--
-- -----------------------------------------------------------------------------
-- POR QUÉ UN LIBRO MAYOR Y NO UNA COLUMNA `saldo`
--
-- Un contador es un número sin historia. El día que una empresa diga «pagué
-- cincuenta y me aparecen cuarenta y tres» no hay absolutamente nada que
-- mirar: ni cuándo bajó, ni por qué, ni quién lo tocó. Y con dinero de por
-- medio esa conversación llega.
--
-- Aquí el saldo no se guarda: SE CALCULA. Cada movimiento apunta a su causa
-- —la autorización que lo cargó, la evaluación que lo gastó— y sumarlos da el
-- saldo. Es más caro de leer y no importa: son decenas de filas por empresa,
-- no millones, y la trazabilidad es justo lo que se está comprando.
--
-- Es la misma decisión que el proyecto ya tomó con `audit_log`, aplicada al
-- único sitio donde había dinero.
-- =============================================================================

create type public.ticket_order_status as enum (
  'solicitada',
  'autorizada',
  'rechazada'
);

comment on type public.ticket_order_status is
  'solicitada: la empresa pidió y espera. autorizada: el profesional comprobó '
  'el pago y cargó el saldo. rechazada: no se cargó nada y la empresa sabe por qué.';

create type public.ticket_movement_kind as enum ('carga', 'consumo');

-- -----------------------------------------------------------------------------
-- La solicitud de compra
-- -----------------------------------------------------------------------------
create table public.ticket_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  cantidad        integer not null,

  -- Lo que escribe la empresa: «cotización 2411», «para la planta de
  -- Barranquilla». No lo lee ninguna función; existe para que el profesional
  -- sepa a qué trámite corresponde el pago que está por comprobar.
  nota            text,

  status          public.ticket_order_status not null default 'solicitada',

  solicitada_por  uuid not null references public.profiles (id),

  -- Quién resolvió y cuándo. Nulos mientras está pendiente.
  resuelta_por    uuid references public.profiles (id),
  resuelta_at     timestamptz,

  -- Al rechazar, obligatorio: una empresa que ve «rechazada» sin motivo no
  -- sabe si volver a intentarlo o llamar por teléfono.
  motivo          text,

  -- Lo que el profesional anota del pago que ocurrió FUERA: número de
  -- transferencia, factura, lo que sea. La plataforma no cobra y no pretende
  -- hacerlo; lo que sí puede es dejar constancia de contra qué se autorizó.
  referencia_pago text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Un tope de cordura, no una regla de negocio. Nadie compra mil usos de una
  -- vez; quien escriba «500» queriendo «50» lo descubre aquí y no tres
  -- pantallas después.
  constraint cantidad_razonable check (cantidad > 0 and cantidad <= 1000),

  -- Resuelta significa resuelta POR ALGUIEN Y EN ALGÚN MOMENTO. Sin esto se
  -- puede dejar una orden autorizada sin firma, que es exactamente el estado
  -- que vuelve inútil la auditoría.
  constraint resolucion_coherente check (
    (status = 'solicitada' and resuelta_por is null and resuelta_at is null)
    or (status <> 'solicitada' and resuelta_por is not null and resuelta_at is not null)
  ),

  -- Y rechazar exige decir por qué.
  constraint rechazo_con_motivo check (
    status <> 'rechazada' or coalesce(btrim(motivo), '') <> ''
  )
);

comment on table public.ticket_orders is
  'Compra de usos de evaluación. El pago ocurre fuera de la plataforma; aquí '
  'queda quién lo dio por bueno, cuándo y contra qué referencia.';

create trigger ticket_orders_touch_updated_at
  before update on public.ticket_orders
  for each row execute function public.touch_updated_at();

create index ticket_orders_organizacion_idx
  on public.ticket_orders (organization_id, created_at desc);

-- La bandeja del profesional lee por aquí, y son las pocas filas que le
-- importan de una tabla que solo crece.
create index ticket_orders_pendientes_idx
  on public.ticket_orders (created_at)
  where status = 'solicitada';

-- Una solicitud pendiente por empresa, y a la vez.
--
-- Es el mismo patrón que `una_solicitud_pendiente_por_paciente` de 0002, y por
-- el mismo motivo: sin él, pulsar dos veces el botón deja dos órdenes
-- idénticas en la bandeja y el profesional no puede saber si son un duplicado
-- o dos compras de verdad. Con él, la segunda falla y la empresa corrige la
-- primera.
create unique index una_solicitud_pendiente_por_empresa
  on public.ticket_orders (organization_id)
  where status = 'solicitada';

-- -----------------------------------------------------------------------------
-- El libro mayor
-- -----------------------------------------------------------------------------
create table public.ticket_ledger (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  kind            public.ticket_movement_kind not null,

  -- Positivo en las cargas, negativo en los consumos. El saldo es la suma, sin
  -- ramas ni condicionales: `sum(cantidad)`.
  cantidad        integer not null,

  -- La causa del movimiento. Uno de los dos, según el tipo, y nunca los dos:
  -- un movimiento sin causa es un descuadre que nadie podrá explicar después.
  --
  -- `assignment_id` se rellena en la migración siguiente, cuando exista la
  -- función que gasta. La columna se declara ya para no volver a tocar la
  -- tabla con datos dentro.
  order_id        uuid references public.ticket_orders (id) on delete restrict,
  assignment_id   uuid references public.assignments (id) on delete restrict,

  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),

  constraint movimiento_con_causa check (
    (kind = 'carga'   and cantidad > 0 and order_id is not null and assignment_id is null)
    or (kind = 'consumo' and cantidad < 0 and assignment_id is not null and order_id is null)
  )
);

comment on table public.ticket_ledger is
  'Libro mayor de usos. El saldo de una empresa es sum(cantidad) sobre sus '
  'filas. No hay contador que pueda desviarse de esto porque no hay contador.';

comment on column public.ticket_ledger.cantidad is
  'Positivo carga, negativo consume. Nunca cero: un movimiento que no mueve '
  'nada no es un movimiento.';

-- `on delete restrict` en las dos causas, y es deliberado.
--
-- Con `cascade`, borrar una orden autorizada se llevaría por delante su carga
-- y el saldo bajaría solo, sin rastro. Con `set null`, quedaría un movimiento
-- huérfano imposible de explicar. Que la base se niegue a borrar la causa
-- mientras exista el movimiento es la respuesta correcta: en contabilidad no
-- se borra, se compensa.

create index ticket_ledger_organizacion_idx
  on public.ticket_ledger (organization_id, created_at desc);

create unique index ticket_ledger_una_carga_por_orden
  on public.ticket_ledger (order_id)
  where order_id is not null;

comment on index public.ticket_ledger_una_carga_por_orden is
  'La última defensa contra autorizar dos veces. `autorizar_usos` ya lo impide '
  'comprobando el estado bajo candado; esto lo impide aunque esa comprobación '
  'se rompa algún día.';

-- =============================================================================
-- Saldo
-- =============================================================================
create or replace function public.saldo_de_usos(p_org uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := coalesce(p_org, public.mi_organizacion());
begin
  if v_org is null then
    raise exception 'No hay ninguna empresa de la que consultar el saldo.';
  end if;

  -- Una empresa consulta el suyo; el profesional, el de cualquiera. Sin esto,
  -- pasar el uuid de otra empresa devolvería su saldo: no es un dato grave,
  -- pero es un dato de otro y no hay ninguna razón para entregarlo.
  if not public.is_professional() and v_org is distinct from public.mi_organizacion() then
    raise exception 'Ese saldo no es tuyo.';
  end if;

  -- `coalesce` y no el sum a secas: una empresa sin movimientos tiene saldo
  -- cero, no saldo desconocido. Devolver null obligaría a cada pantalla a
  -- acordarse de traducirlo, y alguna se olvidaría.
  return coalesce(
    (select sum(cantidad)::integer from public.ticket_ledger where organization_id = v_org),
    0
  );
end;
$$;

comment on function public.saldo_de_usos(uuid) is
  'Usos disponibles de una empresa. Sin argumento, los de quien pregunta.';

revoke all on function public.saldo_de_usos(uuid) from public;
grant execute on function public.saldo_de_usos(uuid) to authenticated;

-- =============================================================================
-- Pedir
-- =============================================================================
create or replace function public.solicitar_usos(
  p_cantidad integer,
  p_nota     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_org   uuid := public.mi_organizacion();
  v_orden uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if v_org is null then
    raise exception 'Solo una empresa solicita usos.';
  end if;

  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'Pide al menos un uso.';
  end if;

  if p_cantidad > 1000 then
    raise exception 'Son demasiados usos para una sola solicitud.'
      using hint = 'Si de verdad necesitas más de mil, escríbenos y lo tramitamos aparte.';
  end if;

  begin
    insert into public.ticket_orders (organization_id, cantidad, nota, solicitada_por)
    values (v_org, p_cantidad, nullif(btrim(p_nota), ''), v_uid)
    returning id into v_orden;
  exception
    when unique_violation then
      -- El índice parcial hablando. Se traduce, porque «duplicate key value
      -- violates unique constraint» no le dice a nadie qué hacer.
      raise exception 'Ya tienes una solicitud de usos esperando respuesta.'
        using hint = 'Puedes corregirla o esperar a que se resuelva.';
  end;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'usos.solicitados', 'ticket_order', v_orden::text,
          jsonb_build_object('cantidad', p_cantidad));

  return v_orden;
end;
$$;

revoke all on function public.solicitar_usos(integer, text) from public;
grant execute on function public.solicitar_usos(integer, text) to authenticated;

-- =============================================================================
-- Autorizar
--
-- El único acto que carga saldo en toda la plataforma.
-- =============================================================================
create or replace function public.autorizar_usos(
  p_order      uuid,
  p_referencia text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_orden record;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional autoriza usos.';
  end if;

  /*
   * El candado va ANTES de mirar el estado, no después.
   *
   * Leer el estado y luego actualizarlo es una carrera: dos pulsaciones
   * simultáneas leen 'solicitada' las dos, y las dos cargan. `for update`
   * hace que la segunda espere a que la primera termine, y cuando entra ya ve
   * 'autorizada' y se detiene en la comprobación de abajo.
   */
  select * into v_orden
  from public.ticket_orders
  where id = p_order
  for update;

  if v_orden is null then
    raise exception 'Esa solicitud no existe.';
  end if;

  if v_orden.status <> 'solicitada' then
    raise exception 'Esa solicitud ya está %.', v_orden.status
      using hint = 'Recarga la bandeja para ver cómo quedó.';
  end if;

  update public.ticket_orders
  set status          = 'autorizada',
      resuelta_por    = v_uid,
      resuelta_at     = now(),
      referencia_pago = nullif(btrim(p_referencia), '')
  where id = p_order;

  insert into public.ticket_ledger
    (organization_id, kind, cantidad, order_id, created_by)
  values
    (v_orden.organization_id, 'carga', v_orden.cantidad, p_order, v_uid);

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'usos.autorizados', 'ticket_order', p_order::text,
          jsonb_build_object(
            'cantidad', v_orden.cantidad,
            'organizacion', v_orden.organization_id,
            'referencia', nullif(btrim(p_referencia), '')
          ));
end;
$$;

revoke all on function public.autorizar_usos(uuid, text) from public;
grant execute on function public.autorizar_usos(uuid, text) to authenticated;

-- =============================================================================
-- Rechazar
--
-- No toca el libro. Un rechazo no es un movimiento de cero: es la ausencia de
-- movimiento, y escribirlo como una fila con cantidad 0 haría que el libro
-- dejara de poder sumarse a ciegas.
-- =============================================================================
create or replace function public.rechazar_usos(
  p_order  uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_orden record;
begin
  if not public.is_professional() then
    raise exception 'Solo el profesional resuelve solicitudes de usos.';
  end if;

  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Dile a la empresa por qué se rechaza.'
      using hint = 'Lo verá tal cual, así que conviene que sirva para corregir.';
  end if;

  select * into v_orden
  from public.ticket_orders
  where id = p_order
  for update;

  if v_orden is null then
    raise exception 'Esa solicitud no existe.';
  end if;

  if v_orden.status <> 'solicitada' then
    raise exception 'Esa solicitud ya está %.', v_orden.status
      using hint = 'Recarga la bandeja para ver cómo quedó.';
  end if;

  update public.ticket_orders
  set status       = 'rechazada',
      resuelta_por = v_uid,
      resuelta_at  = now(),
      motivo       = btrim(p_motivo)
  where id = p_order;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'usos.rechazados', 'ticket_order', p_order::text,
          jsonb_build_object('organizacion', v_orden.organization_id));
end;
$$;

revoke all on function public.rechazar_usos(uuid, text) from public;
grant execute on function public.rechazar_usos(uuid, text) to authenticated;

-- =============================================================================
-- Row Level Security
--
-- Solo lectura, como el resto del proyecto: toda escritura pasa por las
-- funciones de arriba, que comprueban rol y estado. Sin políticas de insert ni
-- de update, una empresa no puede cargarse saldo con una petición a PostgREST
-- por mucho que conozca la tabla.
-- =============================================================================
alter table public.ticket_orders enable row level security;
alter table public.ticket_ledger enable row level security;

create policy "empresa: ve sus solicitudes de usos"
  on public.ticket_orders for select
  to authenticated
  using (organization_id = public.mi_organizacion());

create policy "profesional: ve todas las solicitudes de usos"
  on public.ticket_orders for select
  to authenticated
  using (public.is_professional());

create policy "empresa: ve sus movimientos"
  on public.ticket_ledger for select
  to authenticated
  using (organization_id = public.mi_organizacion());

create policy "profesional: ve todos los movimientos"
  on public.ticket_ledger for select
  to authenticated
  using (public.is_professional());

grant select on public.ticket_orders to authenticated;
grant select on public.ticket_ledger to authenticated;
