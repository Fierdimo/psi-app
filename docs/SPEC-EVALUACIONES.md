# Psi — Evaluaciones por usos · Especificación del giro de producto

> **Estado:** v1.0 · **Fecha:** 2026-08-23 · **Propuesta, sin implementar**
> **Alcance:** sustituye el eje del producto. Deja de ser un portal de citas
> con evaluaciones colgando y pasa a ser una plataforma de evaluación por
> encargo, con saldo prepago.
> **Relación con los documentos anteriores:** `SPEC.md` (v0.3) y `PLAN.md`
> siguen describiendo lo construido. Este documento dice qué de aquello se
> retira y qué lo reemplaza. Donde haya conflicto, manda este.

---

## 1. Qué cambia, en una frase

Antes: una empresa **pedía una cita**, el profesional la **confirmaba y la
repartía por horas**, y dentro de esa sesión se asignaban evaluaciones.

Ahora: una empresa **compra usos**, el profesional los **autoriza tras
comprobar el pago fuera de la plataforma**, y la empresa **gasta un uso por
persona** para mandarle una evaluación por correo. No hay fecha, no hay hora,
no hay calendario.

El cambio no es de pantallas: es de **unidad de negocio**. La unidad deja de
ser _la sesión_ y pasa a ser _el uso_.

---

## 2. Roles

| Rol           | Existe         | Se puede crear desde el registro público |
| ------------- | -------------- | ---------------------------------------- |
| `empresa`     | Sí             | **Sí — es la única alta pública**        |
| `profesional` | Sí             | No. Se siembra por migración de datos    |
| `paciente`    | **Se elimina** | —                                        |

Solo dos roles, y esa es la lista completa. Quien responde una evaluación **no
aparece en esta tabla porque no es un usuario** — ver §2.3.

### 2.1 El registro público pasa a ser el alta de empresa

Hoy `/registro` crea una cuenta con rol `paciente` y nadie llama nunca a
`registrar_empresa()`: la función existe en la base sin puerta en la interfaz.
El formulario pasa a pedir, en una sola pantalla:

- **De la empresa:** nombre, NIT (opcional), correo o teléfono de contacto — al
  menos uno de los dos, porque el pago se resuelve fuera de la plataforma y sin
  canal la solicitud de usos se queda muerta en la bandeja.
- **De quien administra:** nombre, correo y contraseña.

**La cuenta y su organización nacen juntas, en el disparador.** Este documento
proponía otra cosa —guardar los datos en `raw_user_meta_data` y llamar a
`registrar_empresa()` desde `/auth/callback`, porque esa función necesita
`auth.uid()` y no hay sesión hasta verificar el correo—. **El rodeo sobraba:**
en `handle_new_user` no hace falta `auth.uid()`, se tiene `new.id` delante.

Hacerlo en un solo paso elimina de golpe toda una familia de estados a medias
—cuenta verificada sin empresa, metadatos perdidos, la llamada que falla y
nadie reintenta— que el diseño de dos pasos obligaba a atender con una pantalla
de rescate. O nacen las dos, o no nace ninguna.

**El rol es `empresa` siempre**, tenga organización o no. Es lo que hace cierto
que «una cuenta nueva es de empresa»: no depende de que el formulario mande
bien los metadatos ni de que nadie olvide un paso.

**Que la organización se cree antes de verificar el correo no es un problema.**
Es inerte: nadie puede entrar, no obtiene ningún dato por existir y nada ocurre
hasta que solicita usos y el profesional los autoriza comprobando un pago. Lo
máximo que consigue un alta falsa es ocupar una línea — el mismo razonamiento
que ya justificaba que una empresa pudiera darse de alta sola.

**Queda una red, `/alta-de-empresa`**, para las cuentas que lleguen sin
organización por otra vía (la API de administración, un registro sin
metadatos). No es un camino alternativo de diseño: sin ella esas cuentas
quedarían atrapadas en un bucle —el área de empresa las rebota por no tener
organización, y las rebota hacia el área de empresa—. El middleware manda ahí a
toda cuenta de empresa sin `organization_id`.

### 2.2 El rol `paciente` se elimina del tipo

No se apaga: se quita. Postgres no tiene `alter type ... drop value`, así que
hay que reescribir el tipo, y aun así compensa hacerlo. Un valor de enum que
nadie emite pero que sigue siendo válido es una puerta que alguien reabre en
seis meses «para probar algo», y con ella vuelve un área entera de la
aplicación que ya no existe. Que la base rechace el valor es la única garantía
que no depende de que nadie se despiste.

**Cómo se reescribe** (una migración, en este orden):

1. `create type user_role_nuevo as enum ('profesional','empresa')`
2. `alter table profiles alter column role drop default`
3. `alter table profiles alter column role type user_role_nuevo using role::text::user_role_nuevo`
4. `drop type user_role` · `alter type user_role_nuevo rename to user_role`
5. `alter table profiles alter column role set default 'empresa'`

El paso 3 **falla si queda una sola fila con `'paciente'`**, y esa es la
propiedad que interesa: la migración no puede correr por accidente sobre datos
que nadie decidió qué hacer con ellos.

**Qué pasa con las cuentas `paciente` que existan.** En local son siembra y se
van con `db:reset`. Si en producción hubiera alguna real, es una **baja de
titular**, no una limpieza técnica: se exporta lo suyo por el circuito de
habeas data que ya existe (`/mis-datos/exportar`) y se borra la cuenta, antes
de correr esta migración. La migración no lo hace sola a propósito — borrar
cuentas de gente en silencio no es algo que deba caber en un `db:reset`.

El defecto de `profiles.role` pasa a `'empresa'`: con el registro público
convertido en alta de empresa, es lo que crea el disparador `handle_new_user`
para toda cuenta nueva.

### 2.3 Quien responde una evaluación no es un usuario

No es que tenga un rol reducido: **no existe como usuario en ningún momento**.
No hay fila en `auth.users`, no hay fila en `profiles`, no hay contraseña que
recuperar ni cuenta que cerrar. El enlace **es** la credencial
(`/prueba/[token]`, cliente anónimo, sin sesión), y eso ya está construido.

Lo que sí permanece —y es lo único— son **sus datos junto a los resultados de
su evaluación**: nombre, correo, y el documento si la empresa lo aportó. Viven
pegados a la evaluación que los motivó, no a una identidad, para que la empresa
pueda releer el informe meses después y saber de quién es.

La diferencia no es filosófica, tiene tres consecuencias que se ven en el
código:

1. **Se retira toda la maquinaria de invitación a crear cuenta.** La ruta
   `/invitacion/[token]`, la acción `aceptarInvitacion`, el enlazado por cédula
   a una cuenta existente y el índice `profiles_documento_unico` que lo
   sostenía. `invitations` sobrevive, pero solo como **pase a una evaluación**;
   ya no invita a nada.
2. **`organization_people.profile_id` desaparece.** Era el puente entre la
   ficha y una cuenta. Sin cuentas, no hay puente.
3. **Nadie acumula historial entre empresas.** La misma persona evaluada por
   Acme y por Globex son dos registros que el sistema no relaciona, ni puede.
   Es exactamente lo que pide el punto 2.6 del encargo, y es también la razón
   por la que la cédula deja de ser identidad (§3.3).

---

## 3. El flujo, entero

```
  EMPRESA                     PROFESIONAL                  PERSONA EVALUADA
     │
     ├─ 1. Solicita N usos ──────────▶ bandeja
     │                                    │
     │                       2. Comprueba el pago (fuera)
     │                                    │
     │   ◀───── 3. Autoriza / rechaza ────┤
     │        (saldo += N)                │
     │
     ├─ 4. Gasta 1 uso: nombre + correo
     │      (saldo −= 1)
     │      └── correo con enlace y QR ───────────────────────▶ 5. Consiente
     │                                                            y responde
     │                                                               │
     │   ◀──── 6. Informe por correo ◀── cierre automático ◀─────────┤
     │        + queda en la plataforma                               │
     │                                                               │
     │                       7. (opcional) Corrige el informe        │
     │                          y la empresa ve la versión al día    │
```

### 3.1 Solicitar usos

La empresa pide una cantidad y, si quiere, escribe una nota («cotización 2411»,
«para la planta de Barranquilla»). No se paga en la plataforma y no se pretende
que se pague: el estado inicial es `solicitada` y ahí se queda.

### 3.2 Autorizar

El profesional ve la solicitud con el canal de contacto de la empresa al lado
—es por donde resolvió el pago— y decide. Al autorizar puede anotar una
**referencia de pago** (número de transferencia, factura). Al rechazar, un
motivo, que le llega a la empresa.

Autorizar **carga el saldo**. Es el único acto que lo carga.

### 3.3 Gastar un uso

Dos campos obligatorios —**nombre** y **correo**— y uno opcional: el
**documento**, si la empresa lo tiene a mano. Nada más. No hay cargo, no hay
vínculo, no hay tipo de contrato: para mandar una prueba y devolver un informe,
eso no hace falta saberlo.

El documento **no limita el proceso en ningún punto**. No se valida contra
nada, no se compara con otro registro, no impide enviar si falta y no impide
enviar si se repite. Es una etiqueta que la empresa se pone a sí misma para
distinguir dos homónimos en una tanda de cuarenta. Dejó de ser identidad el día
que dejó de haber cuentas que enlazar (§2.3).

Al enviar, en una sola transacción: se crea la ficha descartable, se crea la
evaluación, se descuenta el uso y se emite el pase. Después —ya fuera de la
transacción— sale el correo.

**El uso se descuenta al enviar, y no se devuelve.** Si la persona nunca
responde, el uso se gastó. La alternativa —reservar y cobrar al terminar—
obliga a llevar saldo disponible y saldo reservado, y a decidir cuándo caduca
una reserva; es complejidad real a cambio de un caso que la empresa resuelve
reenviando el enlace a la misma dirección.

### 3.4 Responder

El mecanismo no cambia: consentimiento, ejecutor, envío. El consentimiento
sigue abriendo la evaluación (`habilitado_at`), que es lo que antes hacía el
profesional al empezar la sesión presencial.

Lo que sí cambia es **el texto que se firma**, y de arriba abajo: ver §7.

### 3.5 El informe

Ya está construido en `cierre-automatico.ts`: al enviar la prueba se califica,
se publica y se avisa por correo a la empresa. El correo **no lleva el informe
dentro**, lleva el enlace — la regla no cambia, y por los mismos motivos.

El informe queda en `/empresa/informes` para siempre. Que permanezca es
requisito explícito del encargo (punto 2.5).

**Y sale un segundo correo, a la persona evaluada**, con el enlace a su propio
informe. Es nuevo, y arrastra un cambio en el vencimiento del pase: §8.3.

### 3.6 La persona se descarta

La ficha no se reutiliza. No se dedupe por documento, no se enlaza a ninguna
cuenta, no aparece en ningún listado de plantilla. La misma persona evaluada
por dos empresas son dos fichas, dos evaluaciones y dos informes, cada uno
visible solo para quien lo pagó.

Esto **relaja** restricciones que hoy existen y que en el modelo nuevo estorban:
`organization_people.documento` deja de ser obligatorio y deja de ser único por
empresa.

---

## 4. Modelo de datos

### 4.1 Lo nuevo

**`ticket_orders`** — la solicitud de compra y su resolución.

| Columna           | Tipo                  | Nota                                         |
| ----------------- | --------------------- | -------------------------------------------- |
| `id`              | uuid pk               |                                              |
| `organization_id` | uuid not null         | → `organizations`, on delete cascade         |
| `cantidad`        | integer not null      | `> 0`                                        |
| `nota`            | text                  | Lo que escribe la empresa                    |
| `status`          | `ticket_order_status` | `solicitada` / `autorizada` / `rechazada`    |
| `solicitada_por`  | uuid not null         | → `profiles`                                 |
| `resuelta_por`    | uuid                  | → `profiles`. Solo el profesional            |
| `resuelta_at`     | timestamptz           |                                              |
| `motivo`          | text                  | Obligatorio al rechazar                      |
| `referencia_pago` | text                  | Lo que el profesional anota del pago externo |
| `created_at`      | timestamptz not null  |                                              |

**`ticket_ledger`** — el libro mayor de usos.

| Columna           | Tipo                   | Nota                                   |
| ----------------- | ---------------------- | -------------------------------------- |
| `id`              | uuid pk                |                                        |
| `organization_id` | uuid not null          |                                        |
| `kind`            | `ticket_movement_kind` | `carga` / `consumo`                    |
| `cantidad`        | integer not null       | Positivo en carga, negativo en consumo |
| `order_id`        | uuid                   | → `ticket_orders`, en las cargas       |
| `assignment_id`   | uuid                   | → `assignments`, en los consumos       |
| `created_by`      | uuid not null          | → `profiles`                           |
| `created_at`      | timestamptz not null   |                                        |

**Por qué un libro mayor y no una columna `saldo` en `organizations`.** Un
contador es un número sin historia: el día que una empresa reclame «pagué
cincuenta y me aparecen cuarenta y tres» no hay nada que mirar. Con el libro
mayor, el saldo **es** `sum(cantidad)` y cada movimiento apunta a su causa —la
autorización que lo cargó o la evaluación que lo gastó—. Es la misma decisión
que ya tomó el proyecto con `audit_log`, aplicada al dinero.

**Cómo se evita gastar dos veces el mismo uso.** Leer el saldo y luego insertar
el consumo es una condición de carrera: dos formularios enviados a la vez leen
`saldo = 1` y los dos descuentan. La función que gasta **bloquea la fila de la
organización** (`select ... from organizations where id = v_org for update`)
antes de sumar el saldo, y libera al terminar la transacción. Es un candado por
empresa, no global: dos empresas distintas no se estorban.

### 4.2 Lo que se modifica

**`organization_people`** — deja de ser un listado de personas y pasa a ser
**los datos de quien fue evaluado**, colgados de su evaluación. El nombre de la
tabla se queda: renombrarla obliga a tocar una docena de funciones y políticas
que hoy funcionan, y no gana nada que un comentario no gane.

- `documento`: pasa a nulable; se retira el check `documento_no_vacio`.
- Se retira `una_vez_por_empresa unique (organization_id, documento)`. Es
  justamente lo que el modelo descartable necesita romper: la misma persona
  puede ser evaluada dos veces por la misma empresa.
- **`profile_id`: se elimina la columna.** No hay cuentas que enlazar (§2.3).
  Con ella se va el índice `profiles_documento_unico`, que existía solo para
  reconocer a alguien entre empresas.
- **`vinculo` y `cargo`: se eliminan.** Y con `vinculo` se va el tipo
  `person_link`. No se usan para nada en el flujo nuevo.
- **Una fila pertenece a exactamente una evaluación.** Se garantiza con
  `create unique index una_evaluacion_por_ficha on assignments (person_id) where person_id is not null`,
  en la misma migración que dispone de las filas heredadas. Sin ese índice la
  regla es una promesa en un comentario.

**`invitations`** — el pase.

- Se añade `assignment_id uuid references assignments (id) on delete cascade`.
- `appointment_id` deja de escribirse.
- **`asignacion_de_pase(token)` resuelve por `assignment_id` directo.** Hoy
  resuelve buscando «la evaluación de esa persona en esa cita», un rodeo que
  existía porque el pase era de la sesión. Ahora el pase es **de la
  evaluación**, uno a uno, y la resolución es una lectura.
- **`asignacion_visible_de_pase(token)` deja de comprobar `expires_at` sobre
  una evaluación publicada.** Responder tiene plazo; leer el propio informe, no
  (§8.4).

**`assignments`**

- `appointment_id` queda siempre nulo. La columna se mantiene: borrarla obliga
  a tocar políticas y funciones que hoy funcionan, y no gana nada.
- `assigned_by` pasa a ser la cuenta de **la empresa**, no la del profesional.
  Es quien encarga.

### 4.3 Lo que se congela

`appointments`, `appointment_attendees`, `appointment_changes`,
`clinic_settings` (horario, duración, reparto), `consents` de tratamiento
individual. Las tablas se quedan, con sus datos y sus políticas. **Nadie les
escribe una fila más.** No hay migración destructiva: el día que el profesional
quiera volver a agendar, está todo.

---

## 5. Funciones nuevas

| Función                                                                                 | Quién                           | Qué hace                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solicitar_usos(p_cantidad int, p_nota text)`                                           | empresa                         | Inserta `ticket_orders` en `solicitada`. Rechaza cantidades ≤ 0 y una segunda solicitud pendiente de la misma empresa.                                                                            |
| `autorizar_usos(p_order uuid, p_referencia text)`                                       | profesional                     | Marca `autorizada` e inserta la carga en el libro. Idempotente: sobre una ya resuelta, error claro.                                                                                               |
| `rechazar_usos(p_order uuid, p_motivo text)`                                            | profesional                     | Marca `rechazada`. No toca el libro.                                                                                                                                                              |
| `saldo_de_usos(p_org uuid)`                                                             | empresa (la suya) / profesional | `sum(cantidad)` del libro.                                                                                                                                                                        |
| `solicitar_evaluacion(p_assessment_clave, p_nombre, p_apellidos, p_email, p_documento)` | empresa                         | **La función central.** Bloquea la organización, comprueba saldo, crea ficha + `assignment` + consumo + invitación, y devuelve `(assignment_id, token)` con el testigo en claro **una sola vez**. |
| `pase_de_evaluacion(p_assignment uuid)`                                                 | empresa dueña / profesional     | Devuelve el testigo vivo de esa evaluación para volver a enseñar el QR o reenviar el enlace. Sustituye a `pases_de_acceso(cita)`.                                                                 |

Todas `security definer`, `revoke from public`, `grant` al rol que toca — igual
que el resto del proyecto. Las escrituras siguen sin pasar por PostgREST.

### 5.1 RLS

- `ticket_orders`: la empresa lee las suyas (`organization_id = mi_organizacion()`);
  el profesional lee todas. Nadie escribe por la API.
- `ticket_ledger`: idéntico.
- El aislamiento entre empresas no estrena mecanismo: reutiliza
  `mi_organizacion()`, que es la función que ya sostiene todo el módulo
  corporativo.

---

## 6. Navegación

### 6.1 Empresa

| Sección      | Ruta                    | Qué es                                            |
| ------------ | ----------------------- | ------------------------------------------------- |
| Inicio       | `/empresa`              | Saldo de usos, lo pendiente, y las dos acciones   |
| Evaluaciones | `/empresa/evaluaciones` | **Todo lo encargado**, con su informe dentro      |
| Usos         | `/empresa/usos`         | Saldo, historial de compras, «Solicitar más usos» |
| Datos        | `/empresa/datos`        | Sin cambio                                        |

**Se retiran** `/empresa/personas/*` y `/empresa/sesiones/*`. «Personas»
desaparece como concepto: no hay plantilla que mantener, y quien aparece en una
evaluación aparece dentro de ella.

**Y «Informes» también, pero por otra razón.** No es que sobrara: es que era la
MISMA lista que «Evaluaciones» con otro nombre. Tenía que enseñar también las
no publicadas —o quien encargó veinte y ve cinco informes no sabe si las otras
quince se perdieron— y acababa duplicándola. Quien encargaba miraba en una para
saber si ya habían respondido y en la otra para leer el resultado.

Ahora hay **una fila por encargo**. Cuando está lista se abre y el informe está
dentro; cuando no, se abre y dice en qué punto va.

`/empresa/informes` y `/empresa/informes/[id]` **se conservan como
redirecciones**, no se borran: esa dirección viajó en los correos de «informe
disponible» ya enviados, y un enlace que responde 404 en el correo de alguien
es una llamada de soporte.

#### La forma del listado

- **Cuatro columnas:** nombre, evaluación, fecha, estado. Una tabla y no
  tarjetas — son datos cortos y lo que se hace con ellos es comparar; una
  tarjeta por evaluación ocupa cuatro líneas y obliga a desplazarse para
  comparar dos.
- **Diez filas por página**, menos que las veinte de los listados anteriores.
  Aquí cada fila se entra a leer, no a barrer: con veinte, la paginación deja
  de usarse y se navega con la rueda.
- **De la más reciente a la más antigua**, con desempate estable por
  identificador. Sin él, `range` reparte la misma fila en dos páginas y deja
  otra sin aparecer.
- **Buscador** por nombre, apellidos, documento y correo, en un formulario
  `GET`: la búsqueda vive en la dirección, así que se recarga, se guarda y se
  vuelve atrás sin perderla.
- **Filtro por estado**, en cinco grupos y no en uno por estado: la empresa ve
  seis etiquetas en la columna pero solo tres preguntas la traen a filtrar
  —quién falta por responder, qué informes hay, qué se quedó por el camino—.
  Los grupos son **exhaustivos**: todo estado cae en alguno, porque un filtro
  que deja filas fuera de todos sus grupos hace que alguien cuente las de
  «Todas», no le cuadre, y deje de fiarse del filtro entero.
  - Cada grupo lleva **su recuento, con la búsqueda ya aplicada**. Contarlos
    sin ella pondría «Sin responder 40» junto a una tabla de una fila, y a
    partir de ahí el número no lo cree nadie.
  - Son enlaces y no un desplegable: cambiar de grupo es un clic, no elegir y
    además pulsar «Buscar».
  - Grupo y búsqueda **viajan juntos** —entre sí y con la paginación—, o pasar
    a la página dos devuelve la lista entera sin filtrar.
  - Un `estado` inventado en la dirección se trata como «todas». Un 404 por una
    letra de más en un parámetro de filtro es una respuesta desproporcionada a
    algo que se arregla enseñando la lista.
- **Al pulsar, un modal ancho.** No el panel lateral de 600 px que usa el resto
  del área: dentro puede haber un informe entero, y un informe en 600 px se lee
  a tres palabras por línea. Con su ruta propia, así que recargar o pegar la
  dirección reconstruye lo mismo —listado detrás, modal encima— en vez de
  cambiar de pantalla.

El **Inicio** deja de contestar «¿cuándo es lo próximo?» —ya no hay fechas— y
pasa a contestar: cuántos usos me quedan, cuántas evaluaciones están sin
responder, cuántos informes hay sin abrir.

### 6.2 Profesional

| Sección       | Ruta                        | Qué es                                      |
| ------------- | --------------------------- | ------------------------------------------- |
| Solicitudes   | `/profesional/solicitudes`  | **Bandeja de compras de usos**, no de citas |
| Empresas      | `/profesional/empresas`     | Con saldo y consumo por empresa             |
| Evaluaciones  | `/profesional/evaluaciones` | Las que llegan. Revisar y corregir informes |
| Configuración | `/profesional/consulta`     | Solo la ventana de cada prueba              |

**Se retiran** `/profesional/agenda/*`, `/profesional/citas/*`,
`/profesional/pacientes/*`, y el organizador del día.

El profesional **ya no habilita exámenes ni asigna evaluaciones**: la empresa
las encarga sola contra su saldo. Lo que le queda es autorizar compras y
corregir informes que salieron solos.

#### La configuración se queda en un solo ajuste

Esa pantalla era la de las reglas de la agenda: anticipación mínima, duración
del bloque, jornada, pausa y días laborables. Sin citas, ninguna gobierna nada
— y un ajuste que no cambia el comportamiento de nada es peor que ninguno,
porque alguien lo toca creyendo que sirve.

Lo que sí hay que poder decidir es **cuánto dura una prueba**. Y no cuánto se
tarda en empezarla, sino cuánto tiempo hay para **terminarla una vez
empezada**. Es una condición de aplicación del instrumento: una psicotécnica
respondida a lo largo de tres semanas, consultando y comparando, no mide lo que
dice medir.

**Dos plazos que no se deben confundir**, y la pantalla lo dice arriba porque
es lo único que se puede entender mal ahí, y de forma cara —quien crea que fija
el plazo para empezar pondría treinta minutos y dejaría fuera a todo el mundo—:

| Plazo             | Dónde vive                          | Cuenta desde        | Alcance          |
| ----------------- | ----------------------------------- | ------------------- | ---------------- |
| Para **empezar**  | `clinic_settings.dias_para_empezar` | El envío del correo | Toda la consulta |
| Para **terminar** | `assessments.ventana_minutos`       | `started_at`        | Cada instrumento |

**Por qué uno es global y el otro no.** No es simetría mal resuelta: la ventana
para terminar es una condición de aplicación del instrumento y cambia de una
prueba a otra; el plazo para empezar mide cuánto tarda una empresa en sentar a
su gente delante de una pantalla, y eso no depende de qué prueba sea.

**Cambiar el plazo no toca los enlaces ya emitidos.** `expires_at` se estampa
al crear cada evaluación, así que solo afecta a las siguientes. Acortarlo no
debe cerrarle el enlace a quien ya lo tiene en su correo con una fecha
prometida, y el mensaje de guardado lo dice: es la pregunta inmediata de quien
acaba de bajarlo de treinta días a siete.

**Y el correo dejó de mentir.** Decía «caduca en 30 días» escrito a mano; en
cuanto el plazo pasó a ser configurable, esa frase era una mentira esperando a
ocurrir. Ahora `solicitar_evaluacion` devuelve la fecha que acaba de estampar y
el correo la escribe —«tienes hasta el …»— en la zona horaria de la empresa que
convoca, porque la de quien responde no se conoce: no tiene cuenta.

- **La ventana, por instrumento**: hoy hay una prueba y mañana puede haber tres
  con duraciones distintas. La pantalla dibuja un formulario por prueba activa,
  y el ajuste global va encima — debajo de una lista que puede crecer,
  parecería pertenecer a la última prueba de la lista.
- **Nace en nulo** —sin límite—. Poner un valor por defecto al desplegar
  cerraría de golpe las pruebas que estuvieran a medias, sin que nadie lo
  hubiera decidido y sin que la persona pudiera hacer nada.
- **Entre 5 minutos y 24 horas.** Por debajo no cabe ningún instrumento del
  catálogo; por encima ya no es una ventana, y para eso está el nulo.
- **Solo cuenta si ya se empezó.** Quien recibió el correo ayer y no lo ha
  abierto no debe encontrárselo cerrado. Es el error que más daño habría hecho
  y tiene su prueba.

**Rechazar y marcar están separados, y es obligatorio que lo estén.** En
`plpgsql`, una función que lanza una excepción deshace todo lo que escribió
antes: la primera versión marcaba `vencida` y acto seguido rechazaba, y el
`update` se perdía en silencio. Así que el camino de **actuar**
(`asignacion_de_pase`) rechaza, y el de **leer** (`evaluacion_de_pase`, lo que
pinta la pantalla) es quien deja constancia. Quien abre su enlace pasado el
tiempo hace las dos cosas en el mismo gesto.

La regla general que sale de ahí, y que vale para todo el esquema: _o escribes,
o rechazas; no las dos_.

### 6.3 Rutas que desaparecen del todo

```
/panel                      /calendario/*            /solicitar-cita
/mis-datos/*                /resultados              /evaluacion/*  (área paciente)
/empresa/personas/*         /empresa/sesiones/*
/profesional/agenda/*       /profesional/citas/*     /profesional/pacientes/*
/invitacion/[token]         (nadie crea cuentas por invitación)
/consentimiento             (el de tratamiento individual)
```

Cada una responde **404**, no una redirección silenciosa: un enlace viejo que
te lleva a otro sitio sin decírtelo es peor que uno que dice que no está.

---

## 7. El consentimiento

### 7.1 Sí se pide, y antes de cada evaluación

Ya está construido y no se toca: `/prueba/[token]` enseña el documento antes
del ejecutor, y `consentir_con_pase` registra la decisión **con su versión y su
evaluación**. No es un consentimiento de plataforma que se firma una vez: es
uno por evaluación, y quien responda dos pruebas para dos empresas lo firma dos
veces.

Con el rol `paciente` fuera, **es el único consentimiento que queda en el
producto**. El circuito de `/consentimiento` —el de tratamiento individual, que
bloqueaba la entrada al área del paciente— se retira con ella.

### 7.2 El texto se reescribió entero, no se retocó

`SECCIONES_CONSENTIMIENTO` estaba escrito para un paciente de la consulta.
Hablaba de «tus citas», «tu profesional», «Mis datos», «solicitar la
eliminación de tu cuenta» y «agendar citas, avisarte de cambios». Después de
este giro, **nada de eso existe** para quien lo firma: no tiene citas, no tiene
profesional asignado, no tiene «Mis datos» y no tiene cuenta que eliminar.

**Y arrastraba un problema peor, que solo se ve leyendo las dos pantallas
juntas.** El texto que de verdad leía quien respondía estaba **escrito a mano
dentro de `consentimiento.tsx`**, mientras la versión que se guardaba como
evidencia salía de `consentimiento.ts`, cuyo texto era otro. Se registraba
haber aceptado una redacción que esa persona no había visto nunca — y el punto
entero de versionar un consentimiento es poder demostrar qué se aceptó. Ahora
hay un solo texto y las dos pantallas lo leen del mismo sitio.

El documento es una **función** y no una constante, porque el primer apartado
nombra a quien encarga: «te evalúan por encargo de alguien» sin decir quién
informa a medias. Que lleve un hueco no rompe la evidencia — la versión
identifica la redacción y la evaluación identifica a la empresa, y las dos
quedan en la misma fila de `consents`.

Un consentimiento que describe un procedimiento que no ocurre no informa de
nada — es el mismo motivo por el que ya se subió dos veces la versión. Se
reescribe entero, sobre el único supuesto que queda: **te evalúan por encargo
de una empresa, no eres usuario de esta plataforma.**

### 7.3 Lo que el documento nuevo tiene que decir

Diez apartados. Los tres marcados son los que hoy no dice y hay que añadir.

1. **Quién te evalúa y por encargo de quién.** Nombre de la empresa, en el
   texto, no en una plantilla genérica.
2. **Qué se te va a pedir.** Responder un instrumento; cuánto dura; que no hay
   respuestas correctas.
3. **Qué datos se guardan.** Tu nombre y correo, el documento si la empresa lo
   aportó, tus respuestas, los resultados calculados y el informe.
4. **▶ Que se conservan para revisiones posteriores.** Sin plazo vago: el
   informe queda archivado y la empresa puede volver a consultarlo meses o años
   después. Se dice cuánto tiempo y por qué —la retención de historia clínica
   ya está en el texto actual y se conserva—.
5. **Quién recibe el informe.** La empresa que lo encargó, completo, de forma
   automática al terminar y sin revisión previa de un profesional. Después
   puede corregirse.
6. **▶ Que tu copia se te muestra UNA VEZ, al terminar, y que ahí se acaba.**
   Con estas palabras: guárdalo o imprímelo en ese momento, porque tu enlace
   queda cerrado y no hay forma de volver a abrirlo. Si lo pierdes, tendrás que
   pedírselo a la empresa. Es la contrapartida de que ese enlace no sea una
   llave permanente a tus resultados (§8.4), y decirlo después de que ocurra no
   es informar.
7. **▶ Que la empresa queda obligada a custodiarlo.** Desde que lo recibe, es
   ella quien responde de ese informe: no puede difundirlo fuera de su proceso
   de selección o gestión, ni usarlo para otra finalidad, y debe protegerlo. Ver
   la advertencia de §7.4 — decirlo aquí no basta.
8. **Qué NO sale de la consulta.** Tu hoja de respuestas. La empresa recibe el
   informe, nunca qué marcaste en cada pregunta.
9. **Que no tienes cuenta aquí.** Tu enlace es tu único acceso. Se dice
   explícitamente para que nadie busque una contraseña que no existe.
10. **Puedes negarte, y a quién escribir.** Sin consentimiento no se te evalúa
    —eso ya lo dice el correo de convocatoria— y los datos de contacto del
    responsable para ejercer acceso, corrección o supresión.

**La versión se subió** a `2026-08-23`. La regla del archivo es explícita —«no
edites el texto sin subir la versión»— y aquí no era un formalismo: nadie había
aceptado esta redacción.

### 7.4 La obligación de la empresa no se crea en el consentimiento de la persona

Es la trampa de este apartado y conviene no caer en ella. El consentimiento es
un documento entre **la persona y la consulta**. Escribir ahí «la empresa debe
custodiar tus resultados» informa a quien no puede hacer nada al respecto y no
obliga a quien sí.

Para que la obligación exista de verdad hace falta que la empresa la acepte
**en su lado**, y son tres sitios:

- **Una pantalla bloqueante**, `/condiciones`, antes de entrar a su área.
  Pantalla propia y no una casilla al pie de nada, por el mismo motivo que el
  consentimiento de la persona: lo que se acepta incluye responder de un dato
  sensible de alguien que no está en la sala. Queda en `consents` con su
  versión, su fecha, su IP y su agente — la misma tabla y la misma evidencia.
- **En el alta de empresa** (§2.1), cuando exista: una casilla más en el mismo
  formulario. La pantalla bloqueante seguirá haciendo falta para las cuentas ya
  creadas y para cada vez que se suba la versión.
- **En cada correo de informe** (§8.2), como recordatorio de una línea. No crea
  la obligación; la mantiene a la vista de quien abre el documento, que es el
  momento en que importa. Una obligación firmada hace seis meses y no repetida
  nunca es una obligación que nadie recuerda tener.

**El ingreso manda a la pantalla, además del middleware.** El middleware es la
barrera de verdad —cubre llegar por cualquier otro camino— pero si el rebote
ocurriera solo ahí, la navegación sería del enrutador de React: pinta las
condiciones y deja la barra de direcciones diciendo otra cosa. Se vio en la
prueba de extremo a extremo, con la pantalla correcta y la URL equivocada. Es
el mismo motivo por el que el consentimiento del paciente ya se resolvía en el
ingreso.

En el consentimiento de la persona se dice lo que le corresponde saber: _que la
empresa asume esa responsabilidad desde que recibe el informe_. Eso es
informarla con exactitud. Prometerle que la plataforma lo garantiza sería
mentirle: una vez enviado, lo que la empresa haga con ese PDF no lo controla
nadie desde aquí.

## 8. Correo

Tres correos sostienen el circuito, y ninguna regla de confidencialidad se
toca: **el informe nunca viaja dentro de un correo**, y ningún asunto dice de
qué va la prueba.

### 8.1 La convocatoria → a la persona

`invitacionEvaluacion` deja de llevar bloque de cita —no hay fecha— y pasa a
llevar: quién convoca, el botón al enlace, y **el QR como adjunto en línea
(`cid:`)**. No como `data:` URI: Gmail y Outlook bloquean las imágenes en
base64 embebidas en el `src`, y el QR es justo lo que hay que poder escanear
desde el teléfono sin pulsar nada.

### 8.2 El informe → a la empresa

`informeListo` ya existe, ya sale del cierre automático y ya apunta a
`/empresa/informes/[id]`. Gana **una línea**: el recordatorio de que desde que
recibe ese informe es la empresa quien responde de su custodia (§7.4).

### 8.3 A la persona no se le manda ningún informe · **decisión revisada**

Una versión anterior de este documento proponía un tercer correo con el enlace
a su pase. **Se retira**, y con él la propuesta de §8.4 de que ese pase no
caducara nunca. El motivo es una revisión de seguridad del enlace de acceso, y
está en §8.4.

Su copia la obtiene **en pantalla, al terminar la prueba** (§8.4). No hay
ninguna dirección web que lea ese informe después.

**Lo que se evita con esto.** La objeción de fondo era que la dirección de
correo **la escribe la empresa**, no la persona: en un proceso de selección, la
persona y quien decide sobre ella pueden compartir un buzón corporativo. Sin
correo de informe y sin enlace de lectura, ese buzón deja de ser una vía al
documento.

Queda vivo el efecto de borde de la **convocatoria**, que sí va a esa
dirección: quien lea ese buzón antes que la persona puede hacer la prueba en su
lugar. Eso no tiene arreglo técnico sin cuentas —el enlace tiene que bastar
para entrar— y sí tiene arreglo de producto: el formulario de §3.3 sugiere usar
el correo personal cuando se tenga.

### 8.4 El pase se apaga en cuanto el informe está en pantalla

**Esta sección revierte una decisión anterior mía**, y conviene que quede
escrito por qué: proponía que el pase de lectura no caducara nunca, para que la
persona no perdiera su informe. Eso convierte un enlace al portador en una
credencial permanente a un perfil psicológico con nombre y apellidos.

**Lo que el enlace pone en riesgo no es responder, es leer.** Responder ya está
cerrado por ESTADO: `asignacion_de_pase` solo resuelve evaluaciones en
`asignada` o `en_curso`, así que una prueba enviada no se puede volver a
contestar aunque el enlace circule. Lo que seguía abriendo era el informe, para
siempre y para cualquiera que lo tuviera: el correo reenviado, el QR impreso
que quedó sobre una mesa, el historial de un navegador compartido.

Y había un agravante que no se vio en su momento. La migración 0013 escribió
como principio que el testigo **nunca** se guarda en claro; la 0037 lo revirtió
—añadió la columna `token`— para que la empresa pudiera reenseñar el mismo QR.
Lo único que borraba ese texto en claro era `aceptar_invitacion`, la vía de
crear cuenta, **que en el modelo nuevo ya no existe**. El testigo pasó a vivir
hasta su caducidad, y con él la llave del informe en una tabla de la base.

**Cómo queda:**

1. Al enviar la prueba, el servidor califica, publica, avisa a la empresa y
   **enseña el informe en la misma pantalla**.
2. Con el informe ya delante, apaga el pase: `token` a nulo y `usado_at`
   marcado. A partir de ahí el enlace no abre nada, ni la prueba ni el informe,
   con su propio mensaje —«este enlace ya se usó»— y no con el de vencido, que
   llevaría a pedirle a la empresa uno nuevo que no existe.
3. El informe se lee **por identificador y no por testigo** (`informe_publicado`,
   solo para el servidor). Es lo que permite enseñárselo sin que el enlace
   vuelva a viajar, y por tanto lo que permite apagarlo en el mismo gesto.

**Se apaga después de tener el informe, no al recibir las respuestas.** El
cierre automático está escrito para no lanzar nunca; si el motor falla, apagar
el pase al enviar dejaría a la persona con la prueba respondida, sin informe y
sin enlace por el que volver. Cerrándolo cuando el informe ya está en pantalla,
ese fallo se degrada a lo tolerable: el pase sigue vivo y puede volver más
tarde.

**El precio, dicho sin adornos:** si cierra la pestaña sin guardarlo, no hay
forma de recuperarlo desde la plataforma. Tiene que pedírselo a la empresa. La
pantalla lo advierte **encima** del informe, no debajo, y el consentimiento lo
dice antes de empezar (§7.3).

### 8.5 Lo que se retira y lo que se añade

**Se retiran** `citaConfirmada`, `citaRechazada`, `citaCancelada`,
`recordatorio`, `sesionConfirmada`, `sesionRechazada`, `sesionCancelada`,
`nuevaSolicitud`, y la ruta `/api/tareas/recordatorios`.

**Se añade** el aviso de resolución de compra: usos autorizados o rechazados,
con su motivo, a la dirección de contacto de la empresa.

---

## 9. Lo que este giro deja sin resolver

Se dice aquí para que no parezca olvido.

1. **El pago sigue fuera.** No hay pasarela, no hay factura, no hay recibo. La
   plataforma registra que el profesional dijo «cobrado» y quién lo dijo. Es lo
   pedido, y es una decisión de negocio, no una limitación técnica.
2. **Un solo instrumento.** El catálogo tiene DISC y nada más. El selector de
   prueba se dibuja igual, con una opción, porque el día que haya dos no se
   rehace la pantalla.
3. **No hay envío por tandas.** El encargo describe una persona por vez. Con
   cuarenta candidatos eso son cuarenta formularios. La carga masiva (pegar una
   lista de correos, gastar N usos de golpe) es la primera ampliación evidente y
   no entra aquí.
4. **El informe sale sin firma humana.** Ya era así desde `cierre-automatico`,
   y el giro lo consolida: el profesional corrige después, si quiere. Queda
   escrito en `results.released_automatically` cuál salió solo.
5. **La empresa ve el informe completo.** No hay versión reducida para
   contratante. Es como está construido y este documento no lo cambia.
6. **Quien no guarde su informe al terminar, lo pierde.** No hay identidad
   contra la que autenticarlo, así que no hay recuperación posible: tiene que
   pedírselo a la empresa o ejercer acceso por el canal de habeas data. Es la
   contrapartida directa de cerrar el pase (§8.4) y de no registrar a nadie.
   6c. **Una evaluación abandonada solo se marca vencida cuando alguien la mira.**
   Si nadie vuelve a abrir el enlace, nadie ejecuta la comprobación de la
   ventana y la empresa la sigue viendo como «Respondiendo». El estado real se
   corrige en cuanto alguien la abre; cerrar el hueco del todo pide un barrido
   periódico que hoy no existe.
   6b. **Un residuo del camino de fallo.** Si el motor no llega a publicar, el pase
   se queda vivo a propósito, y si el profesional califica a mano días después,
   ese enlace volverá a abrir el informe sin apagarse. Es raro y es el mal menor
   frente a dejar a alguien sin ninguna vía; queda anotado para cerrarlo cuando
   el cierre manual tenga su propio gesto.
7. **La custodia por parte de la empresa no es verificable.** Se le exige al
   aceptar las condiciones y se le recuerda en cada informe (§7.4). Lo que haga
   después con el documento no lo ve nadie desde aquí. Es una obligación
   contractual, no un control técnico, y el documento no debe sugerir lo
   contrario.
