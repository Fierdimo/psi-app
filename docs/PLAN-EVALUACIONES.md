# Psi — Evaluaciones por usos · Plan técnico

> **Acompaña a** `SPEC-EVALUACIONES.md`. Ese dice qué; este dice en qué orden y
> tocando qué.
> **Fecha:** 2026-08-23 · **Estado:** propuesta

---

## 1. Principio de orden

**Primero se construye lo nuevo, después se retira lo viejo.** El orden
contrario deja la aplicación sin área de empresa funcional durante varias fases,
y con ella sin forma de probar nada de extremo a extremo.

Concretamente: F1–F4 añaden el circuito completo de usos y evaluación
descartable **junto a** lo que ya existe. Solo en F5 se corta el calendario, y
para entonces hay un camino alternativo probado.

Cada fase deja el árbol con `pnpm check` en verde. No hay fase que dependa de
que la siguiente «arregle» algo.

---

## 2. Fases

### F1 · La base de usos — S (1–2 días) · **HECHA**

Todo en SQL. Ninguna pantalla todavía.

**Migración `..._usos_de_evaluacion.sql`**

- `create type ticket_order_status as enum ('solicitada','autorizada','rechazada')`
- `create type ticket_movement_kind as enum ('carga','consumo')`
- `create table ticket_orders`, `create table ticket_ledger` (§4.1 del SPEC)
- Índices: `ticket_orders (organization_id, created_at desc)`,
  `ticket_ledger (organization_id)`, y un índice único parcial
  `una_solicitud_pendiente_por_empresa on ticket_orders (organization_id) where status = 'solicitada'`
  — mismo patrón que `una_solicitud_pendiente_por_paciente` en 0002.
- RLS: lectura por `mi_organizacion()` y por `is_professional()`. Sin escritura
  por API.
- Funciones: `solicitar_usos`, `autorizar_usos`, `rechazar_usos`,
  `saldo_de_usos`.

**Prueba `supabase/tests/usos.test.sql`**

Lo que hay que dejar probado, porque es donde vive el dinero:

1. Una empresa no ve las solicitudes de otra.
2. Una empresa no puede autorizarse usos a sí misma.
3. Autorizar dos veces la misma orden no carga el saldo dos veces.
4. Rechazar no toca el saldo.
5. `saldo_de_usos` de una empresa sin movimientos es 0, no null.

**Archivos:** solo `supabase/`. Cero TypeScript.

**Lo entregado:** `20260823090000_usos_de_evaluacion.sql` y `usos.test.sql`
(27 comprobaciones, en verde). Dos cosas se añadieron sobre lo planeado, las
dos por el mismo motivo —que una comprobación en código puede romperse y una
restricción de la base no—:

- `ticket_ledger_una_carga_por_orden`, índice único parcial sobre `order_id`:
  la última defensa contra la doble autorización, por debajo del candado.
- `movimiento_con_causa`, un check que obliga a que toda carga apunte a su
  orden y todo consumo a su evaluación. Un movimiento sin causa es un
  descuadre que nadie podrá explicar seis meses después.

---

### F2 · La evaluación descartable — M (3–4 días) · **HECHA**

**Migración `..._la_evaluacion_lleva_su_pase.sql`**

> **CORRECCIÓN DE SECUENCIA, hecha al implementar.** Esta fase se había
> planeado con los `drop column` dentro, y eso violaba el principio de §1: son
> destructivos, y sus lectores —`editar_persona`, `pase_de_persona`,
> `reparto_de_sesion`, `aceptar_invitacion`— siguen vivos con pantallas encima
> hasta F5. **F2 no borra nada.** Solo relaja, añade y sustituye. Los
> `drop column` se movieron a **F5.6**, después de que caigan sus pantallas.

_Relajar la ficha:_

- `alter table organization_people alter column documento drop not null`
- `drop constraint una_vez_por_empresa`
- `documento_no_vacio` **se conserva**: un check sobre una columna nula se
  salta —`btrim(null) <> ''` es null, y un check solo falla con false—, así que
  sigue admitiendo «sin documento» y rechazando «documento en blanco», que es
  exactamente lo que hace falta. Un `drop` habría sido churn sin efecto.

_El pase, de la evaluación:_

- `alter table invitations add column assignment_id uuid references assignments (id) on delete cascade`
- `create index invitations_assignment_idx on invitations (assignment_id) where assignment_id is not null`
- `create or replace function asignacion_de_pase(text)` → resuelve por
  `assignment_id` cuando lo hay, y conserva el camino por cita para los pases ya
  emitidos. **Los dos caminos conviven**: hay invitaciones vivas en la base con
  `appointment_id` y sin `assignment_id`, y vencen solas en 30 días.
- `create function solicitar_evaluacion(...)` — la central. Con el
  `select ... for update` sobre `organizations`.
- `create function pase_de_evaluacion(p_assignment uuid)`

_Comprobar antes de tocar:_ `evaluacion_de_pase`, `informe_de_pase` y
`pases_de_acceso` hacen `join organization_people`. Ninguna lee las columnas que
se van, pero conviene correr `supabase test db` entero, no solo el archivo
nuevo.

#### Lo que apareció al implementar: `cargar_personas`

Quitar `una_vez_por_empresa` rompió **ocho archivos de pruebas** a la primera
llamada. `cargar_personas` hacía
`on conflict (organization_id, documento) do update`, y sin esa restricción
Postgres responde «there is no unique or exclusion constraint matching the ON
CONFLICT specification».

Se resolvió sustituyendo la función por una que inserta en vez de refundir —lo
mínimo para que la pantalla vieja siga en pie hasta F5—. El cambio de
comportamiento es real y se acepta: cargar dos veces el mismo documento ya no
corrige la ficha anterior, crea otra. Es justo lo que el modelo nuevo quiere.

Con ello cayeron cuatro afirmaciones de pruebas heredadas, y **no se
debilitaron: se movieron**. Las tres del upsert en `circuito_corporativo` se
retiraron con su explicación —ese archivo prueba el circuito de la sesión, y
una ficha repetida vuelve ambiguas sus fixtures— y la del duplicado en
`organizaciones` se invirtió para afirmar la regla nueva. La cobertura de «la
misma persona, dos veces, en la misma empresa» vive ahora en
`evaluacion_descartable.test.sql`, que es donde le corresponde.

#### Por qué `drop column profile_id` no es una línea — **esto es F5.6**

Trece sitios de la base tocan esa columna, y Postgres **solo protege de la
mitad**. Las políticas RLS y los índices son dependencias registradas: el
`drop` falla, o los arrastra si se pone `cascade`. Los cuerpos de las funciones
`plpgsql` **no lo son** — Postgres no los analiza al crearlas. Una función que
lee `op.profile_id` sobrevive al `drop column`, compila, y revienta el día que
alguien la llama. Es el peor de los dos fallos posibles y es el que sale gratis.

Por eso van explícitas en la migración, no por `cascade`:

_Políticas y funciones que se retiran (todas son de la era del calendario):_

- `policy "persona: se ve a si misma"` sobre `organization_people`
- `policy "convocado: se ve a si mismo"` sobre `appointment_attendees`
- `policy "convocado: ve las citas a las que asiste"` sobre `appointments`
- `function soy_esta_persona(uuid)` · `function asisto_a_cita(uuid)`
- `index organization_people_profile_idx`

_Funciones que hay que reescribir porque leen la columna y siguen vivas:_

- `editar_persona` (0026) — resuelve el dueño por `profile_id`
- `personas_del_reparto` / lo que sobreviva de `reparto_completo` (0038)

_Ya superadas por versiones posteriores, comprobar y no tocar:_
`mi_asignacion`, `preparar_invitaciones`, `pases_de_acceso`. Las tres tienen
una versión más reciente que ya no lee la columna.

La forma de no fallar aquí: `grep -rn "profile_id" supabase/migrations/`, y de
cada resultado averiguar si esa función es la última versión o una superada. La
última versión de cada nombre es la que manda.

**Prueba `supabase/tests/evaluacion_descartable.test.sql`** — 25
comprobaciones, en verde. Cubre lo planeado: el fallo sin saldo que no deja
rastro (ni ficha, ni evaluación, ni pase), el agotamiento del saldo, la misma
persona dos veces en la misma empresa, el documento que no bloquea nada, el
pase que resuelve a su evaluación y no a otra, y el consumo del libro apuntando
a la evaluación que lo causó.

**Un detalle de las pruebas que conviene no volver a descubrir:** `invitations`
no tiene ni política de lectura ni grant, a propósito. Contar pases desde el
papel de la empresa no da cero, da «permission denied». La regla en este
archivo es: se **actúa** con el rol de quien actuaría, se **inspecciona** con el
del servidor.

**Archivos:** `supabase/`.

---

### F3 · El área de empresa nueva — L (4–5 días) · **HECHA**

Aquí entra el TypeScript.

**Acciones — `src/lib/usos/acciones.ts`** (nuevo)

- `solicitarUsos` → `rpc('solicitar_usos')`
- `pedirEvaluacion` → `rpc('solicitar_evaluacion')`, y con el token que devuelve:
  arma el enlace con `origenDeLaPeticion()`, genera el QR y envía el correo.
  **El fallo del correo no revierte la evaluación**: el uso ya se gastó y la
  empresa tiene el enlace en pantalla. Se avisa y se ofrece reenviar.
- `reenviarPase` → `rpc('pase_de_evaluacion')` + correo.

**Pantallas**

| Ruta                          | Qué lleva                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- |
| `/empresa` (reescrita)        | Saldo, evaluaciones sin responder, informes nuevos                        |
| `/empresa/usos`               | Saldo grande, historial de compras con su estado, formulario de solicitud |
| `/empresa/evaluaciones`       | Listado paginado: persona, prueba, estado, fecha                          |
| `/empresa/evaluaciones/nueva` | El formulario de dos campos. Bloqueado si saldo = 0                       |
| `/empresa/evaluaciones/[id]`  | Estado, enlace, QR, reenviar                                              |

**Componentes reutilizados sin tocar:** `EnlacesDeAcceso` (ya genera el QR),
`Paginacion`, `EstadoVacio`, todo `ui/`.

**Navegación:** `SECCIONES_EMPRESA` en `src/components/navegacion/secciones.ts`
pasa a Inicio · Evaluaciones · Informes · Usos · Datos.

**Correo:** `invitacionEvaluacion` reescrita sin `DatosCita` y con el QR como
adjunto `cid:`. `enviarCorreo` necesita aceptar adjuntos — hoy no los pasa;
`nodemailer` sí los soporta, es un parámetro más.

**Archivos:** `src/lib/usos/`, `src/app/empresa/**`, `src/components/empresa/**`,
`src/lib/correo/plantillas.ts`, `src/lib/correo/enviar.ts`,
`src/components/navegacion/secciones.ts`.

---

### F4 · La bandeja del profesional — S (1–2 días) · **HECHA**

- `/profesional/solicitudes` deja de leer `appointments` y pasa a leer
  `ticket_orders`. Cada fila: empresa, cantidad, nota, contacto, y dos botones.
- `src/lib/usos/acciones-profesional.ts`: `autorizarUsos`, `rechazarUsos`, cada
  una con su aviso por correo a la empresa.
- `/profesional/empresas` gana dos columnas: saldo y usos consumidos.
- `SECCIONES_PROFESIONAL` se queda en Solicitudes · Empresas · Evaluaciones ·
  Configuración.

**A partir de aquí el circuito nuevo está completo y se puede recorrer entero.**

**Y se recorre:** `e2e/usos.spec.ts`, cinco pruebas en verde, incluida la
comprobación de que el correo llega a Mailpit con el QR como adjunto en línea
—lo único de todo esto que ninguna prueba de SQL puede cubrir y donde el QR se
rompería en silencio—.

#### Tres cosas que solo aparecieron al ejecutarlo

1. **El acuse de recibo se lo comía la revalidación.** Al solicitar usos, la
   acción revalida y la pantalla vuelve con el formulario sustituido por el
   aviso de «ya tienes una pendiente»: el mensaje de éxito no llegaba a verse
   nunca. La salida no fue guardar el mensaje en algún sitio, sino que ese
   aviso sirva para los dos momentos —acabar de enviarla y volver mañana—.
2. **`service_role` no podía limpiar las tablas nuevas**, así que la
   preparación de las pruebas fallaba en silencio y la segunda ejecución
   arrancaba sucia. Se añadieron los `grant` a `seed.sql`, con el orden de
   borrado que impone `on delete restrict`.
3. **`saldo_de_usos` le dice que no a la clave de servicio**, porque no es la
   empresa dueña ni el profesional. Está bien que se niegue; la prueba suma el
   libro en vez de darle permisos de más.

---

### F4a · El pase deja de ser una llave permanente — S (1 día) · **HECHA**

Fuera del plan original, a raíz de una pregunta que resultó estar bien puesta:
qué ve alguien que solo tiene la dirección `/prueba/<testigo>`.

**Lo que se encontró.** No un problema de entropía —son 244 bits, no se
adivina— sino tres cosas peores:

1. El testigo estaba **guardado en claro** en `invitations.token`. La migración
   0013 lo prohibió como principio; la 0037 lo revirtió para poder reenseñar el
   QR, y lo único que lo borraba era `aceptar_invitacion` — la vía de crear
   cuenta, **que este giro elimina**. Sin ese borrado, vivía hasta caducar.
2. El mismo enlace que respondía la prueba **leía el informe después**, para
   siempre y para cualquiera que lo tuviera.
3. **SPEC §8.4 lo empeoraba**: proponía que el pase de lectura no caducara
   nunca. Retirado.

**Lo hecho** (`20260823110000_el_pase_muere_al_responder.sql`): al enviar la
prueba, el servidor califica, publica, avisa a la empresa y **enseña el informe
en la misma pantalla**; con el informe ya delante, apaga el pase —`token` a
nulo y `usado_at` marcado—. El informe se lee **por identificador y no por
testigo** (`informe_publicado`, solo para el servidor), que es lo que permite
enseñarlo sin que el enlace vuelva a viajar.

**Tres detalles que decidieron la forma:**

- **Se apaga después de tener el informe, no al enviar.** El cierre automático
  no lanza nunca; si el motor falla, apagarlo antes dejaría a la persona sin
  informe y sin enlace. Responder ya está cerrado por ESTADO, no por testigo.
- **Sin `revalidatePath`.** Revalidar repintaría la página del servidor, que
  resuelve por testigo — y el testigo acaba de morir. La persona vería «este
  enlace ya se usó» en lugar de su informe.
- **`cerrar_pase` tenía un agujero por la forma del dato.** Cerraba por
  `assignment_id` y dejaba vivos los pases heredados, que se atan por
  convocatoria. Un control de seguridad con un hueco que depende de la forma
  del dato es peor que no tenerlo, porque parece que está. Lo destapó el
  circuito de extremo a extremo, cuyo fixture usa justamente esa forma.

**Consecuencia sobre F4b:** el tercer correo —el informe a la persona— **se
cae**. Su copia es la que imprime al terminar, y el consentimiento tiene que
decirlo antes de empezar, no después.

---

### F4b · Consentimiento y condiciones de la empresa — M (2–3 días) · **HECHA**

Va aquí, después de que el circuito funcione y **antes** del corte: el
documento nuevo describe el sistema nuevo, así que no puede escribirse antes de
que exista, y no puede desplegarse después de retirar el viejo sin dejar un
hueco en el que alguien firma un texto falso.

**Migración `..._el_informe_no_vence.sql`**

- `create or replace function asignacion_visible_de_pase(text)` → no comprueba
  `expires_at` cuando la evaluación está `publicada`. Responder mantiene su
  plazo; leer el propio informe deja de tenerlo (SPEC §8.4).
- Prueba en `evaluacion_descartable.test.sql`: con un pase vencido, responder
  falla y **leer el informe publicado funciona**. Es la pareja entera, no una
  de las dos.

**`src/lib/consentimiento.ts` — reescritura completa**

`SECCIONES_CONSENTIMIENTO` se sustituye por los diez apartados de SPEC §7.3. No
es una edición: el documento actual está escrito para un paciente de la
consulta y después del giro no le corresponde a nadie. **Se sube la versión** —
la regla está escrita en el propio archivo.

El componente `Consentimiento` necesita recibir **el nombre de la empresa**:
hoy pinta un texto genérico y el apartado 1 exige decir quién encarga.
`evaluacion_de_pase` ya lo devuelve (`empresa`), así que es pasarlo.

**Condiciones de uso de la empresa — nuevo**

- `src/lib/condiciones-empresa.ts`, con su propia `document_key` y su versión.
  Incluye la obligación de custodia de SPEC §7.4.
- Casilla en el alta de empresa (F5.1). Sin aceptar, no hay organización.
- Se registra en `consents`, que ya sirve: es una fila con otra clave.

**Tercer correo**

- `informeParaLaPersona` en `plantillas.ts`: enlace a su pase, nunca el
  informe. Asunto neutro, como los demás.
- `cierre-automatico.ts` pasa a enviar **dos** correos. Con la misma regla que
  ya tiene: **nunca lanza**. Si falla el de la persona, el de la empresa tiene
  que salir igual, y al revés — dos `try` separados, no uno que envuelva los
  dos.
- `informeListo` gana la línea de recordatorio de custodia.

**A vigilar:** `cierre-automatico` lee hoy `organization_people` para el nombre;
ahora necesita también el `email`. Está en la misma fila, es un campo más en el
`select`.

---

### F5 · El corte — M (2–3 días)

Ahora sí se retira. En este orden, que no es arbitrario:

**5.0 · El rol `paciente` sale del tipo.**
Migración `..._solo_dos_roles.sql`, con la secuencia de cinco pasos del SPEC
§2.2. Va **la primera** de la fase: el paso 3 falla si queda una fila
`'paciente'`, así que es el que obliga a haber dispuesto antes de esas cuentas.
Con ella caen las políticas y funciones que comparan contra `'paciente'` —
buscar con `grep -rn "paciente" supabase/migrations/` y revisar una por una,
son pocas pero están repartidas.

El defecto de `profiles.role` pasa a `'empresa'`, que es lo que ahora crea
`handle_new_user` para toda cuenta nueva.

**5.1 · El registro pasa a ser de empresa.**
`src/lib/validacion/auth.ts` gana los campos de empresa;
`src/lib/auth/acciones.ts::registrar` los mete en `raw_user_meta_data`;
`src/app/auth/callback/route.ts` llama a `registrar_empresa` en el primer
ingreso; nace `/empresa/alta` como red de seguridad.

**5.2 · El middleware.**
`src/lib/supabase/middleware.ts` + `src/lib/auth/perfil.ts`:
`Rol` pasa a `"profesional" | "empresa"` y `inicioSegunRol` pierde el caso
`paciente` — el compilador señala el resto. Toda cuenta autenticada sin
`organization_id` y sin rol profesional va a `/empresa/alta`. No hace falta
pantalla de «cuenta sin área»: con el enum reescrito, ese estado no puede
existir.

**5.3 · Borrado de rutas.** Las de §6.3 del SPEC. Directorios enteros:
`src/app/(paciente)/`, `src/app/empresa/personas/`, `src/app/empresa/sesiones/`,
`src/app/profesional/(privado)/agenda|citas|pacientes/`,
`src/app/invitacion/`, `src/app/consentimiento/`,
`src/app/api/tareas/recordatorios/`.

**5.3a · El consentimiento viejo.**
`/consentimiento` (el de tratamiento individual), la comprobación en
`src/lib/supabase/middleware.ts`, `tieneConsentimientoVigente`,
`aceptarConsentimiento` y `boton-consentimiento.tsx`. La página pública
`/consentimiento-informado` **se queda**, apuntando al documento nuevo: es donde
la persona puede releer lo que firmó.

**5.3b · Borrado de la maquinaria de invitación a crear cuenta.**
`src/app/invitacion/`, `src/components/auth/aceptar-invitacion.tsx`,
`src/lib/citas/acciones-invitaciones.ts`, y en la base `emitir_invitaciones` y
`aceptar_invitacion`. `invitations` y `preparar_invitaciones` **se quedan**:
siguen emitiendo el pase, que es otra cosa aunque comparta tabla.

**5.4 · Borrado de código huérfano.** `src/components/calendario/` entero,
`src/lib/citas/` entero salvo lo que use el motor de evaluaciones,
`src/components/profesional/organizador-del-dia.tsx`, `convocados.tsx`,
`seguimiento-de-sesiones.tsx`, `formulario-nueva-cita.tsx`,
`formulario-horario.tsx`, `bandeja-solicitudes.tsx`, `acciones-solicitud.tsx`,
`asignar-evaluacion.tsx`, `src/components/citas/pases-de-sesion.tsx`,
`src/components/empresa/formulario-sesion.tsx`, `selector-de-personas.tsx`,
`listado-de-personas.tsx`, `listado-de-sesiones.tsx`, `quitar-persona.tsx`,
`src/lib/correo/avisos.ts`, y las plantillas de cita.

`src/lib/citas/estados.ts` y `jornadas.ts`: comprobar antes de borrar —
`MODALIDAD` lo importa `plantillas.ts` y puede que algo más.

**5.5 · La siembra.** `supabase/seed.sql` deja de crear pacientes, citas y
convocatorias, y pasa a crear: el profesional, una empresa con saldo, una
evaluación pendiente y una evaluación publicada. Los `grant ... to service_role`
de citas se retiran; se añaden los de `ticket_orders` y `ticket_ledger`.

**5.6 · Los `drop column`, ahora sí.**
Movidos aquí desde F2 (ver el aviso de esa fase). Ya sin pantallas encima:
`organization_people.profile_id`, `vinculo`, `cargo`; el tipo `person_link`; el
índice `profiles_documento_unico`; y las políticas y funciones del recuadro de
F2. Aquí entra también
`create unique index una_evaluacion_por_ficha on assignments (person_id) where person_id is not null`,
tras comprobar que no quedan fichas heredadas con dos evaluaciones.

**Nota:** las tablas de citas **no se borran**. Solo se dejan de escribir.

---

### F6 · Pruebas y cierre — M (2–3 días)

**E2E que se borran:** `calendario.spec.ts`, `organizar-dia.spec.ts`,
~~`horario.spec.ts`~~ (ya borrado, ver abajo), `invitaciones.spec.ts`,
`pases.spec.ts`, `perfil.spec.ts`, y lo de citas dentro de
`profesional.spec.ts` y `empresa.spec.ts`.

`horario.spec.ts` **se adelantó**: probaba el formulario de jornada de
`/profesional/consulta`, y esa pantalla se vació al dejar en ella un solo
ajuste. Un archivo de pruebas de una pantalla que ya no existe no se puede
dejar en rojo esperando a esta fase. La función `actualizar_horario` sigue
cubierta por `supabase/tests/horario.test.sql`, así que no se perdió cobertura
de la regla — solo de una pantalla retirada.

**E2E nuevos:**

- `usos.spec.ts` — la empresa pide, el profesional autoriza, el saldo sube.
- `evaluacion-encargada.spec.ts` — el recorrido completo: gastar un uso, abrir
  el enlace en un contexto sin sesión, consentir, responder, y comprobar que el
  informe aparece en `/empresa/informes`. Es la prueba que sustituye a media
  suite.
- `sin-saldo.spec.ts` — con saldo 0 no se puede encargar.
- `consentimiento-de-evaluacion.spec.ts` — el documento nombra a la empresa que
  encarga, y negarse deja la evaluación sin empezar.
- Dentro de `evaluacion-encargada.spec.ts`, el tramo final: **con el pase
  vencido, el informe se sigue abriendo**. Es la garantía de §8.4 y es la que se
  rompe sin darse cuenta al tocar cualquiera de los dos resolutores.

**Se conservan:** `auth.spec.ts` (adaptado al registro de empresa),
`accesibilidad.spec.ts`, `nunca-negro.spec.ts`, `prueba-con-pase.spec.ts`.

**Documentación:** `SPEC.md` y `PLAN.md` reciben una nota de cabecera diciendo
que el calendario está retirado y remitiendo a estos dos documentos. `README.md`
actualiza el recorrido de demostración.

---

## 3. Resumen de esfuerzo

| Fase | Qué                                      | Tamaño    |
| ---- | ---------------------------------------- | --------- |
| F1   | Base de usos (SQL)                       | S · 1–2 d |
| F2   | Evaluación descartable (SQL)             | M · 3–4 d |
| F3   | Área de empresa                          | L · 4–5 d |
| F4   | Bandeja del profesional                  | S · 1–2 d |
| F4a  | El pase deja de ser una llave permanente | S · 1 d   |
| F4b  | Consentimiento y devolución del informe  | M · 2–3 d |
| F5   | El corte                                 | M · 2–3 d |
| F6   | Pruebas y cierre                         | M · 2–3 d |

**Total: 16–23 días.** De ellos, **F1 a F4b están hechas**, más 5.1 y media
5.2 —el registro de empresa y el enrutado de las cuentas sin organización—.

> **F5 y F6 quedan APARCADAS, no terminadas.** Se para aquí por decisión del
> cliente: el circuito nuevo funciona de punta a punta y lo que falta es
> retirada, no construcción. Lo que sigue en pie está inventariado arriba
> —nueve directorios de rutas, `src/components/calendario/`, `src/lib/citas/`,
> el enum con `paciente`, las tres columnas de `organization_people` y cinco
> archivos de pruebas de la era del calendario—.
>
> **Consecuencia que conviene tener presente:** los tres fallos de
> `profesional.spec.ts` que la suite arrastra desde antes de este trabajo viven
> en el calendario y desaparecen con él. Mientras F6 no ocurra, la suite se
> queda en 97 verdes y 3 rojos, y esos 3 no son una regresión.

> **Estado de la suite de extremo a extremo, medido:** 90 en verde, 3 en rojo.
> Las tres son de `profesional.spec.ts`, del circuito de citas, y **ya estaban
> en rojo antes de empezar** — comprobado contra un árbol limpio, sin estas
> migraciones y sin este código. F6 borra ese archivo; arreglarlas ahora sería
> depurar una funcionalidad que se retira en días.
>
> Dos que sí rompió F4 —la navegación del profesional y la bandeja que dejó de
> ser de citas— se corrigieron en el sitio, no se desactivaron. Lo caro no es lo nuevo —el motor de evaluaciones, el
> pase, el QR y el cierre automático ya existen y se aprovechan enteros—: es la
> retirada ordenada de lo que hay.

---

## 4. Riesgos

| Riesgo                                                            | Dónde muerde                                        | Mitigación                                                                                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doble gasto de un uso**                                         | `solicitar_evaluacion` bajo concurrencia            | Candado de fila sobre `organizations`. Probado en F2.                                                                                                                                           |
| **Correo que no sale con el uso ya gastado**                      | F3                                                  | El enlace se enseña en pantalla y hay botón de reenvío. El uso no se devuelve, pero la empresa nunca se queda sin el pase.                                                                      |
| **Cuentas huérfanas sin organización**                            | F5.1, si `registrar_empresa` falla tras el `signUp` | `/empresa/alta` y el middleware que manda ahí. Es la mitad del diseño del alta, no un parche.                                                                                                   |
| **Pases vivos emitidos con el modelo viejo**                      | F2                                                  | `asignacion_de_pase` conserva los dos caminos. Vencen solos a los 30 días.                                                                                                                      |
| **Borrar de más en F5.4**                                         | Compilación                                         | `pnpm typecheck` tras cada directorio, no al final. Y F5 va después de que lo nuevo esté probado, no antes.                                                                                     |
| **Alguien firma un consentimiento que ya no describe el sistema** | Entre F3 y F4b                                      | Por eso F4b va antes del corte y no después. Mientras tanto el circuito nuevo solo se recorre en local.                                                                                         |
| **Quien cierre la pestaña pierde su informe**                     | F4a                                                 | Es el precio aceptado de cerrar el pase. Se avisa ENCIMA del informe, no debajo, y el consentimiento lo dice antes de empezar.                                                                  |
| **La migración del enum encuentra cuentas `paciente` reales**     | F5.0, en producción                                 | Es el diseño, no el fallo: falla en seco y obliga a darlas de baja por habeas data antes. Comprobar `select count(*) from profiles where role = 'paciente'` **antes** de desplegar, no durante. |
| **Fichas heredadas con dos evaluaciones**                         | F2, el índice 1:1                                   | Se comprueba con una consulta antes de crear el índice. Si las hay, el índice se aplaza; nada depende de él.                                                                                    |
| **Función `plpgsql` que lee una columna borrada**                 | F2                                                  | Postgres no lo detecta al borrar: falla en ejecución, meses después. Se retiran y reescriben explícitamente, nunca por `cascade`. Ver el recuadro de F2.                                        |

---

## 5. Primer paso

F1 completa: la migración de `ticket_orders` y `ticket_ledger` con sus cuatro
funciones y `usos.test.sql` en verde. Es autónoma, no toca una sola línea de
TypeScript, y hasta que el libro mayor no cuadre no hay nada más que construir
encima.

**Aparte y en paralelo**, porque no depende de código y sí del criterio de
quien firma la consulta: la redacción de los diez apartados de SPEC §7.3 y de
las condiciones de uso de la empresa. Es lo único del plan que no se puede
resolver programando, y si llega tarde bloquea F4b.
