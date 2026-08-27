# Correo: qué falta para enviar de verdad

En local no hace falta nada: todo se queda en Mailpit (`http://127.0.0.1:54324`)
y ningún correo sale a internet. Este documento es lo que hay que resolver
**antes de que se registre la primera persona real**.

Hay **dos vías de correo distintas**, y confundirlas cuesta una tarde:

|                   | Quién lo envía    | Cuándo                                                                            | Qué falta                       |
| ----------------- | ----------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| **Autenticación** | Supabase (GoTrue) | Verificar el correo al registrarse, recuperar contraseña, cambiar de dirección    | SMTP en el proyecto de Supabase |
| **Transaccional** | Nuestro código    | Cita confirmada o rechazada, recordatorio de víspera, invitación a una evaluación | Las mismas credenciales SMTP    |

Las dos salen **por el mismo camino y con las mismas credenciales**: SMTP. Una
sola configuración, un solo dominio verificado y un solo sitio donde mirar
cuando algo no llega.

En local eso significa que **todos los correos se ven en Mailpit**, también los
transaccionales. Antes solo se escribían en la consola del servidor, así que no
había forma de ver cómo quedaba una invitación sin desplegarla.

---

## 0 · La dirección del sitio

```bash
NEXT_PUBLIC_SITE_URL="https://jbrpsicometrias.com"
```

Es lo primero porque de ahí salen **todos los enlaces que se envían fuera**:
confirmar el correo, recuperar la contraseña, y el pase de cada convocado con
su QR.

Sin ella se deduce de los encabezados de la petición, que sirve en local pero
no es de fiar detrás de un proxy: un enlace con el host interno funciona en la
pantalla de quien lo genera y no funciona en el teléfono de quien lo recibe.

### El dominio: la aplicación se quedó con la raíz

`jbrpsicometrias.com` está registrado **en Wix** y su DNS lo sirve Wix
(`ns2/ns3.wixdns.net`). Ahí vivía la página del cliente. El **27 de agosto de
2026** se retiró y la raíz pasó a la aplicación.

| Registro | Antes                                | Ahora                                |
| -------- | ------------------------------------ | ------------------------------------ |
| A (raíz) | `185.230.63.107 / .171 / .186` (Wix) | `200.58.127.167`                     |
| `www`    | `cdn1.wixdns.net` (Wix)              | `200.58.127.167`, redirige a la raíz |
| **MX**   | `aspmx.l.google.com` y cuatro más    | **sin tocar**                        |
| TXT      | SPF de Google + verificación         | **sin tocar**                        |

**Los MX son la parte delicada de cualquier cambio aquí.** El correo del
dominio está en Google Workspace, y un MX perdido no da error: simplemente deja
de llegar el correo —el de la consulta y el de las invitaciones—. Cambiar los
registros A no los toca; lo que sí los pondría en riesgo es desconectar el
dominio del sitio en Wix o cambiar de nameservers sin recrearlos.

Se llegó aquí pasando primero por un subdominio (`portal`), que sirvió para
probar el servidor entero sin tocar la página que estaba en producción. Es el
orden recomendable si algún día hay que repetir la maniobra: montar en un
subdominio, verificarlo, y mover la raíz al final.

### Los registros, y las tres trampas

| Tipo | Host       | Valor            |
| ---- | ---------- | ---------------- |
| A    | `@` (raíz) | `200.58.127.167` |
| A    | `www`      | `200.58.127.167` |

En el panel de Wix: **Dominios → el dominio → Avanzado → Editar registros DNS**.
Y ojo, esa página está en el nivel de **cuenta** (`manage.wix.com/account/domains`),
no en el del sitio (`manage.wix.com/dashboard/<id>/…`), que es donde se pierde
todo el mundo. Si el dominio aparece sin opciones de edición y con anuncios de
compra, es que pertenece a otra cuenta de Wix.

- **Nada de AAAA.** El servidor tiene IPv6 de salida pero **no acepta nada
  entrante por IPv6** —comprobado puerto por puerto—. Con un AAAA publicado los
  navegadores lo preferirían y verían el sitio caído mientras desde el servidor
  todo parece bien.
- **Durante la propagación conviven las dos versiones.** Con el TTL viejo de
  3600 s, hasta una hora en la que un resolutor devuelve Wix y otro el VPS. Y
  Wix redirige la raíz a `www`, así que hasta que `www` también apunte aquí,
  parte de la gente acaba en la página vieja igualmente. Se distinguen por la
  cabecera `x-wix-request-id`.
- **El certificado no se pide solo si Caddy ya se rindió.** Reintenta con espera
  creciente —llegó a 20 minutos—, así que tras cambiar el DNS conviene un
  `systemctl restart caddy` en vez de esperar.

### Lo que hay que cambiar en la aplicación

- `NEXT_PUBLIC_SITE_URL`. **Se incrusta al construir**, así que cambiarla exige
  reconstruir y volver a desplegar; no basta con editar el entorno.
- En `/opt/supabase/psi/.env`: `SITE_URL`, `API_EXTERNAL_URL`,
  `SUPABASE_PUBLIC_URL` y `ADDITIONAL_REDIRECT_URLS`. Sin esto los enlaces de
  confirmar la cuenta siguen apuntando al host viejo.
- En el `Caddyfile`, el nombre del bloque y el de `www`.

## 1 · La cuenta de Google

El correo sale por Google. Dos formas, y no dan lo mismo:

|                                  | Remitente                      | Límite diario | Reputación                                     |
| -------------------------------- | ------------------------------ | ------------- | ---------------------------------------------- |
| **Workspace con dominio propio** | `jbanquez@jbrpsicometrias.com` | ~2.000        | SPF y DKIM propios, alineados con el dominio   |
| **Gmail gratuito**               | `psicologojbr@gmail.com`       | ~500          | La de Google; no puedes firmar por `gmail.com` |

**El remitente es un buzón de persona, no un `no-responder`.** Es la única
cuenta con licencia del dominio, y pagar una segunda solo para que ponga
«no-responder» delante no compra nada. Tiene una consecuencia buena y una que
conviene tener presente:

- **Quien conteste una invitación llega a alguien.** Ninguna plantilla dice «no
  respondas a este correo», así que no se promete nada que se incumpla.
- **Los rebotes y las respuestas automáticas caen en el buzón de trabajo**, y si
  una tanda se marcara como abuso, la reputación que se resiente es la de esa
  dirección. Con decenas de invitaciones no es un problema; conviene recordarlo
  si algún día son cientos.

Con Workspace, en el panel de administración se añade el dominio y se copian
los registros DNS que indique —SPF, DKIM y, si lo ofrece, DMARC—. Sin eso el
correo sale pero llega a spam, **y una invitación en spam es una persona que no
se presenta a su evaluación**.

**Media parte ya está hecha, y la otra media no.** El dominio tiene Workspace y
su SPF (`v=spf1 include:_spf.google.com ~all`), pero el 26 de agosto de 2026 no
publicaba **DKIM** —`google._domainkey` no devuelve nada— ni **DMARC**. Con SPF
solo, el correo llega; sin DKIM la firma no viaja con el mensaje, y quien
reenvíe una invitación rompe la única prueba de que salió de este dominio. Se
resuelve en el panel de administración de Google —**Aplicaciones → Google
Workspace → Gmail → Autenticar correo**—, que da la clave a copiar como TXT en
el DNS de Wix. Es un registro más, del mismo tipo que el subdominio del paso 0.

Con Gmail gratuito funciona igual de bien técnicamente, pero el remitente será
la dirección personal. Para invitar a los empleados de una empresa cliente eso
resta seriedad; para arrancar, sirve.

### La contraseña de aplicación

`SMTP_PASS` **no es la contraseña de la cuenta**. Hay que crear una contraseña
de aplicación de 16 caracteres, y para que esa opción exista hay que tener
activada la verificación en dos pasos. Sin ella, Google rechaza el acceso y el
error no dice por qué.

Cuenta de Google → **Seguridad** → **Verificación en dos pasos** → al final,
**Contraseñas de aplicaciones**.

### El remitente tiene que ser la cuenta

`CORREO_REMITENTE` debe llevar la **misma dirección** que `SMTP_USER`. Si no,
Google la reescribe: el correo llega igual, pero quien lo recibe ve la cuenta
autenticada en vez de la de la marca. No hay error ni rebote — se descubre
cuando alguien responde a una dirección que no era.

Si quieres enviar desde un alias, verifícalo antes en Gmail →
**Configuración** → **Cuentas** → **Enviar como**.

La aplicación avisa de este desajuste al arrancar, y `pnpm correo:probar` lo
comprueba antes de gastar un envío.

---

## 2 · Correos de autenticación

Son los que bloquean el registro: sin ellos nadie confirma su dirección y
ninguna cuenta se activa.

Supabase los envía por su cuenta con un remitente compartido y un **límite muy
bajo por hora**, pensado para probar, no para atender gente. Hay que darle el
SMTP de Google.

En el panel del proyecto → **Authentication → Emails → SMTP Settings**:

| Campo        | Valor                              |
| ------------ | ---------------------------------- |
| Host         | `smtp.gmail.com`                   |
| Puerto       | `587`                              |
| Usuario      | la dirección completa              |
| Contraseña   | la contraseña de aplicación        |
| Sender email | **la misma dirección del usuario** |
| Sender name  | `JBR Psicometrías`                 |

El mismo bloque está preparado en `supabase/config.toml` bajo
`[auth.email.smtp]`, con `enabled = false` para que en local sigan cayendo en
Mailpit.

**El remitente y el nombre solo surten efecto con SMTP activo.** En local
seguirás viendo `Admin <admin@email.com>`: es el valor por defecto de GoTrue y
no significa que esté mal configurado.

Las plantillas ya están en español y con la marca, en `supabase/templates/`.

---

## 3 · Correos transaccionales

Los envía la aplicación por SMTP, con **las mismas credenciales** del paso
anterior. Un solo sitio donde mirar cuando algo no llega.

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="jbanquez@jbrpsicometrias.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
CORREO_REMITENTE="JBR Psicometrías <jbanquez@jbrpsicometrias.com>"
```

En local ya vienen apuntando a Mailpit (`127.0.0.1:54325`), que no pide usuario
ni clave.

**Google no tiene API HTTP de envío**, así que el camino de `RESEND_API_KEY`
que el código todavía sabe usar queda sin efecto: si no defines esa variable
—y no vas a definirla— se usa SMTP. Eso importa si algún día esto corre en
Vercel: allí no hay proceso vivo que reutilice conexiones, así que cada correo
vuelve a pagar saludo, TLS y autenticación, y una tanda de quince invitaciones
lo nota. En un servidor propio no pasa: el grupo de conexiones se reutiliza.

Sin configuración, `enviarCorreo` **no falla**: registra el intento y sigue. Es
deliberado —una cita confirmada no debe deshacerse porque el correo no salga—
pero significa que la ausencia de configuración **no se nota** salvo por lo que
no llega. La pantalla de invitaciones sí lo dice: informa de cuántas se
enviaron, y son números distintos cuando falta.

---

## 4 · Si esto corre en un VPS

Lo que en local funciona puede no funcionar ahí, y por un motivo que no da
ningún error claro.

**Casi todos los proveedores de VPS bloquean la salida SMTP.** Es la medida
estándar contra el correo basura, y afecta siempre al puerto 25 y a menudo
también al 587 y al 465. Lo peor es la forma de fallar: un puerto bloqueado no
rechaza la conexión, la deja **colgada**, así que el síntoma es «no llega
nada» sin nada en los registros.

Tres consecuencias prácticas:

- **No instales un servidor de correo en el VPS.** Un Postfix propio enviando
  desde una IP recién estrenada acaba en spam o en listas negras: no hay
  reputación que lo respalde. Hay que salir por Google, que es justo lo que hace
  la configuración actual.
- **Si 587 está bloqueado, prueba 465** (SSL directo). Google ofrece esos dos y
  ningún otro: el 2525 que aceptan los relés comerciales aquí no existe. Si
  ambos están cerrados, no hay puerto alternativo — hay que pedir el desbloqueo
  o mover el envío a otro sitio.
- **Puede que haya que pedir el desbloqueo.** Varios proveedores lo abren si se
  les escribe explicando para qué; otros no lo hacen en cuentas nuevas.

Para saber en cuál de esos casos estás, **desde el propio servidor**:

```bash
pnpm correo:probar tu-correo@ejemplo.com
```

Dice si la conexión se acepta, si las credenciales valen y si el envío sale, y
qué mirar en cada caso. Es lo primero que hay que ejecutar tras desplegar.

El código ya no se queda esperando: la conexión abandona a los cinco segundos.
Sin ese tope, confirmar una cita se quedaba pensando hasta que la plataforma
mataba la petición, por un correo que además no es crítico.

### Con el relé del propio proveedor

Si el VPS es de un proveedor que vende su propio relé de salida —InterServer y
su mail.baby, por ejemplo— eso resuelve el bloqueo: el puerto está abierto
hacia su relé y los correos salen con la reputación de ellos, no con la de una
IP recién estrenada.

Ahí el camino correcto es **SMTP**, que es justo el que el código usa cuando no
hay `RESEND_API_KEY`: en un servidor propio el proceso vive, así que el grupo
de conexiones se reutiliza y no se paga el saludo en cada envío.

Sigue haciendo falta lo mismo del paso 1: **verificar el dominio** con los SPF
y DKIM que indique ese relé. Sin eso el correo sale, pero llega a spam — y una
invitación en spam es una persona que no se presenta a su evaluación.

Un aviso sobre la entrega: los relés económicos comparten IP entre muchos
clientes, así que su reputación no depende solo de ti. Merece la pena mandar
una invitación de prueba a una cuenta de Gmail y a una de Outlook antes de
usarlo con gente real, y mirar en qué carpeta cae.

### Lo que un VPS no resuelve solo: las copias

Esto es lo que hay que decidir ANTES de elegir servidor propio, y no tiene que
ver con el correo.

Aquí hay historias clínicas y evaluaciones psicológicas de personas
identificadas. Un servicio alojado trae copias y recuperación a un punto en el
tiempo; en un VPS eso se monta:

- Copia diaria (`pg_dump`) **fuera del servidor**. Una copia en el mismo disco
  no es una copia: el caso del que protege es justamente perder ese disco.
- **Probar la restauración**, no solo que el archivo exista. Una copia que
  nadie ha restaurado nunca es una suposición.
- Retención pensada: cuánto hacia atrás se puede volver si algo se corrompió
  hace semanas y nadie lo notó.

Y alguien tiene que actualizar Postgres, el sistema y el certificado. No es
difícil; es constante.

### Si Supabase también va en el VPS

Con Supabase alojado, el SMTP de autenticación se configura desde su panel. Si
lo autoalojas, GoTrue lee **variables de entorno**, no el panel:

```bash
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=re_...
GOTRUE_SMTP_ADMIN_EMAIL=jbanquez@jbrpsicometrias.com
GOTRUE_SMTP_SENDER_NAME=JBR Psicometrías
```

Las plantillas de `supabase/templates/` hay que montarlas en el contenedor y
apuntarlas con `GOTRUE_MAILER_TEMPLATES_CONFIRMATION` y sus equivalentes; si no,
vuelve el texto en inglés por defecto.

---

## 5 · Sin servicio de correo: la entrega en mano

Contratar un servicio de envío se puede posponer, pero conviene saber qué se
pierde exactamente y qué no.

**Lo que sigue funcionando.** Cada sesión confirmada puede repartir sus accesos
a mano, con un enlace y un QR por convocado:

Los accesos **se crean al confirmar la sesión** y están a la vista desde
entonces, sin nada que pulsar:

- El **profesional**, en la sesión, los ve junto al botón «Invitar a los
  convocados» —que ya solo manda correos, con el mismo enlace que muestra el
  QR—.
- La **empresa**, en `/empresa/sesiones/[id]`. Es la vía que mejor escala: ya
  tiene su canal con su gente —intranet, grupo del turno, el jefe de área— y
  llega antes que un correo desde fuera.

Quien no tiene cuenta recibe su invitación; quien ya la tiene aparece marcada y
su pase lleva a la entrada normal, porque su evaluación le espera dentro. El QR
está pensado para la entrega en persona: se enseña en pantalla y lo escanea con
su teléfono.

**Lo que hay que aceptar a cambio.** Un pase con testigo es la llave para entrar
como esa persona. Puesto en manos de la empresa, la empresa **puede** crear la
cuenta de su empleado y, con ella, aceptar el consentimiento y responder la
prueba en su lugar. No hay forma de evitarlo: quien tiene el enlace tiene el
acceso. Y para que estén siempre a la vista, el testigo **se guarda en claro**
en `invitations.token` mientras la invitación siga pendiente; se borra al
aceptarse. Quien pueda volcar la base puede entrar como cualquier invitado que
aún no haya activado su cuenta.

Eso pesa menos de lo que parece: en esa misma base hay historias clínicas,
respuestas de pruebas y informes con nombre y cédula. Quien la vuelque ya tiene
lo que el testigo protegía. La migración `20260818100000` lo argumenta entero.

Si esa cesión no es aceptable para un cliente concreto, la salida es que los
reparta el profesional el día de la sesión, en persona: el acceso llega a su
dueño sin pasar por nadie más.

**Lo que NO se puede sustituir a mano:**

- **Recuperar la contraseña.** Va por correo y no hay otra vía. Sin servicio de
  envío, quien olvide la suya se queda fuera hasta que alguien se la reponga
  desde el panel de Supabase.
- **Cambiar de dirección de correo**, por lo mismo.

Para quitar la verificación al registrarse —el paso que hoy bloquea las cuentas
nuevas si no hay correo— en `supabase/config.toml`:

```toml
[auth.email]
enable_confirmations = false
```

Con eso la cuenta queda activa al crearse. El precio es que nadie comprueba que
la dirección sea suya: alguien puede registrarse con el correo de otra persona,
y ese correo es el único camino para recuperar la contraseña más adelante.

---

## 6 · Comprobar que funciona

En este orden, que es el de las dependencias:

1. **Registro.** Crear una cuenta con una dirección real y confirmarla desde el
   correo. Si no llega, el problema es el SMTP de Supabase, no la aplicación.
2. **Recuperar contraseña**, desde `/recuperar`.
3. **Invitación a una evaluación.** Confirmar una sesión de empresa y pulsar
   «Invitar a los convocados»: tiene que decir _«N invitaciones enviadas por
   correo»_. Si dice _«N creadas, 0 enviadas»_, falta la configuración SMTP —y
   los enlaces que aparecen debajo siguen sirviendo para entregarlas a mano.
4. **Recordatorio de víspera.** Lo dispara `/api/tareas/recordatorios` con el
   secreto `TAREAS_SECRETO`; hay que programarlo una vez al día.

---

## 7 · El servidor, tal como quedó

Esto ya no es hipotético: la aplicación está montada. Aquí queda el inventario,
las decisiones y —lo importante— lo que aún falta.

### La máquina

VPS de **DonWeb** (`dattaweb.com`), Ubuntu 22.04.5 LTS, KVM. `psi-vps` en
`~/.ssh/config`, con la IP y el puerto.

| Ficha comercial    | Lo que hay de verdad                                              |
| ------------------ | ----------------------------------------------------------------- |
| 4096 MB de RAM     | 3,8 GiB — correcto                                                |
| 4000 GB de tráfico | correcto, y sobra                                                 |
| —                  | 2 núcleos AMD EPYC                                                |
| **80 GB de disco** | **15 GB.** Un solo `sda` de 15G, sin segundo volumen ni LVM libre |

**Los 65 GB que faltan hay que reclamarlos.** No es un detalle: al levantar el
stack el disco llegó al 100 % con 92 MB libres, y un disco lleno corrompe
Postgres. Se recuperó espacio borrando imágenes que no usamos, pero el margen
sigue siendo el que es.

### Acceso

Solo por clave. `PasswordAuthentication no`,
`PermitRootLogin prohibit-password`, en `/etc/ssh/sshd_config.d/00-psi-endurecido.conf`
—el prefijo `00` es deliberado: sshd aplica el primer valor que encuentra y los
drop-ins se leen alfabéticamente, así que ese archivo gana sobre el `custom.conf`
que traía `PermitRootLogin yes`—. Respaldo del original en `/root/`.

**La contraseña de root sigue existiendo y no hay que borrarla:** ya no sirve
por SSH, pero es la que abre la consola web de DonWeb, que es la única puerta si
algún día sshd queda mal configurado.

Cortafuegos `ufw`: entra 5849 (SSH), 80 y 443. Nada más. Eso tapó de paso el
Postfix que venía escuchando en el 25 sobre la IP pública.

### Lo que hay que saber sobre quién más entra

`/root/.ssh/authorized_keys` tiene **52 claves**. Una es la del despliegue. Las
otras 51 son de personal de DonWeb, agrupadas por equipo dentro del propio
archivo —ITI, NOC, Clouds, Entregabilidad, Soporte L2, Soporte Cloud—, con
nombre y apellido. Hay además un `80-step.conf` que confía en una CA de SSH, así
que pueden emitirse certificados nuevos sin tocar ese archivo.

No es una intrusión: es cómo provisiona el proveedor. Pero en esta máquina viven
historias clínicas y evaluaciones de personas identificadas, y **root lee la base
entera: RLS protege de los usuarios de la aplicación, no de quien es root**.

Borrar esas claves no resuelve nada —DonWeb controla el hipervisor y puede montar
el disco sin pasar por SSH—, y probablemente rompa su soporte. Lo que sí procede:
pedirles por escrito su política de acceso, y cerrar con el cliente el **país de
ejercicio** que [PLAN.md](PLAN.md) deja pendiente, porque de él depende qué exige
la ley aplicable de un tercero que trata datos de salud.

### La forma del despliegue

```
internet ──► Caddy :443
              ├── /auth/v1/verify*  ──► 127.0.0.1:8000  (Supabase)
              └── todo lo demás     ──► 127.0.0.1:3000  (Next.js)

                          127.0.0.1:8000 ──► api-gw ──► auth · rest
                          127.0.0.1:5432 ──► db  (solo por túnel SSH)
```

**Supabase no sale a internet.** Se pudo porque se verificó en el código que la
aplicación habla con la base **siempre desde el servidor**: no hay una sola
llamada a `createBrowserClient`. La única excepción es `/auth/v1/verify`, que
tiene que ser pública porque el enlace de confirmar el correo se abre desde el
buzón de la persona, en otro teléfono y otra red.

Por eso `API_EXTERNAL_URL` es el dominio público mientras
`NEXT_PUBLIC_SUPABASE_URL` es `http://127.0.0.1:8000`: los enlaces que salen por
correo apuntan a internet, y el tráfico de la app no sale de la máquina.

### Qué corre, y qué se apagó

Cuatro contenedores: `db`, `auth`, `rest`, `api-gw`. Consumo en reposo, medido:
**358 MB** de RAM entre todos, sobre 3,8 GiB.

Apagados en `docker-compose.override.yml`, con un perfil que los deja definidos
pero sin arrancar:

| Apagado                   | Por qué                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`, `imgproxy`     | No hay una sola llamada a Supabase Storage en el código                                                                                                            |
| `realtime`                | Tampoco a Realtime                                                                                                                                                 |
| `functions`, `deno-cache` | No hay Edge Functions                                                                                                                                              |
| `supavisor`               | Publicaba Postgres en `0.0.0.0`; la app habla por PostgREST                                                                                                        |
| `studio`, `meta`          | 2,2 GB de imagen en un disco de 15. Y Studio invita a romper la regla 1 del contrato de portabilidad: el esquema vive en `supabase/migrations`, no en un panel web |

No se edita `docker-compose.yml`, para que una actualización pueda reemplazarlo
sin arrastrar nuestras decisiones. Ojo con `COMPOSE_FILE` en `.env`: si solo
lista un archivo, **el override se ignora en silencio**.

### Desplegar

```bash
./scripts/desplegar.sh
```

Construye en local y sube solo el resultado. No se construye en el servidor por
dos razones medidas: `next build` pica en **1,16 GB** de memoria —en 4 GB con
Postgres al lado, ese pico cae encima de la base— y el paquete `standalone` pesa
**60 MB** frente a los 569 MB de `node_modules`.

El paquete `standalone` **no incluye `.next/static` ni `public`**, y la
ausencia de `public` engaña: el paquete sí trae una carpeta `public/` con
`informe` dentro —que el generador de PDF referencia desde el servidor—, así
que parece completa. Faltaba todo lo que se ve: `marca`, `clientes`, `stock` y
el retrato. El sitio respondía 200 y no tenía una sola imagen. Por eso el
script, al terminar, pide **una imagen de verdad** además de la portada.

El script comprueba tipos y lint antes de tocar producción, **aborta si el
paquete lleva dentro la dirección de Supabase local** —las `NEXT_PUBLIC_*` se
incrustan al construir, y ese error no se nota hasta que la app no encuentra la
base—, y si la versión nueva no responde 200, **revierte a la anterior sola**.

Migraciones: por un túnel, sin exponer Postgres.

```bash
ssh -f -N -L 54322:127.0.0.1:5432 psi-vps
npx supabase db push --db-url "postgresql://postgres:CLAVE@127.0.0.1:54322/postgres"
```

### Copias

`psi-respaldo.timer`, a diario a las 03:30. Y **cada copia se restaura sola**
sobre una base temporal antes de darse por buena: si la restauración da un solo
error, el servicio falla en vez de dejar un archivo que parece una copia.

Un detalle que costó encontrar y que importa: hay que volcar como
**`supabase_admin`**, no como `postgres`. En Supabase el superusuario es el
primero. Volcando como `postgres` la copia restaura con **174 errores** —los
permisos de `supabase_auth_admin` que no puede recrear— y deja la autenticación
rota justo el día que hay que recuperarla. Como `supabase_admin`: **cero
errores**, 21 tablas, 49 políticas, 23 tablas del esquema `auth`.

**Y aun así esto todavía no es una copia de seguridad.** El archivo queda en el
mismo disco que la base, y el caso del que protege una copia es perder ese
disco. Falta el destino externo, y cifrarla al salir. Es la pieza que queda.

### Las plantillas de correo, y por qué no bastó montarlas

`GOTRUE_MAILER_TEMPLATES_*` **no acepta rutas de archivo**. Su propia
documentación lo dice —«URL to the confirmation email template»—: GoTrue las
**descarga por HTTP**. Montarlas dentro del contenedor y apuntar a
`/etc/gotrue/plantillas/…` no falla de forma evidente: GoTrue resuelve ese valor
contra `API_EXTERNAL_URL` y sale a buscar
`https://jbrpsicometrias.com/etc/gotrue/plantillas/confirmacion.html`.
Poner `file://` delante tampoco sirve; le come los dos puntos y queda
`…comfile///etc/…`.

El síntoma es engañoso: **el registro responde 200 y el correo llega**, pero con
la plantilla por defecto de GoTrue, en inglés. Parece que las plantillas se
ignoran, cuando lo que pasa es que no se pudieron descargar.

Las sirve Caddy desde `/opt/psi/plantillas`, en un bloque que solo responde a
`172.16.0.0/12` —las redes de Docker—, así que no quedan expuestas a internet.
El contenedor de `auth` llega por `host.docker.internal`, mapeado con
`extra_hosts: host-gateway`.

Para cambiarlas: se editan en `supabase/templates/` y se publican con

```bash
./scripts/plantillas.sh
```

que las sube **y reinicia `auth`**. Ese reinicio no es adorno: GoTrue cachea
cada plantilla diez minutos (`GOTRUE_MAILER_TEMPLATE_MAX_AGE`), así que sin él
se edita, se prueba y se sigue viendo la versión vieja.

Los asuntos van aparte, en `GOTRUE_MAILER_SUBJECTS_*` dentro de
`docker-compose.override.yml` del servidor.

### Recordatorios

`psi-recordatorios.timer`, cada hora. Cada hora y no una vez al día para que la
tanda salga cerca de la hora que toca; el endpoint marca cada cita al enviarla,
así que repetir la pasada no duplica correos y reintenta las que fallaron.

### Lo que falta para estar en línea

2. **`SMTP_PASS`.** La contraseña de aplicación de Google, en `/opt/psi/entorno`
   y en `/opt/supabase/psi/.env`. Los tres puertos SMTP salen desde este VPS
   —se verificó con un `EHLO` completo contra Gmail—, así que no hace falta
   relé: falta solo la credencial.
3. **El destino externo de las copias.**
4. **Los 65 GB de disco** que la ficha prometía.

---

## Lo que sigue pendiente y conviene saber

- **Al convocado no se le avisa si su sesión se cancela.** Hoy el aviso de
  cancelación solo llega a la empresa. Quien ya se había organizado para ese
  día se entera por no verla en su calendario.
- **Los recordatorios no alcanzan a los convocados** de una sesión corporativa,
  solo a los pacientes individuales.
