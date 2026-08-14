# Psi — Planeación Técnica

> **Estado:** v0.2 · **Fecha:** 2026-08-12 · **Fases F0–F6 implementadas**
> **Depende de:** `docs/SPEC.md` v0.3
> **Principio rector:** la aplicación se construye **agnóstica del hosting**. Dónde se despliega es un parámetro que se decide al final, no una dependencia que se hornea al principio. Se ha respetado: a fecha de hoy el hosting sigue sin decidir y la aplicación funciona igual.
>
> Este documento describe **lo construido**, no lo planeado. Donde algo quedó
> fuera se dice explícitamente y por qué — ver §11 y §15.

---

## 1. Decisiones fijadas

| Decisión              | Elección                                | Motivo                                                                                                   |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Framework             | **Next.js 15+, App Router, TypeScript** | Server Components para lecturas, Server Actions para escrituras. Un solo repositorio, un solo despliegue |
| Estilos               | **Tailwind v4 + tokens CSS**            | Los tokens del spec viven en CSS puro; Tailwind los consume. Portables si se cambia de framework         |
| Componentes           | **shadcn/ui repintado**                 | Código en nuestro repositorio, no dependencia. Se puede modificar hasta cumplir el spec                  |
| Datos y auth          | **Supabase (Postgres + GoTrue + RLS)**  | Open source y autohospedable. Las reglas de acceso viven en la base, no en el código                     |
| Entorno de desarrollo | **Supabase CLI en Docker, local**       | El mismo stack que correría en un VPS. La portabilidad se prueba a diario                                |
| Hosting               | **Sin decidir — parámetro**             | Ver §3.3                                                                                                 |
| Fechas                | **Luxon**                               | Soporte real de zonas IANA. Crítico en Latinoamérica (§10)                                               |
| Correo                | **Resend** vía API                      | Necesario desde el día uno, tanto gestionado como autohospedado                                          |
| Calendario            | **Componente propio**                   | Ver §9.2                                                                                                 |
| Jurisdicción          | **Latinoamérica — habeas data**         | País concreto pendiente (§14)                                                                            |

---

## 2. Alcance técnico del v1

Traducido desde `SPEC.md` §4:

**Público:** landing · registro · ingreso · verificación de correo · recuperación de contraseña · legales.
**Paciente:** panel · calendario (mes/semana/día/agenda) · solicitar, reprogramar y cancelar cita · mis datos · cuatro secciones placeholder.
**Profesional:** agenda con confirmación de solicitudes · creación y reprogramación de citas · listado y ficha de pacientes.

**Fuera:** motor de evaluaciones, pagos, mensajería, videollamada, sincronización con Google Calendar, tema oscuro, multi-profesional.

---

## 3. Arquitectura

### 3.1 Forma general

```
Navegador
   │
   ├── Next.js (App Router)
   │      ├── Server Components ──► lectura vía cliente Supabase con sesión del usuario
   │      └── Server Actions ─────► escritura vía funciones RPC en Postgres
   │
   └── Supabase
          ├── GoTrue      · autenticación, verificación, recuperación
          ├── PostgREST   · acceso a datos filtrado por RLS
          └── Postgres    · esquema, políticas RLS, funciones de transición de estado
```

**Regla de acceso a datos:** las lecturas van directas con RLS aplicando el filtro. Las escrituras **no** son `UPDATE` directos: pasan por funciones RPC en Postgres que validan la transición de estado y escriben el historial de cambios en la misma transacción (§7.3). Esto evita estados imposibles y hace que la auditoría no dependa de que alguien se acuerde de registrarla.

### 3.2 El contrato de portabilidad

Cuatro reglas. No son recomendaciones; si alguna se rompe, la app deja de ser portable y hay que decidir hosting de urgencia.

1. **Todo el esquema vive en `supabase/migrations/*.sql`.** Prohibido crear tablas, columnas o políticas desde el panel web. Si el esquema solo existe en un servidor, no hay portabilidad.
2. **Las políticas RLS son parte de las migraciones** y se revisan como cualquier otro código.
3. **Toda configuración por variables de entorno.** Migrar de gestionado a VPS es reapuntar tres variables y correr migraciones.
4. **Nada exclusivo del plan gestionado.** Sin réplicas de lectura, sin funcionalidades que no existan en el `docker compose` autohospedado.

### 3.3 Destinos de despliegue posibles

Ambos se satisfacen con el mismo código:

|              | Gestionado                   | VPS                                                                |
| ------------ | ---------------------------- | ------------------------------------------------------------------ |
| App          | Cloudflare Workers / Netlify | Contenedor Next.js tras Caddy                                      |
| Base         | Supabase Cloud               | `docker compose` de Supabase                                       |
| Copias       | Incluidas                    | `pg_dump` cifrado fuera de la máquina + **restauración de prueba** |
| Costo aprox. | $25–30 / mes                 | $6–12 / mes + tu tiempo                                            |
| Requisito    | —                            | 4 GB RAM mínimo cómodo                                             |

La decisión se toma antes del primer despliegue a producción, con la app ya construida.

### 3.4 Entornos

| Entorno        | Base                                      | Uso                              |
| -------------- | ----------------------------------------- | -------------------------------- |
| **local**      | Supabase CLI en Docker                    | Desarrollo. Se resetea sin miedo |
| **preview**    | Proyecto Supabase aparte, datos ficticios | Una por rama, para revisar       |
| **producción** | Destino elegido en §3.3                   | Datos reales                     |

**Nunca** datos reales de pacientes fuera de producción. Ni para depurar. El `seed.sql` genera pacientes ficticios.

---

## 4. Estructura del repositorio

```
psi-app/
├── docs/
│   ├── SPEC.md
│   ├── PLAN.md
│   └── design-system.html
├── supabase/
│   ├── config.toml
│   ├── migrations/          # 001_perfiles.sql, 002_citas.sql, ...
│   ├── tests/               # pruebas de RLS en SQL
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── (publico)/       # landing, legales
│   │   ├── (auth)/          # ingresar, registro, recuperar, consentimiento
│   │   ├── (paciente)/      # panel, calendario, mis-datos, placeholders
│   │   └── profesional/     # entrada propia + agenda, pacientes
│   ├── components/
│   │   ├── ui/              # shadcn repintado
│   │   ├── marca/           # <Brand />
│   │   ├── calendario/      # vistas mes/semana/dia/agenda, chip de cita
│   │   └── citas/           # formularios y diálogos
│   ├── lib/
│   │   ├── supabase/        # cliente navegador, servidor, middleware
│   │   ├── fechas/          # envoltorio de Luxon, zonas horarias
│   │   ├── validacion/      # esquemas Zod compartidos
│   │   └── correo/          # plantillas y envío
│   └── styles/
│       └── tokens.css       # única fuente de verdad del color
├── e2e/                     # Playwright
└── .github/workflows/
```

**`src/styles/tokens.css` es la única fuente de verdad del color.** Ningún componente declara un hex literal. Lo verifica CI (§12.2).

---

## 5. Modelo de datos

### 5.1 Tipos y perfiles

```sql
create type user_role          as enum ('paciente', 'profesional');
create type appointment_status as enum (
  'solicitada', 'confirmada', 'reprogramacion_solicitada',
  'realizada', 'cancelada', 'rechazada', 'no_asistio'
);
create type appointment_modality as enum ('presencial', 'virtual');

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              user_role   not null default 'paciente',
  nombre            text,
  apellidos         text,
  telefono          text,
  fecha_nacimiento  date,
  documento         text,
  timezone          text        not null default 'America/Bogota',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

El perfil se crea con un _trigger_ sobre `auth.users` al registrarse, para que no exista un usuario autenticado sin perfil.

### 5.2 Citas

```sql
create table appointments (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references profiles(id) on delete cascade,
  professional_id     uuid not null references profiles(id),
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  modality            appointment_modality not null default 'presencial',
  location            text,
  meeting_url         text,
  status              appointment_status not null default 'solicitada',
  patient_note        text,
  proposed_starts_at  timestamptz,   -- propuesta durante una reprogramación
  proposed_ends_at    timestamptz,
  created_by          uuid not null references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fin_despues_de_inicio check (ends_at > starts_at)
);
```

**Dos restricciones que valen más que cualquier validación en el cliente:**

```sql
-- Imposible agendar dos citas solapadas para el mismo profesional
create extension if not exists btree_gist;

alter table appointments add constraint sin_solapamiento
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('confirmada', 'realizada'));

-- Un paciente solo puede tener una solicitud pendiente a la vez
create unique index una_solicitud_pendiente_por_paciente
  on appointments (patient_id)
  where status in ('solicitada', 'reprogramacion_solicitada');
```

La primera hace **físicamente imposible** el doble agendamiento, incluso ante una condición de carrera entre dos peticiones simultáneas. Validar esto solo en la aplicación es confiar en que nunca habrá dos clics a la vez.

### 5.3 Historial, consentimientos y auditoría

```sql
create table appointment_changes (
  id             bigint generated always as identity primary key,
  appointment_id uuid not null references appointments(id) on delete cascade,
  from_status    appointment_status,
  to_status      appointment_status not null,
  actor_id       uuid references profiles(id),
  reason         text,
  created_at     timestamptz not null default now()
);

create table consents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  document_key text not null,        -- 'consentimiento_informado', 'privacidad'
  version      text not null,        -- '2026-08-01'
  accepted_at  timestamptz not null default now(),
  ip           inet,
  user_agent   text,
  unique (user_id, document_key, version)
);

create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
```

`consents` registra **versión** además de fecha. Si el consentimiento cambia, hay que poder demostrar qué texto exacto aceptó cada persona y cuándo. Un booleano `acepto = true` no sirve como evidencia.

### 5.4 Organizaciones y citas de grupo — v2

El giro a evaluación corporativa (`SPEC.md` §9.2) **no es aditivo**: rompe tres invariantes que hoy están escritas en la base y funcionando.

| Lo que hay hoy                                             | Por qué deja de servir                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `appointments.patient_id` — un paciente, obligatorio       | Una cita de evaluación tiene varios asistentes                                      |
| `sin_solapamiento` — exclusión GiST sobre el rango horario | Impide el atajo de crear N citas simultáneas. **La base rechazaría las ocho filas** |
| `una_solicitud_pendiente_por_paciente`                     | Se temió que bloqueara a las empresas. **No lo hace** — ver abajo                   |
| `user_role` — enum de dos valores                          | Entran `empresa` y `empleado`                                                       |

La segunda fila es la importante: **no hay atajo**. La restricción de exclusión existe para que dos personas no ocupen la misma hora del profesional, y sigue siendo correcta. Por eso la cita pasa a tener asistentes en tabla aparte en lugar de multiplicarse.

```
organizations            la empresa cliente
organization_people      su listado de personas a evaluar; la cuenta llega después
appointment_attendees    a quiénes se convocó a cada sesión
invitations              alta por correo de una persona del listado, con testigo
```

**No hay rol de empleado, y el listado es la razón de que no haga falta.** Una persona evaluada por encargo de su empresa sigue siendo una persona: su relación con esa empresa es un encargo, no una identidad. Modelarla como rol impedía que quien fue evaluado contratara después una asesoría individual con la misma cuenta —justo el cruce que el negocio quiere explotar—, hacía que la pertenencia no caducara nunca, y habría hecho desaparecer a esas personas del listado de pacientes del profesional, que filtra por `role = 'paciente'`.

**Una empresa encarga cien evaluaciones de una vez, y eso decide la forma del modelo.** Exigir que las cien personas tuvieran cuenta antes de poder pedir la cita invierte el orden real: habría que invitarlas, esperar a que aceptaran y solo entonces agendar. Por eso `organization_people` guarda nombre y correo, se convoca desde ahí, y `profile_id` se rellena cuando la persona acepta su invitación. Se puede convocar a quien todavía no tiene cuenta.

**`profiles.organization_id` significa «administra esta empresa», nunca «trabaja aquí».** Una tabla aparte permitiría que alguien perteneciera a varias empresas —que hoy no ocurre— y a cambio convertiría cada política de aislamiento en dos saltos en lugar de uno. En este módulo eso pesa más que la flexibilidad. La columna es tan sensible como `role`, y queda protegida por el mismo mecanismo: la migración 0001 concede una lista blanca de columnas actualizables y `organization_id` no está en ella.

`appointments.patient_id` pasa a ser **nulable** y una restricción exige que la cita sea de una persona o de una empresa, nunca de las dos ni de ninguna. Los asistentes viven en `appointment_attendees`.

`una_solicitud_pendiente_por_paciente` **no necesitó cambio**, contra lo que se temió al planear: es un índice único sobre `patient_id`, y en un índice único los NULL se consideran distintos entre sí. Como las citas corporativas llevan `patient_id` nulo, no compiten por él. La regla sigue aplicando exactamente donde se pensó.

#### El aislamiento entre empresas es el riesgo mayor del proyecto

Hasta ahora RLS respondía a «cada quien ve lo suyo». Ahora hay un límite nuevo —la organización— y el dato que se filtraría en un error son **resultados psicológicos de personas identificadas**. Dos reglas para no equivocarse:

1. **Toda tabla del módulo lleva `organization_id`**, aunque parezca derivable por join. Una política que depende de tres saltos es una política que nadie revisa.
2. **La pertenencia se resuelve en una función `security definer`**, como `is_professional()` (§6.1), y las políticas la llaman. Nunca se repite la subconsulta.

```sql
create function public.mi_organizacion() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create policy "empresa: solo sus propios empleados"
  on results for select using (
    exists (
      select 1 from assignments a
      where a.id = results.assignment_id
        and a.organization_id = public.mi_organizacion()
        and a.status = 'publicada'
    )
  );
```

#### La recursión que hay que esperar

Al escribir las políticas cruzadas —la de citas consultando asistentes y la de asistentes consultando citas— Postgres respondió `infinite recursion detected in policy for relation "appointments"` y tumbó **también** las pruebas de aislamiento entre pacientes que ya pasaban. No fue una sorpresa evitable leyendo con cuidado: es el mismo ciclo que obligó a que `is_professional()` fuera `security definer` (§6.1), y reaparece en cuanto dos tablas se miran entre sí desde sus políticas.

La regla, entonces, generalizada: **toda política que consulte otra tabla protegida por RLS lo hace a través de una función `security definer`**, nunca con una subconsulta directa. Aquí son `asisto_a_cita()` y `organizacion_de_cita()`.

Nótese que la condición de publicación se repite para la empresa: **el profesional autoriza una vez y libera a los dos destinatarios**, nunca uno antes que el otro.

### 5.5 Evaluaciones — v2

En v1 no se creó ninguna tabla, a propósito: un esquema escrito sin conocer el instrumento se rehace. Con el alcance ya fijado —pacientes individuales, resultados bajo autorización del profesional (`SPEC.md` §9.2)— el modelo sí se puede escribir, porque **ninguna de estas tablas depende de qué prueba concreta se cargue**.

```
assessments             plantilla del instrumento; `engine` dice qué módulo lo califica
assessment_items        ítems, opciones y orden. Datos, no código
assessment_parameters   qué devuelve esta prueba: cuántos parámetros y de qué tipo
assignments             una aplicación a un paciente, con su ciclo de vida
responses               una fila por ítem respondido; se escribe según se responde
results                 la cabecera del resultado: calificado, publicado, nota global
result_values           una fila por parámetro: lo calculado y lo escrito por el profesional
documents               certificados e informes en Storage, con su metadato
```

**No hay tabla `sessions`.** El spec la preveía, y se descarta: una tabla de intentos solo se gana su sitio cuando puede haber varios por asignación, y aquí volver a aplicar significa **asignar de nuevo**, que además deja mejor historial. Si algún día hace falta reintentar dentro de una misma asignación, se añade entonces.

**`assessment_items.options` es `jsonb`** con la forma `[{ id, texto, escala }]`. La `escala` es un dato —a qué constructo tributa la opción—, pero **qué se hace con ella es código**: el motor. Esa frontera es la que impide que la baremación acabe siendo un intérprete escrito en JSON.

#### El resultado tiene forma variable

Cada instrumento declara sus parámetros en `assessment_parameters`, y esa declaración **es el contrato del motor**:

```sql
create table public.assessment_parameters (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments (id) on delete cascade,
  key           text not null,          -- 'D', 'segmento', 'recomendaciones'…
  label         text not null,
  kind          text not null,          -- numerico | escala | categoria | texto
  position      int  not null,
  -- Algunos parámetros los calcula el motor, otros solo puede redactarlos el
  -- profesional, y en otros conviven los dos. Esta pareja lo dice.
  computed      boolean not null default true,
  allows_note   boolean not null default false,
  unique (assessment_id, key)
);

create table public.result_values (
  assignment_id uuid not null references assignments (id) on delete cascade,
  parameter_key text not null,
  value         jsonb,        -- lo que calculó el motor
  suggested     text,         -- redacción normalizada que propone el motor
  note          text,         -- lo que escribió el profesional. Manda esto
  primary key (assignment_id, parameter_key)
);
```

Una fila por parámetro, y no un `jsonb` opaco en `results`, por dos razones: permite seguir **un mismo parámetro a lo largo del tiempo** cuando la prueba se repite, y permite que el profesional edite un apartado sin reescribir el bloque entero.

La interfaz del motor queda así:

```ts
type ValorDeParametro = {
  key: string;
  value?: unknown; // según el `kind` declarado
  suggested?: string; // redacción normalizada, si el instrumento la trae
};

interface MotorDePrueba {
  calificar(items: Item[], respuestas: Respuesta[]): ValorDeParametro[];
}
```

Al calificar se **valida que las claves devueltas coincidan con los parámetros declarados** como `computed`. Un motor que se deja uno sin devolver es un error detectado al momento, no un informe con un hueco descubierto por el paciente.

Lo que se publica es `note` cuando existe y `suggested` cuando no. El motor propone; el profesional dispone y firma.

**La calificación no cabe en la base.** Los motores son TypeScript, así que entre `enviada` y `calificada` hay un paso en el servidor de Next: valida que la prueba esté completa, ejecuta el motor y escribe el resultado. Debe ser **idempotente**, porque un reintento tras un fallo de red no puede producir dos resultados.

**Sitio reservado para las pruebas de rendimiento.** Hoy no se aplica ninguna, pero el esquema las contempla desde el principio (`SPEC.md` §9.3): `assessments.kind` (`inventario` | `rendimiento`), `assessments.time_limit_seconds` y `assessment_items.answer_key`. Van vacías mientras solo haya inventarios. Son tres columnas ahora; serían una migración sobre datos clínicos después.

#### Los textos normalizados son datos, no código

Un instrumento trae dos clases de texto: el que **describe** una escala siempre igual, y el que **depende del nivel** obtenido —bajo, medio, alto—. Los dos son contenido que el profesional querrá corregir con el tiempo, así que viven en tablas y no dentro del motor:

```sql
create table public.assessment_texts (
  assessment_id uuid not null references assessments (id) on delete cascade,
  parameter_key text not null,
  -- null = descripción fija de la escala; si no, el nivel al que aplica
  level         text,
  body          text not null,
  primary key (assessment_id, parameter_key, coalesce(level, ''))
);
```

Así, cambiar la redacción de «puntaje medio en Dominancia» es editar una fila, no desplegar. **El motor decide el nivel; la tabla dice cómo se cuenta.** Los puntos de corte sí van en el motor, porque son baremación.

#### El primer instrumento, leído del formulario real

El formulario que la consulta usa hoy (Google Forms, 52 elementos) **no es una prueba: son dos**, aplicadas en una sola sesión. Esto se comprobó leyendo el formulario publicado, no suponiéndolo.

| Bloque           | Formato                                                             | Ítems |
| ---------------- | ------------------------------------------------------------------- | ----- |
| Consentimiento   | Aceptar / No aceptar                                                | 1     |
| Datos personales | Documento, nombres, edad, sexo, cargo, fecha, empresa               | 7     |
| Sección I · DISC | Bloques de 4 adjetivos; se marca el que MÁS y el que MENOS describe | 28    |
| Secciones II–V   | 4 bloques de 10 afirmaciones en escala 1–5 → cuadrantes A, B, C y D | 40    |

De ahí salen dos consecuencias de diseño:

1. **Una asignación puede producir varias secciones de resultado.** Por eso `assessment_parameters` lleva `section`: el informe agrupa por ella (`disc`, `dominancia_cerebral`) sin que el motor tenga que devolver una estructura anidada.
2. **La restricción ipsativa se valida en la plataforma.** Una cuadrícula de Google no puede impedir que alguien marque MÁS y MENOS en la misma fila, o que no marque ninguna. El tipo `forced_choice` sí: exactamente una fila por columna, comprobado antes de aceptar la respuesta. Es la primera mejora medible frente al método actual.

La baremación del segundo bloque se dedujo del informe y encaja: suma de 10 ítems de 1 a 5, multiplicada por dos, da la escala 0–100 sobre la que operan los rangos declarados (80–100 primario, 60–79 secundario, 0–59 terciario).

#### Escrituras por función, como las citas

Ninguna transición se hace con `UPDATE` directo (§6.2):

| Función                                               | Quién       | Efecto                                                                  |
| ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `asignar_prueba(assessment, evaluado, cita, vence)`   | profesional | Crea en `asignada`                                                      |
| `habilitar_examen(asignacion)`                        | profesional | Lo abre en la sesión presencial                                         |
| `iniciar_prueba(asignacion)`                          | evaluado    | Pasa a `en_curso`; exige estar habilitado y con consentimiento aceptado |
| `responder_item(asignacion, item, valor)`             | evaluado    | Inserta o reemplaza; solo en `en_curso`                                 |
| `enviar_prueba(asignacion)`                           | evaluado    | Pasa a `enviada`; exige estar completa                                  |
| `calificar_prueba(asignacion, puntuaciones, informe)` | servidor    | Pasa a `calificada`                                                     |
| `redactar_parametro(asignacion, clave, texto)`        | profesional | Escribe su texto en un parámetro                                        |
| `publicar_resultado(asignacion, nota)`                | profesional | Pasa a `publicada`                                                      |
| `anular_asignacion(asignacion, motivo)`               | profesional | Pasa a `anulada`                                                        |

#### RLS — las tres políticas que importan

```sql
-- 1. El banco de ítems NO es público para cualquiera con cuenta.
--    Un paciente solo ve los ítems de una prueba que le asignaron y que
--    está respondiendo. Sin esto, cualquiera se descarga el instrumento.
create policy "paciente: ítems solo de su prueba en curso"
  on assessment_items for select using (
    exists (
      select 1 from assignments a
      where a.assessment_id = assessment_items.assessment_id
        and a.patient_id = auth.uid()
        and a.status = 'en_curso'
    )
  );

-- 2. El resultado es invisible hasta que el profesional lo publica.
--    Esta política ES el requisito de SPEC §9.2, escrito donde no se puede
--    olvidar: no depende de que la interfaz recuerde ocultarlo.
create policy "paciente: solo resultados publicados"
  on results for select using (
    exists (
      select 1 from assignments a
      where a.id = results.assignment_id
        and a.patient_id = auth.uid()
        and a.status = 'publicada'
    )
  );

-- 3. Las respuestas no se tocan después de enviar.
create policy "paciente: responde solo mientras está en curso"
  on responses for insert with check (
    exists (
      select 1 from assignments a
      where a.id = responses.assignment_id
        and a.patient_id = auth.uid()
        and a.status = 'en_curso'
    )
  );
```

#### Documentos y Storage

Primera vez que el proyecto usa Supabase Storage. Bucket **privado** `documentos`, rutas `pacientes/<patient_id>/<uuid>-<nombre>`, y una fila en `documents` con el metadato. El acceso se sirve con URLs firmadas de vida corta, nunca con el objeto público.

`documents.visible_to_patient` acompaña a la publicación: los certificados de una evaluación se liberan **con** el resultado, no antes.

#### Auditoría

`audit_log` (§5.3) registra asignar, enviar, calificar, publicar y descargar un documento. Publicar un resultado y descargar un certificado son los dos accesos que un día habrá que poder demostrar.

---

## 6. Seguridad

### 6.1 Row Level Security

RLS activo en **todas** las tablas. Sin excepciones, sin tablas «internas» que se dejan abiertas.

```sql
-- Helper. SECURITY DEFINER es obligatorio: sin él, consultar profiles
-- dentro de una política sobre profiles causa recursión infinita.
create function public.is_professional() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'profesional'
  );
$$;

alter table profiles     enable row level security;
alter table appointments enable row level security;

create policy "perfil propio: lectura"
  on profiles for select using (id = auth.uid());

create policy "perfil propio: actualización"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profesional: lee todos los perfiles"
  on profiles for select using (public.is_professional());

create policy "paciente: ve solo sus citas"
  on appointments for select using (patient_id = auth.uid());

create policy "profesional: ve todas las citas"
  on appointments for select using (public.is_professional());
```

**Escalada de privilegios — el fallo que hay que cerrar explícitamente.** La política de actualización de perfil permite al paciente editar su fila. Sin protección adicional, podría cambiar su propio `role` a `profesional` y quedarse con acceso a la agenda completa. Se cierra con privilegios a nivel de columna:

```sql
revoke update (role) on profiles from authenticated;
```

Es una línea, y es la diferencia entre un portal seguro y una brecha de historia clínica.

### 6.2 Escrituras de citas por RPC

Las citas **no** se modifican con `UPDATE` directo. La política de escritura las deniega y toda transición pasa por funciones:

| Función                                        | Quién                  | Efecto                             |
| ---------------------------------------------- | ---------------------- | ---------------------------------- |
| `solicitar_cita(inicio, fin, modalidad, nota)` | paciente               | Crea en `solicitada`               |
| `solicitar_reprogramacion(cita, nuevo_inicio)` | paciente               | Pasa a `reprogramacion_solicitada` |
| `cancelar_cita(cita, motivo)`                  | paciente / profesional | Pasa a `cancelada`                 |
| `confirmar_cita(cita)`                         | profesional            | Pasa a `confirmada`                |
| `rechazar_cita(cita, motivo)`                  | profesional            | Pasa a `rechazada`                 |
| `cerrar_cita(cita, asistio)`                   | profesional            | Pasa a `realizada` o `no_asistio`  |

Cada función valida que la transición sea legal desde el estado actual, verifica el rol, escribe en `appointment_changes` y en `audit_log`, todo en una transacción. Un estado inválido no es un bug posible: es un error de base de datos.

### 6.3 Resto

- Contraseñas gestionadas por GoTrue (bcrypt). Nunca las tocamos.
- `SERVICE_ROLE_KEY` solo en servidor. Nunca en un componente cliente, nunca en `NEXT_PUBLIC_*`.
- Middleware de Next.js protege rutas privadas y refresca sesión; **RLS es la defensa real**, el middleware es conveniencia de navegación.
- Cabeceras: CSP, `X-Frame-Options: DENY`, HSTS.
- Limitación de tasa en registro, ingreso, recuperación y solicitud de cita.
- Sin analítica de terceros en el área privada. Ninguna.

---

## 7. Autenticación y separación de roles

Flujos con GoTrue: registro con verificación de correo · ingreso · recuperación · cambio de correo con reverificación.

### 7.1 Dos entradas, un solo mecanismo

`SPEC.md` §5.1 define dos puertas separadas. Técnicamente comparten GoTrue, la misma tabla de usuarios y el mismo `profiles.role`; lo que cambia es la superficie expuesta y el destino.

|                           | `/ingresar` | `/profesional`        |
| ------------------------- | ----------- | --------------------- |
| Enlazada desde la landing | Sí          | No                    |
| Enlace a «Crear cuenta»   | Sí          | **No existe**         |
| `noindex`                 | No          | **Sí**                |
| Límite de intentos        | Estándar    | Más estricto          |
| Destino tras entrar       | `/panel`    | `/profesional/agenda` |

**La separación de URL no es la frontera de seguridad.** La frontera es RLS (§6). Un atacante que descubra `/profesional` no gana nada: sin una fila en `profiles` con `role = 'profesional'`, la base de datos le devuelve exactamente lo mismo que en `/panel`. La ruta aparte compra tres cosas reales: no publicar la superficie administrativa, poder endurecer límites y añadir 2FA solo ahí más adelante, y una interfaz que le habla bien a cada rol.

### 7.2 Enrutado por rol en el middleware

```
sesión ausente                     → /ingresar
sesión sin consentimiento vigente  → /consentimiento   (bloqueante)
sesión con role = 'paciente'
   ├── ruta bajo /profesional/*    → redirigir a /panel      (sin error)
   └── resto                       → permitir
sesión con role = 'profesional'
   ├── ruta de paciente            → redirigir a /profesional/agenda
   └── resto                       → permitir
```

**Dos decisiones deliberadas en ese flujo:**

Entrar por la puerta equivocada **redirige, no falla**. Si un paciente inicia sesión en `/profesional` con credenciales correctas, entra y aterriza en su panel. Un mensaje del tipo «esta cuenta no tiene permisos de profesional» convertiría el formulario en un oráculo para descubrir qué correos son privilegiados.

El consentimiento se evalúa **antes** que el rol, y aplica a ambos. Nadie usa la plataforma sin haber aceptado la versión vigente.

### 7.3 Creación de la cuenta del profesional

Se crea por migración de datos (`seed.sql` en local, script puntual en producción). **No hay pantalla para promover usuarios ni para registrar profesionales.** La ausencia de esa pantalla es la decisión de seguridad; sumada a `revoke update (role)` (§6.1), significa que no existe ninguna ruta desde la interfaz para que alguien gane privilegios.

### 7.4 Consecuencia sobre el modelo de citas

La asimetría «el paciente pide, el profesional autoriza» ya está codificada en las funciones RPC de §6.2: `solicitar_cita` la crea en `solicitada`, y solo `confirmar_cita` —que verifica `is_professional()`— la lleva a `confirmada`. Ninguna acción del paciente puede producir una cita confirmada, y eso lo garantiza Postgres, no el frontend.

El mismo patrón servirá cuando el profesional envíe documentos o asigne evaluaciones: el rol ya está en el modelo y las políticas ya distinguen quién escribe qué.

---

## 8. Correo transaccional

Resend. Plantillas en `src/lib/correo/`, texto plano y HTML sobrio con la paleta.

| Disparador                | Asunto                                     |
| ------------------------- | ------------------------------------------ |
| Verificación de cuenta    | «Confirma tu correo»                       |
| Recuperación              | «Restablece tu contraseña»                 |
| Cita confirmada           | «Tu cita del 18 de agosto está confirmada» |
| Cita reprogramada         | «Cambio en tu cita»                        |
| Cita cancelada            | «Tu cita fue cancelada»                    |
| Recordatorio (24 h antes) | «Recordatorio de tu cita»                  |

**Regla de confidencialidad, no negociable:** ningún correo menciona contenido clínico, motivo de consulta ni la palabra que identifique el tipo de atención. Fecha, hora y modalidad. El asunto puede aparecer en la pantalla de bloqueo de un teléfono que otra persona esté mirando.

El recordatorio de 24 h necesita ejecución programada: `pg_cron` en la base, que funciona igual gestionado y autohospedado — a diferencia de un cron del hosting, que no sería portable.

---

## 9. Frontend

### 9.1 Convenciones

- Server Components por defecto; `"use client"` solo donde hay interacción.
- Mutaciones con Server Actions que llaman a las RPC de §6.2.
- Validación con **Zod**, esquema compartido entre cliente y servidor.
- Formularios con React Hook Form.
- Sin librería de estado global. La caché de Next y el estado local alcanzan.
- Tokens de diseño solo desde `tokens.css`. Cero hex literales en componentes.

### 9.2 El calendario — construir, no integrar

Evaluado contra las alternativas (`react-big-calendar`, FullCalendar, Schedule-X), la recomendación es **componente propio**. Razones:

- El spec exige control del marcado para cumplir accesibilidad: la retícula anunciada como tabla, cada cita como botón con etiqueta accesible completa, `aria-live` en cambios de mes. Las librerías generalistas no lo garantizan y pelearlas cuesta más que escribirlo.
- El tratamiento de chips por estado (tinte, no bloque sólido) requiere sobrescribir estilos profundos de cualquier librería.
- No necesitamos arrastrar y soltar, ni recurrencia, ni múltiples calendarios superpuestos — que es donde las librerías ganan.

Cuatro vistas, en este orden de construcción por dificultad creciente:

1. **Agenda** (lista) — la más simple y la que se usa en móvil por defecto
2. **Mes** — retícula 7×N, chips con «+N más»
3. **Semana** — columnas por día, filas por hora, línea de hora actual
4. **Día** — la de semana con una sola columna

Si el tiempo aprieta, **semana y día son las recortables**: agenda y mes cubren el caso de uso real de un paciente que quiere saber cuándo es su próxima sesión.

---

## 10. Zonas horarias

La fuente de errores más probable de este proyecto, y en Latinoamérica no es teórica: un paciente que viaja entre países pierde una sesión por una diferencia de una hora.

**Reglas:**

1. Todo instante se almacena en `timestamptz`. Nunca una hora local sin zona.
2. Cada perfil guarda su zona IANA (`America/Bogota`, `America/Mexico_City`).
3. Toda presentación convierte a la zona del perfil, nunca a la del navegador por defecto.
4. Si la zona del dispositivo difiere de la del perfil, la interfaz avisa y ofrece cambiarla.
5. La cabecera del calendario muestra siempre la zona activa.
6. Luxon en toda operación de fecha. Prohibido `new Date()` para aritmética de calendario.
7. Pruebas con al menos dos zonas y un cambio de horario de verano.

---

## 11. Orden de construcción — registro

Cada fase terminó en algo desplegable y revisable. **Todas están completas.**
Se conservan las estimaciones originales junto a lo que realmente contuvo cada
una, porque la diferencia es información útil para la próxima planeación.

### F0 · Fundaciones — S (2–3 días)

Repositorio, Next.js + TypeScript + Tailwind v4, `tokens.css` desde el spec, `<Brand />`, shadcn repintado (botón, campo, tarjeta, badge, diálogo, toast), Supabase local en Docker, migración inicial de perfiles, CI mínima con la regla anti-negro.
**Entregable:** una página que demuestra el sistema de diseño y compila en CI.

### F1 · Autenticación y público — M (5–7 días)

Landing, registro, **las dos entradas separadas** (`/ingresar` y `/profesional`), verificación, recuperación, páginas legales, consentimiento bloqueante con registro versionado, **middleware con enrutado por rol** (§7.2), envío de correo con Resend.
**Entregable:** alguien puede crear cuenta, verificar, aceptar consentimiento y entrar a un área privada vacía; el profesional entra por su puerta y aterriza en su propio lado.

### F2 · Estructura privada y perfil — S (2–3 días)

Layout privado, barra lateral y barra inferior móvil, `/mis-datos` completo con las cuatro secciones, las cuatro páginas placeholder con su estado vacío.
**Entregable:** área privada navegable y completa salvo el calendario.

### F3 · Calendario — L (7–10 días)

Esquema de citas con sus restricciones, RLS, las seis funciones RPC, las cuatro vistas, chips por estado, solicitar/reprogramar/cancelar, detalle de cita, manejo de zonas horarias.
**Entregable:** el paciente ve y gestiona sus citas. **La partida más grande del v1.**

### F4 · Panel — S (2 días)

Tarjeta de próxima cita, accesos a secciones, solicitudes pendientes, estados vacíos.

### F5 · Área del profesional — M (5–6 días)

Envoltorio visual propio (cabecera `--brand-800`, densidad media, navegación compacta), agenda completa, bandeja de solicitudes con confirmar/rechazar/proponer, creación y reprogramación, cierre de citas, listado y ficha de pacientes.
**Entregable:** el profesional autoriza citas sin tocar la base de datos.

### F6 · Endurecimiento — M (4–5 días)

Pruebas de RLS, auditoría de accesibilidad con teclado y lector de pantalla, revisión de contraste, e2e de los flujos críticos, `pg_cron` de recordatorios, observabilidad, decisión de hosting y despliegue, copias de seguridad **con restauración probada**.

### Lo que NO entró, y por qué

- **Proponer otro horario** desde la bandeja del profesional. Puede confirmar,
  rechazar o agendar una cita nueva, pero no contraproponer sobre la solicitud
  existente. Falta una función de transición en la base; se dejó sin hacer en
  vez de improvisar un apaño de dos pasos que perdiera el vínculo con la
  solicitud original.
- **Resolver solicitudes de eliminación de cuenta.** Se registran y se muestran
  al profesional en el listado y en la ficha, pero marcarlas como atendidas se
  hace hoy en Studio.
- **Servicio de errores** (Sentry o equivalente). Los fallos se ven en los
  registros del servidor.
- **Revisión manual de accesibilidad** con teclado y lector de pantalla. La
  auditoría automática (§12.1) cubre contraste, etiquetas y estructura, pero no
  dice si el recorrido tiene sentido.

### v2 · Evaluaciones — orden propuesto

Cuatro fases. Las tres primeras no necesitan saber qué instrumento es; la carga del contenido real espera a la licencia (`SPEC.md` §9.3).

**F7 · Motor y catálogo — M (5–7 días).** Tablas, RLS con sus pruebas, la interfaz `MotorDePrueba` y su registro, un instrumento de laboratorio para desarrollar contra algo, y el catálogo del profesional.

**F8 · Sesión del paciente — M (5–6 días).** Ejecutor genérico para todos los tipos de ítem, autoguardado, reanudación y envío. Es la fase con más superficie de accesibilidad: se responde con teclado y sin presión de tiempo.

**F9 · Revisión y publicación — S (3–4 días).** Vista de revisión del profesional, nota de interpretación, publicación, y el aviso por correo al paciente —neutro, sin nombrar el instrumento ni el resultado.

**F10 · Documentos y certificados — S (3 días).** Storage, subida desde la ficha del paciente, liberación junto al resultado y descarga por URL firmada.

El consentimiento específico de evaluación entra en F7, no al final: sin él no se puede aplicar la primera prueba.

### Lo que se descubrió construyendo

Cosas que no estaban en el plan y costaron tiempo real:

- **Zod 4 cambió `.uuid()`** para exigir RFC 4122 estricto. Postgres acepta
  cualquier valor con esa forma, así que un identificador válido para la base
  era rechazado por la validación. Se usa `z.guid()`.
- **GoTrue no tolera NULL** en `confirmation_token` y columnas afines. Una
  siembra incompleta produce un 500 opaco al iniciar sesión.
- **`service_role` no hereda permisos de escritura** sobre las tablas propias:
  hay que concederlos de forma explícita (migración 0005). Es una ventaja
  disfrazada de molestia, porque obliga a decidir tabla por tabla.
- **Los estilos base fuera de `@layer base`** ganan a las utilidades de
  Tailwind. Produjo títulos a 1.3:1 sobre el panel azul durante varias fases,
  sin que nadie lo notara hasta la auditoría automática.
- **Una redirección desde un layout anidado** cambia lo que se renderiza pero
  no siempre la URL. El destino se calcula ahora en un solo salto (§7.2).

---

## 12. Calidad

### 12.1 Pruebas

| Tipo          | Herramienta             | Qué cubre                                                                                                                                     |
| ------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarias     | Vitest                  | Lógica de fechas, validación, transiciones de estado                                                                                          |
| **RLS**       | SQL sobre base local    | **Que un paciente no pueda leer citas de otro**, ni confirmar una cita, ni cambiar su propio `role`. Las pruebas más importantes del proyecto |
| Integración   | Vitest + Supabase local | Las seis funciones RPC, incluidos los rechazos                                                                                                |
| E2E           | Playwright              | Registro → consentimiento → solicitar cita → confirmar → ver en calendario                                                                    |
| Accesibilidad | axe en Playwright       | Cero violaciones críticas en todas las rutas                                                                                                  |

Las pruebas de RLS se escriben suplantando usuarios reales (`set local role`, `set local request.jwt.claims`) e intentando explícitamente el acceso indebido. Una política que nunca se probó con un atacante simulado no está verificada.

### 12.2 CI

En cada _pull request_: formato · lint · `tsc --noEmit` · **regla anti-negro** (falla ante `#000`, `black`, `rgba(0,0,0`) · migraciones aplican sobre base limpia · unitarias · RLS · e2e · axe.

---

## 13. Operación

- **Errores:** Sentry, con depuración de datos personales antes de enviar. Un rastro de error no puede llevar el nombre de un paciente.
- **Registros:** los de Supabase; en VPS, `docker compose logs` con rotación.
- **Copias de seguridad:** gestionado, incluidas. Autohospedado, `pg_dump` diario cifrado fuera de la máquina, con retención de 30 días y **una restauración de prueba antes de salir a producción**. Una copia que nunca se restauró no es una copia.
- **Runbook:** si se elige VPS, se documenta arranque, despliegue, restauración y rotación de credenciales. Se escribe en F6, no después.

---

## 14. Legal — habeas data

Pendiente el país concreto, pero estos elementos aplican en toda la región y se construyen desde el inicio:

- **Autorización expresa** del titular para tratar datos sensibles → `consents` con versión (§5.3)
- **Finalidad declarada** en la política de privacidad
- **Derechos de acceso, rectificación y supresión** → sección de privacidad en `/mis-datos` (`SPEC.md` §7.5), con exportación y solicitud de eliminación
- **Política de retención** → pendiente de definir con el profesional
- **Seguridad demostrable** → RLS, cifrado en tránsito y reposo, auditoría
- **Confidencialidad en notificaciones** → §8

Lo que falta decidir con el cliente: país de ejercicio, plazo de retención de historial, y si la eliminación de cuenta borra o anonimiza las citas pasadas — hay obligaciones profesionales de conservación de historia clínica que pueden chocar con el derecho de supresión, y esa tensión la resuelve el profesional con su asesor legal, no nosotros.

---

## 15. Riesgos

| Riesgo                                                     | Impacto | Mitigación                                                    |
| ---------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| El calendario se subestima                                 | Alto    | F3 aislada y con vistas recortables definidas de antemano     |
| Errores de zona horaria                                    | Alto    | Reglas de §10 desde el modelo de datos; pruebas con dos zonas |
| Escalada de privilegios por `role`                         | Crítico | `revoke update (role)`, más prueba de RLS explícita           |
| Aparece el instrumento de evaluación y arrastra requisitos | Medio   | Módulo diferido; nada del v1 depende de él                    |
| Se decide hosting tarde y bloquea                          | Bajo    | Contrato de portabilidad de §3.2                              |
| Correo de cita expone información clínica                  | Alto    | Plantillas neutras revisadas en F1                            |

---

## Próximo paso

Cerrar tres datos con el cliente antes de F3: **país de ejercicio**, **duración por defecto de una cita y franja horaria de atención**, y **política de cancelación**. Ninguno bloquea F0–F2, así que la construcción puede empezar ya.
