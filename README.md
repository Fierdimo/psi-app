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

| Documento                                            | Contenido                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)                       | Diseño y producto: identidad visual, roles, flujos, pantallas |
| [`docs/PLAN.md`](docs/PLAN.md)                       | Planeación técnica: stack, modelo de datos, seguridad, fases  |
| [`docs/design-system.html`](docs/design-system.html) | Versión visual del sistema de diseño                          |

Lee el spec antes de tocar un color, y el plan antes de tocar el esquema.

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

| Correo                 | Rol                                         |
| ---------------------- | ------------------------------------------- |
| `profesional@psi.test` | Profesional                                 |
| `ana@psi.test`         | Paciente (zona horaria de Bogotá)           |
| `beto@psi.test`        | Paciente (zona horaria de Ciudad de México) |

Los correos de verificación y recuperación caen en Inbucket,
en <http://localhost:54324>. Nunca salen a internet.

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

## Las cuatro reglas que no se negocian

### 1. Nunca negro

No existe `#000`, `black`, `rgba(0,0,0,…)` ni los casi-negros `#111`/`#222` en
ninguna parte. El texto más oscuro es `ink-900` (`#16233A`); el fondo más
oscuro, `brand-950` (`#101740`). Las sombras derivan de `brand-950`.

`pnpm check:colors` falla el build ante cualquier intento, y también ante
cualquier literal de color fuera de `src/styles/tokens.css`. Si una línea
necesita excepción real, se marca con el comentario `color-guard-ignore` y su
justificación.

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

---

## Estructura

```
docs/            Spec, plan y sistema de diseño
scripts/         Guardia de color
src/
  app/           Rutas (App Router)
  components/
    ui/          Componentes base repintados
    marca/       Wordmark
  lib/           Utilidades
  styles/        tokens.css — único origen del color
supabase/
  migrations/    Esquema, RLS y funciones de transición
  tests/         Pruebas de RLS
  seed.sql       Datos ficticios de desarrollo
```

---

## Siguiente fase

### Antes de salir a producción

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

### Pendientes conocidos

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
