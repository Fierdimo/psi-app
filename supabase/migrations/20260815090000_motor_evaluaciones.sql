-- =============================================================================
-- 0018 · Motor de evaluaciones
--
-- SPEC.md §9.2 · PLAN.md §5.5
--
-- Un instrumento se parte en dos mitades: SUS ÍTEMS SON DATOS y SU
-- CALIFICACIÓN ES CÓDIGO. Los ítems, sus opciones y sus parámetros viven aquí,
-- de modo que un único ejecutor dibuja cualquier prueba; la baremación vive en
-- un módulo TypeScript registrado por clave, porque expresar una elección
-- forzada con segmentos y tabla de patrones como «reglas en datos» acaba
-- siendo inventar un lenguaje de programación en JSON.
-- =============================================================================

create type public.assessment_kind as enum ('inventario', 'rendimiento');

create type public.item_type as enum (
  'single_choice',
  'multiple_choice',
  'likert',
  'ranking',
  'numeric',
  'open_text',
  'image_choice',
  -- Elegir dentro de un bloque la que MÁS y la que MENOS describe. Es el
  -- formato ipsativo de los instrumentos tipo DISC, y no estaba en la lista
  -- original del spec: apareció al leer el formulario real de la consulta.
  'forced_choice'
);

create type public.parameter_kind as enum (
  'numerico',
  'escala',
  'categoria',
  'texto'
);

create type public.assignment_status as enum (
  'asignada',
  'en_curso',
  'enviada',
  'calificada',
  'publicada',
  'vencida',
  'anulada'
);

-- -----------------------------------------------------------------------------
-- La plantilla del instrumento
-- -----------------------------------------------------------------------------
create table public.assessments (
  id            uuid primary key default gen_random_uuid(),
  clave         text not null unique,
  nombre        text not null,
  descripcion   text,

  -- Qué módulo de TypeScript lo califica. La plantilla no sabe puntuar: sabe
  -- a quién preguntarle.
  motor         text not null,
  version       text not null default '1',

  -- Sitio reservado para las pruebas de rendimiento (SPEC §9.3). Hoy todo es
  -- inventario y estas dos columnas van vacías; añadirlas ahora cuesta dos
  -- columnas, añadirlas con el esquema poblado cuesta una migración sobre
  -- datos clínicos.
  kind               public.assessment_kind not null default 'inventario',
  time_limit_seconds integer,

  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint tiempo_solo_en_rendimiento check (
    time_limit_seconds is null or kind = 'rendimiento'
  )
);

create trigger assessments_touch_updated_at
  before update on public.assessments
  for each row execute function public.touch_updated_at();

create table public.assessment_items (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  posicion      integer not null,
  tipo          public.item_type not null,
  enunciado     text not null,

  -- `[{ id, texto, escala }]`. La escala dice a qué constructo tributa cada
  -- opción; qué se hace con ella es cosa del motor. Esa frontera es la que
  -- impide que la baremación acabe siendo un intérprete escrito en JSON.
  opciones      jsonb not null default '[]'::jsonb,

  -- Clave de corrección. Nula en un inventario: no hay respuesta correcta a
  -- «¿cuál te describe más?».
  answer_key    jsonb,

  created_at    timestamptz not null default now(),

  unique (assessment_id, posicion),
  constraint clave_solo_con_respuesta_correcta check (
    answer_key is null or jsonb_typeof(answer_key) <> 'null'
  )
);

create index assessment_items_assessment_idx
  on public.assessment_items (assessment_id, posicion);

-- -----------------------------------------------------------------------------
-- Qué devuelve la prueba
--
-- Cada instrumento declara sus parámetros, y esa declaración ES EL CONTRATO
-- del motor: al calificar se comprueba que devolvió todos los que están
-- marcados como calculados.
-- -----------------------------------------------------------------------------
create table public.assessment_parameters (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  clave         text not null,
  etiqueta      text not null,
  kind          public.parameter_kind not null,
  posicion      integer not null,

  -- Un informe puede traer varias familias de parámetros —el perfil DISC por
  -- un lado, los cuadrantes de dominancia cerebral por otro— y la pantalla
  -- agrupa por aquí en vez de obligar al motor a devolver algo anidado.
  seccion       text,

  -- Unos los calcula el motor, otros solo puede redactarlos el profesional, y
  -- en otros conviven los dos. Esta pareja lo dice.
  computed      boolean not null default true,
  admite_nota   boolean not null default false,

  unique (assessment_id, clave)
);

-- -----------------------------------------------------------------------------
-- Los textos normalizados del instrumento
--
-- Son contenido, no código: el profesional querrá corregir una redacción sin
-- esperar a un despliegue. `nivel` nulo es la descripción fija de la escala;
-- con nivel, el texto que corresponde a ese tramo de puntuación.
--
-- Los PUNTOS DE CORTE sí van en el motor: eso es baremación.
-- -----------------------------------------------------------------------------
create table public.assessment_texts (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  parameter_key text not null,
  -- Nulo = la descripción fija de la escala. Con valor = el texto de ese tramo.
  nivel         text,
  cuerpo        text not null
);

-- La unicidad va en un índice y no en la clave primaria porque `nivel` puede
-- ser nulo —y una clave primaria no admite nulos—. `nulls not distinct` es lo
-- que impide dos descripciones fijas del mismo parámetro.
create unique index assessment_texts_unico
  on public.assessment_texts (assessment_id, parameter_key, nivel)
  nulls not distinct;

-- =============================================================================
-- La aplicación a una persona
-- =============================================================================
create table public.assignments (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments (id),

  -- La sesión en la que se aplica. `set null` y NO cascada: si algún día se
  -- borrara la cita, el informe de quien ya respondió no debe evaporarse con
  -- ella (SPEC §9.2 — cancelar no retira lo ya evaluado).
  appointment_id uuid references public.appointments (id) on delete set null,

  -- Igual que en las citas: o es de una persona convocada por una empresa, o
  -- es de un paciente individual. Nunca las dos, nunca ninguna.
  person_id      uuid references public.organization_people (id) on delete cascade,
  patient_id     uuid references public.profiles (id) on delete cascade,

  -- Se copia al asignar en vez de deducirse por saltos. Una política que
  -- encadena tres subconsultas es una política que nadie vuelve a revisar, y
  -- estas son justo las que no pueden estar mal.
  organization_id uuid references public.organizations (id) on delete cascade,

  status         public.assignment_status not null default 'asignada',
  assigned_by    uuid not null references public.profiles (id),
  assigned_at    timestamptz not null default now(),
  vence_at       timestamptz,

  -- Lo abre el profesional durante la sesión presencial. Sin esto, responder
  -- no empieza (SPEC §9.2).
  habilitado_at  timestamptz,
  started_at     timestamptz,
  submitted_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint evaluado_coherente check (
    (person_id is not null and patient_id is null and organization_id is not null)
    or (person_id is null and patient_id is not null and organization_id is null)
  )
);

create trigger assignments_touch_updated_at
  before update on public.assignments
  for each row execute function public.touch_updated_at();

-- La misma prueba no se asigna dos veces en la misma sesión a la misma
-- persona. Volver a aplicarla más adelante es otra sesión, y por tanto otra
-- asignación con su propio historial.
create unique index assignments_una_por_sesion
  on public.assignments (appointment_id, person_id, assessment_id)
  where appointment_id is not null and person_id is not null;

create index assignments_person_idx  on public.assignments (person_id);
create index assignments_patient_idx on public.assignments (patient_id);
create index assignments_org_idx     on public.assignments (organization_id);

-- -----------------------------------------------------------------------------
-- Respuestas: una fila por ítem, escrita según se responde.
--
-- Perder veintiocho respuestas por una caída de red es perder la prueba
-- entera, así que no se acumulan en memoria hasta el final.
-- -----------------------------------------------------------------------------
create table public.responses (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  item_id       uuid not null references public.assessment_items (id) on delete cascade,
  valor         jsonb not null,
  answered_at   timestamptz not null default now(),

  primary key (assignment_id, item_id)
);

-- -----------------------------------------------------------------------------
-- El resultado
-- -----------------------------------------------------------------------------
create table public.results (
  assignment_id uuid primary key references public.assignments (id) on delete cascade,
  scored_at     timestamptz not null default now(),
  -- Lo que el profesional escribe para el conjunto, además de lo que redacte
  -- parámetro por parámetro.
  nota_global   text,
  released_at   timestamptz,
  released_by   uuid references public.profiles (id)
);

-- Una fila por parámetro, y no un jsonb opaco: permite seguir un mismo
-- parámetro a lo largo del tiempo cuando la prueba se repite, y permite editar
-- un apartado sin reescribir el bloque entero.
create table public.result_values (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  parameter_key text not null,
  valor         jsonb,
  -- Redacción normalizada que propone el motor.
  sugerido      text,
  -- Lo que escribió el profesional. Manda esto.
  nota          text,

  primary key (assignment_id, parameter_key)
);

-- =============================================================================
-- El consentimiento pasa a ser un historial de decisiones
--
-- Se consiente CADA evaluación, no «ser evaluado» en general, y la decisión es
-- reversible en las dos direcciones: quien rechaza puede aceptar después, y
-- quien aceptó puede retirarlo — que es lo que el propio texto promete.
-- =============================================================================
alter table public.consents
  add column assignment_id uuid references public.assignments (id) on delete cascade;

alter table public.consents
  add column decision text not null default 'aceptado'
  check (decision in ('aceptado', 'rechazado'));

-- La restricción original impedía dos aceptaciones del mismo documento. Ahora
-- tiene que admitir varias evaluaciones, y además varios rechazos de la misma:
-- alguien duda, se niega, lo piensa y vuelve.
alter table public.consents
  drop constraint consents_user_id_document_key_version_key;

create unique index consents_aceptacion_unica
  on public.consents (user_id, document_key, version, assignment_id)
  nulls not distinct
  where (decision = 'aceptado');

comment on column public.consents.decision is
  'El estado vigente es la ÚLTIMA decisión, no la existencia de una fila. Los '
  'rechazos se conservan: que conste que alguien pudo negarse es lo que hace '
  'válido que después aceptara.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.assessments            enable row level security;
alter table public.assessment_items       enable row level security;
alter table public.assessment_parameters  enable row level security;
alter table public.assessment_texts       enable row level security;
alter table public.assignments            enable row level security;
alter table public.responses              enable row level security;
alter table public.results                enable row level security;
alter table public.result_values          enable row level security;

-- Rompe el ciclo entre `assignments` y las tablas que la miran, igual que
-- `asisto_a_cita()` lo rompió entre citas y asistentes.
create or replace function public.mi_asignacion(p_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    left join public.organization_people op on op.id = a.person_id
    where a.id = p_assignment
      and (a.patient_id = (select auth.uid())
           or op.profile_id = (select auth.uid()))
  );
$$;

create or replace function public.organizacion_de_asignacion(p_assignment uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.assignments where id = p_assignment;
$$;

create or replace function public.asignacion_publicada(p_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments
    where id = p_assignment and status = 'publicada'
  );
$$;

-- El catálogo lo ve el profesional; nadie más necesita saber qué instrumentos
-- existen.
create policy "profesional: ve el catalogo"
  on public.assessments for select to authenticated
  using (public.is_professional());

/*
 * EL BANCO DE ÍTEMS NO ES PÚBLICO PARA CUALQUIERA CON CUENTA.
 *
 * Una persona solo ve los ítems de una prueba que le asignaron y que está
 * respondiendo. Sin esto, cualquiera con una cuenta se descarga el instrumento
 * entero y se lo estudia — y el instrumento es el producto.
 */
create policy "evaluado: ve los items de su prueba en curso"
  on public.assessment_items for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.assessment_id = assessment_items.assessment_id
        and a.status = 'en_curso'
        and public.mi_asignacion(a.id)
    )
  );

create policy "profesional: ve todos los items"
  on public.assessment_items for select to authenticated
  using (public.is_professional());

create policy "profesional: ve los parametros"
  on public.assessment_parameters for select to authenticated
  using (public.is_professional());

create policy "profesional: ve los textos"
  on public.assessment_texts for select to authenticated
  using (public.is_professional());

-- Las asignaciones: cada quien la suya, la empresa las que encargó, el
-- profesional todas.
create policy "evaluado: ve sus asignaciones"
  on public.assignments for select to authenticated
  using (public.mi_asignacion(id));

create policy "empresa: ve las asignaciones que encargo"
  on public.assignments for select to authenticated
  using (
    organization_id is not null
    and organization_id is not distinct from public.mi_organizacion()
  );

create policy "profesional: ve todas las asignaciones"
  on public.assignments for select to authenticated
  using (public.is_professional());

-- Las respuestas son de quien las escribió y del profesional. La empresa NO
-- las ve: contrató un informe, no la hoja de respuestas.
create policy "evaluado: ve sus respuestas"
  on public.responses for select to authenticated
  using (public.mi_asignacion(assignment_id));

create policy "profesional: ve todas las respuestas"
  on public.responses for select to authenticated
  using (public.is_professional());

/*
 * LA POLÍTICA QUE ES EL REQUISITO.
 *
 * El informe no existe para nadie hasta que el profesional lo publica, y eso
 * no depende de que la interfaz se acuerde de ocultarlo: está escrito donde no
 * se puede olvidar. La condición de publicación se repite para los dos
 * destinatarios, porque se libera a la vez o no se libera.
 */
create policy "evaluado: solo su resultado publicado"
  on public.results for select to authenticated
  using (
    public.mi_asignacion(assignment_id)
    and public.asignacion_publicada(assignment_id)
  );

create policy "empresa: solo los resultados publicados que encargo"
  on public.results for select to authenticated
  using (
    public.organizacion_de_asignacion(assignment_id)
      is not distinct from public.mi_organizacion()
    and public.mi_organizacion() is not null
    and public.asignacion_publicada(assignment_id)
  );

create policy "profesional: ve todos los resultados"
  on public.results for select to authenticated
  using (public.is_professional());

create policy "evaluado: solo sus valores publicados"
  on public.result_values for select to authenticated
  using (
    public.mi_asignacion(assignment_id)
    and public.asignacion_publicada(assignment_id)
  );

create policy "empresa: solo los valores publicados que encargo"
  on public.result_values for select to authenticated
  using (
    public.organizacion_de_asignacion(assignment_id)
      is not distinct from public.mi_organizacion()
    and public.mi_organizacion() is not null
    and public.asignacion_publicada(assignment_id)
  );

create policy "profesional: ve todos los valores"
  on public.result_values for select to authenticated
  using (public.is_professional());

-- Solo lectura, como el resto: toda escritura pasa por funciones que validan
-- rol y transición.
grant select on public.assessments           to authenticated;
grant select on public.assessment_items      to authenticated;
grant select on public.assessment_parameters to authenticated;
grant select on public.assessment_texts      to authenticated;
grant select on public.assignments           to authenticated;
grant select on public.responses             to authenticated;
grant select on public.results               to authenticated;
grant select on public.result_values         to authenticated;
