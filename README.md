# Psi

Portal del paciente para la consulta de un profesional de la psicología:
citas, datos personales y —más adelante— evaluaciones, recursos y documentos.

**Estado: v1 funcionalmente completa.** El circuito está cerrado —el paciente
solicita, el profesional confirma— y la plataforma incluye correo
transaccional, recordatorios, cabeceras de seguridad y auditoría automática de
accesibilidad. Lo que queda antes de producción es despliegue, no producto:
ver «Antes de salir a producción».

---

## Documentación

| Documento                                            | Contenido                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)                       | v0.3 · Diseño y producto: identidad visual, roles, flujos, pantallas  |
| [`docs/PLAN.md`](docs/PLAN.md)                       | v0.2 · Técnico: stack, modelo de datos, seguridad y registro de fases |
| [`docs/design-system.html`](docs/design-system.html) | Versión visual del sistema de diseño. Ábrelo en el navegador          |

Los tres describen **lo construido**, no lo planeado. Donde algo quedó fuera se
dice explícitamente y por qué.

Lee el spec antes de tocar un color, y el plan antes de tocar el esquema.

---

## Qué hace la plataforma

Dos personas la usan y ven cosas distintas.

**El paciente** entra por `/ingresar`, acepta el consentimiento informado una
vez y accede a su calendario: consulta sus citas, propone un horario nuevo,
pide un cambio o cancela. También gestiona sus datos, descarga una copia de
todo lo que la plataforma guarda sobre él y puede solicitar la eliminación de
su cuenta.

**El profesional** entra por `/profesional` —ruta no enlazada desde ninguna
parte— y ve su agenda con la bandeja de solicitudes pendientes. Confirma o
rechaza, agenda citas directamente, cierra las que ya pasaron y consulta la
ficha de cada paciente.

La asimetría es el corazón del producto: **el paciente pide, el profesional
autoriza**. Una cita no existe como compromiso hasta que el profesional la
confirma, y eso lo garantiza la base de datos.

### Mapa de rutas

```
Público      /  ·  /ingresar  ·  /registro  ·  /recuperar
             /privacidad  ·  /terminos  ·  /consentimiento-informado

Paciente     /panel        Próxima cita y accesos
             /calendario   Agenda, mes, semana y día
             /mis-datos    Perfil, cuenta, preferencias y privacidad
             /resultados · /sesiones · /recursos · /documentos   (placeholder)

Profesional  /profesional              Su entrada, sin enlazar
             /profesional/agenda       Bandeja de solicitudes y calendario
             /profesional/pacientes    Listado y fichas
```

---

## Puesta en marcha

### Requisitos

- Node 22+ y pnpm 11+
- Docker y el CLI de Supabase

```bash
brew install supabase/tap/supabase
brew install colima docker docker-compose
```

Se usa **Colima** como runtime de contenedores en lugar de Docker Desktop: no
necesita interfaz gráfica ni permisos de administrador, arranca desde la
terminal y consume bastante menos memoria — que importa en equipos de 8 GB.
El CLI de `docker` es el mismo, así que cualquier comando de Docker funciona
igual. Si prefieres Docker Desktop, `brew install --cask docker` y omite
`colima start`.

Para que `docker compose` encuentre el plugin instalado por Homebrew, añade a
`~/.docker/config.json`:

```json
{ "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"] }
```

### Arranque

```bash
pnpm install
cp .env.example .env.local

# Máquina de contenedores. Solo la primera vez; luego `colima start` a secas.
colima start --cpu 4 --memory 4 --disk 40

# Levanta Postgres, Auth y el resto del stack.
# Al terminar imprime la URL y las claves: cópialas a .env.local
pnpm db:start

# Aplica migraciones y datos de siembra
pnpm db:reset

pnpm dev
```

**En equipos de 8 GB**, levanta solo lo que el proyecto usa. El stack completo
son unos diez contenedores y varios no hacen falta todavía:

```bash
supabase start -x realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor
```

Sin Docker puedes trabajar en la interfaz (`pnpm dev` y `pnpm check`), pero no
en nada que toque datos.

### Verificar que todo funciona

```bash
pnpm check      # formato, lint, tipos, guardia de color y build
pnpm test:rls   # 11 aserciones de Row Level Security
pnpm test:e2e   # 46 pruebas: flujos, circuito completo y accesibilidad (axe)
```

### Cuentas de prueba

Contraseña de todas: `psi-local-2026`

| Correo                 | Rol         | Para qué sirve                                                      |
| ---------------------- | ----------- | ------------------------------------------------------------------- |
| `profesional@psi.test` | Profesional | Jesús Banquez Ramírez. Entra por `/profesional`                     |
| `empresa@psi.test`     | Empresa     | Distribuciones del Caribe. Entra por `/ingresar` y aterriza en `/empresa` |
| `ana@psi.test`         | Paciente    | Tiene una cita confirmada y una realizada. Zona: Bogotá             |
| `beto@psi.test`        | Paciente    | Sin citas. Zona: **Ciudad de México**, para ver el aviso de desfase |
| `carmen@psi.test`      | Paciente    | Reservada a la prueba del consentimiento; no la uses a mano         |

En la primera entrada, cualquier cuenta pasa por el consentimiento informado:
es bloqueante a propósito.

Los correos de verificación y recuperación caen en Mailpit,
en <http://localhost:54324>. Nunca salen a internet. Los transaccionales
—confirmación de cita, recordatorios— no se envían sin `RESEND_API_KEY`: se
registran en la consola del servidor.

---

## Comandos

| Comando             | Qué hace                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo                                                 |
| `pnpm check`        | Formato + lint + tipos + guardia de color + build. **Lo que corre CI** |
| `pnpm check:colors` | Solo la guardia de color                                               |
| `pnpm format`       | Aplica Prettier                                                        |
| `pnpm db:reset`     | Reaplica migraciones y siembra desde cero                              |

---

## Las cinco reglas que no se negocian

### 1. Nunca negro — y se comprueba a la vista, no sobre el papel

No existe `#000`, `black`, `rgba(0,0,0,…)` ni los casi-negros `#111`/`#222` en
ninguna parte. Los tres tonos de texto salen de la **familia azul
institucional**:

|          | Valor     | Contraste       | Azul − rojo |
| -------- | --------- | --------------- | ----------- |
| Títulos  | `#092096` | 12.66 : 1 · AAA | 141         |
| Cuerpo   | `#25378C` | 10.48 : 1 · AAA | 103         |
| Atenuado | `#5E6C9C` | 5.12 : 1 · AA   | 62          |

Hubo dos intentos previos —`#16233A` y `#233657`— con sesgo azul suficiente
para pasar cualquier comprobación automática. Los dos se leían como negro en
pantalla. **Si hay que medir un color para saber que no es negro, la regla no
se está cumpliendo.**

Dos guardias, porque una sola no bastó:

- `pnpm check:colors` revisa el **código fuente** y falla el build ante
  cualquier negro o ante un literal de color fuera de `src/styles/tokens.css`.
  Se exime una línea con `color-guard-ignore` y su justificación, o un archivo
  entero con `color-guard-archivo-exento` (lo usan las plantillas de correo,
  donde no existen las variables CSS).
- `e2e/nunca-negro.spec.ts` revisa el **color calculado** de cada elemento con
  texto visible en trece rutas. Un negro que llega por herencia o por
  especificidad no aparece en el código, y así se coló uno en la raíz del
  documento durante varias fases.

### 2. El color vive en un solo archivo

[`src/styles/tokens.css`](src/styles/tokens.css) es la única fuente de verdad.
Los componentes consumen **roles semánticos** (`text-strong`, `line-interactive`,
`accent`), no la escala cruda. Así el tema oscuro se añade redefiniendo un
bloque, sin tocar un componente.

Los bordes de campos interactivos usan `ink-400` (3.08:1) y no el gris más
suave que se vería mejor: WCAG 1.4.11 exige 3:1 para el límite visual de un
componente interactivo.

### 3. El esquema vive en migraciones

Prohibido crear tablas, columnas o políticas desde el panel web de Supabase.
Todo en `supabase/migrations/*.sql`, revisado como cualquier otro código.

Es lo que mantiene el proyecto portable: migrar de Supabase gestionado a un
VPS es reapuntar tres variables de entorno y correr migraciones.

### 4. El paciente pide, el profesional autoriza

Las citas **no** se modifican con `UPDATE` directo — RLS solo concede `SELECT`.
Toda transición pasa por funciones en Postgres que verifican el rol, validan
que el cambio sea legal desde el estado actual y escriben historial y
auditoría en la misma transacción.

Ninguna acción de un paciente puede producir una cita confirmada, y eso lo
garantiza la base de datos, no el frontend.

### 5. Un correo dice fecha, hora y modalidad. Nada más

Nunca el motivo de consulta, nunca contenido clínico, nunca una palabra que
delate de qué trata la cita — tampoco en el asunto ni en el remitente.

El motivo es concreto: el asunto de un correo aparece en la pantalla de
bloqueo de un teléfono, y ese teléfono puede estar sobre una mesa a la vista de
una pareja, un familiar o un compañero de trabajo. Que alguien esté en
tratamiento psicológico es información sensible por sí sola, aunque no se diga
nada de su contenido.

Las plantillas están en `src/lib/correo/plantillas.ts` y cada correo lleva la
hora en la zona horaria de quien lo recibe.

---

## Estructura

```
docs/                  Spec, plan y sistema de diseño
e2e/                   Pruebas de flujo, accesibilidad y «nunca negro»
scripts/               Guardia de color
src/
  app/
    (publico)/         Landing, legales y demostración del sistema
    (auth)/            Entradas, registro y recuperación
    (paciente)/        Panel, calendario, mis datos y placeholders
    profesional/       Su entrada + (privado)/ con agenda y pacientes
    api/tareas/        Endpoint de recordatorios, protegido por secreto
  components/
    ui/                Componentes base repintados
    calendario/        Vistas de agenda, mes, semana y día
    profesional/       Bandeja de solicitudes y agenda
    navegacion/        Barras lateral, inferior y del profesional
    marca/             Wordmark
  lib/
    citas/             Estados y acciones sobre citas
    correo/            Plantillas y envío transaccional
    fechas/            Luxon y zonas horarias
    supabase/          Clientes de navegador, servidor y administración
    validacion/        Esquemas Zod
  styles/              tokens.css — único origen del color
supabase/
  migrations/          Esquema, RLS y funciones de transición
  tests/               Pruebas de RLS
  seed.sql             Datos ficticios de desarrollo
```

### Dónde está cada cosa

| Si quieres…                                | Mira en                                            |
| ------------------------------------------ | -------------------------------------------------- |
| Cambiar un color                           | `src/styles/tokens.css` — y solo ahí               |
| Entender por qué una cita cambia de estado | `supabase/migrations/*_funciones_citas.sql`        |
| Ajustar quién ve qué                       | Las políticas RLS de las migraciones, no el código |
| Tocar el texto de un correo                | `src/lib/correo/plantillas.ts`                     |
| Añadir una sección al área del paciente    | `src/components/navegacion/secciones.ts`           |

---

## Antes de salir a producción

Nada de esto es código de producto; son decisiones y conexiones de entorno.

1. **Elegir hosting** (`docs/PLAN.md` §3.3). La aplicación es agnóstica: migrar
   entre Supabase gestionado y un VPS es reapuntar tres variables.
2. **Conectar el disparador de recordatorios.** La lógica está hecha; falta
   quien la llame a diario:
   - Supabase gestionado: `pg_cron` + `pg_net` haciendo `POST` a
     `/api/tareas/recordatorios` con `Authorization: Bearer $TAREAS_SECRETO`.
   - VPS: un cron del sistema con `curl` contra el mismo endpoint.
3. **Configurar Resend**: como remitente de la aplicación (`RESEND_API_KEY`) y
   como SMTP de GoTrue en `supabase/config.toml`, para los correos de
   verificación y recuperación.
4. **Copias de seguridad** con una restauración probada. Una copia que nunca se
   restauró no es una copia.
5. **Revisión legal** de privacidad, términos y consentimiento, hoy en borrador.
6. **Revisión manual de accesibilidad** con teclado y lector de pantalla. La
   auditoría automática cubre contraste, etiquetas y estructura, pero no dice
   si el recorrido tiene sentido.

Sigue pendiente cerrar con el cliente: **país de ejercicio**, **duración por
defecto de una cita y franja de atención**, y **política de cancelación**.
Mientras tanto la plataforma usa los valores de `clinic_settings`: 60 minutos,
24 horas de anticipación y jornada de 7:00 a 21:00.

## Pendientes conocidos

- Las páginas legales son borradores y necesitan revisión profesional.
- Los textos de la landing (nombre, especialidad, áreas) son provisionales.
- Sin `RESEND_API_KEY` los correos no se envían: se registran en consola. Es
  deliberado, para que en local no estorbe.
- Las solicitudes de eliminación de cuenta se muestran en la ficha del
  paciente y en el listado, pero resolverlas todavía se hace en Studio.
- El profesional no puede **proponer otro horario** sobre una solicitud: puede
  confirmar, rechazar o agendar una cita nueva. Falta una función de
  transición en la base para ese caso.
- La franja horaria (7:00–21:00) está fijada en código, no en
  `clinic_settings`. Se parametriza cuando el profesional defina la suya.
- No hay servicio de errores conectado (Sentry o equivalente). Los fallos se
  ven en los registros del servidor.
