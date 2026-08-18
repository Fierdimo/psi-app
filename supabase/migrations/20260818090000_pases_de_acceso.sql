-- =============================================================================
-- 0031 · Pases de acceso: entregar la evaluación en mano
--
-- El correo es hoy el único camino para que un convocado llegue a su
-- evaluación, y es el eslabón que más se rompe: direcciones viejas, filtros de
-- spam corporativos, y el caso más sencillo de todos —que no haya servicio de
-- correo contratado—. Cuando eso pasa, la sesión está confirmada, la persona
-- viene el día acordado, y no puede entrar.
--
-- Esto abre la otra vía: un pase por persona que se entrega a mano. La empresa
-- ya tiene su propio canal con su gente —su intranet, su grupo, el jefe de
-- turno— y es quien mejor puede hacer llegar algo a cincuenta personas.
--
-- DOS CLASES DE PASE, porque hay dos situaciones distintas:
--
--   · Quien NO tiene cuenta recibe una invitación con testigo. Es la que le
--     permite crearla y quedar enlazado a la ficha que la empresa cargó.
--
--   · Quien YA tiene cuenta no necesita nada: su evaluación le aparece al
--     entrar. Se devuelve igualmente, sin testigo, porque si no la lista
--     tendría huecos y quien reparte no sabría si a esa persona se le olvidó
--     el pase o es que no lo necesita.
--
-- LO QUE ESTO CONCEDE, dicho sin adornos: un testigo de invitación es la
-- llave para entrar como esa persona. Al ponerlo en manos de la empresa, la
-- empresa PUEDE crear la cuenta de su empleado y, con ella, aceptar el
-- consentimiento y responder la prueba en su lugar.
--
-- No hay forma criptográfica de evitarlo: quien tiene el enlace tiene el
-- acceso. Por eso el pase se GENERA cuando alguien lo pide, nunca se muestra
-- solo al abrir la pantalla, y queda anotado quién lo pidió.
-- =============================================================================

create table if not exists public.access_passes_log (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  emitido_por    uuid not null references public.profiles (id) on delete cascade,
  cuantos        integer not null,
  created_at     timestamptz not null default now()
);

comment on table public.access_passes_log is
  'Quién generó pases de acceso y cuándo. Un pase permite entrar como la '
  'persona invitada, así que la pregunta «¿quién tuvo esa llave?» tiene que '
  'poder responderse.';

alter table public.access_passes_log enable row level security;

-- Nadie lo lee desde la aplicación: es un registro, no una pantalla. Se
-- consulta con privilegios de servidor cuando haga falta responder por algo.
create policy "El profesional revisa el registro de pases"
  on public.access_passes_log for select
  to authenticated
  using (public.is_professional());

create index if not exists access_passes_log_cita_idx
  on public.access_passes_log (appointment_id, created_at desc);

-- -----------------------------------------------------------------------------

create or replace function public.pases_de_acceso(p_appointment_id uuid)
returns table (
  person_id   uuid,
  nombre      text,
  apellidos   text,
  documento   text,
  email       text,
  tiene_cuenta boolean,
  token       text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.appointment_status;
  v_org    uuid;
  v_fin    timestamptz;
  v_mia    uuid := public.mi_organizacion();
  v_fila   record;
  v_token  text;
  v_cuantos integer := 0;
begin
  select status, organization_id, ends_at
  into v_estado, v_org, v_fin
  from public.appointments where id = p_appointment_id;

  if v_estado is null then
    raise exception 'La sesión no existe.';
  end if;

  if v_org is null then
    raise exception 'Los pases son para sesiones de evaluación de una empresa.';
  end if;

  /*
   * El profesional, o la empresa dueña de la sesión. Nadie más.
   *
   * Se comprueba aquí y no con RLS porque la función es `security definer`:
   * dentro no rigen las políticas, así que la puerta tiene que estar en la
   * primera línea.
   */
  if not public.is_professional() and v_mia is distinct from v_org then
    raise exception 'Esta sesión no es tuya.';
  end if;

  /*
   * Solo cuando ya hay compromiso.
   *
   * Antes de confirmar, la fecha todavía puede cambiar o la sesión caerse. Un
   * pase repartido para una sesión que luego no ocurre es gente presentándose
   * a nada, y una invitación aceptada que ya no tiene sesión detrás.
   */
  if v_estado not in ('confirmada', 'realizada') then
    raise exception 'La sesión debe estar confirmada para repartir accesos.'
      using hint = 'Hasta que el profesional la acepte, la fecha puede cambiar.';
  end if;

  for v_fila in
    select op.id, op.nombre, op.apellidos, op.documento, op.email,
           op.profile_id is not null as con_cuenta
    from public.appointment_attendees aa
    join public.organization_people op on op.id = aa.person_id
    where aa.appointment_id = p_appointment_id
    order by op.nombre, op.apellidos
  loop
    v_token := null;

    if not v_fila.con_cuenta then
      /*
       * Testigo nuevo en cada emisión, y los anteriores siguen valiendo.
       *
       * Invalidarlos sería lo prudente, pero rompería el enlace que quizá ya
       * salió por correo: la persona pincharía el suyo y leería «enlace no
       * válido» mientras alguien le enseña un QR distinto. Todos caducan a la
       * vez y solo uno puede aceptarse —al aceptar, la ficha queda enlazada a
       * una cuenta y las demás dejan de servir para nada.
       */
      v_token := replace(gen_random_uuid()::text, '-', '')
              || replace(gen_random_uuid()::text, '-', '');

      insert into public.invitations (person_id, appointment_id, token_hash, expires_at)
      values (
        v_fila.id,
        p_appointment_id,
        encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
        v_fin + interval '30 days'
      );

      v_cuantos := v_cuantos + 1;
    end if;

    person_id    := v_fila.id;
    nombre       := v_fila.nombre;
    apellidos    := v_fila.apellidos;
    documento    := v_fila.documento;
    email        := v_fila.email;
    tiene_cuenta := v_fila.con_cuenta;
    token        := v_token;
    return next;
  end loop;

  insert into public.access_passes_log (appointment_id, emitido_por, cuantos)
  values (p_appointment_id, auth.uid(), v_cuantos);
end;
$$;

comment on function public.pases_de_acceso(uuid) is
  'Un pase por convocado para entregar a mano. Con testigo si la persona no '
  'tiene cuenta; sin él si ya la tiene. Lo puede pedir el profesional o la '
  'empresa dueña de la sesión, y queda anotado en access_passes_log.';

grant execute on function public.pases_de_acceso(uuid) to authenticated;
