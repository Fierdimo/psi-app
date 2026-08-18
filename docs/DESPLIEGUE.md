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

## 1 · Verificar el dominio

Sin esto, cualquier proveedor entrega al spam o directamente rechaza.

En [Resend](https://resend.com) → **Domains** → añadir el dominio (por ejemplo
`jbrpsicometrias.com`) y copiar los registros DNS que muestre —SPF, DKIM y, si
lo ofrece, DMARC— al panel donde esté el dominio.

Hasta que el dominio aparezca como verificado, **no sigas**: lo demás no
funcionará y parecerá un fallo del código.

---

## 2 · Correos de autenticación

Son los que bloquean el registro: sin ellos nadie confirma su dirección y
ninguna cuenta se activa.

Supabase envía estos correos por su cuenta con un remitente compartido y un
**límite muy bajo por hora**, pensado para probar, no para atender gente. Hay
que darle un SMTP propio.

En el panel del proyecto → **Authentication → Emails → SMTP Settings**:

| Campo        | Valor                              |
| ------------ | ---------------------------------- |
| Host         | `smtp.resend.com`                  |
| Puerto       | `587`                              |
| Usuario      | `resend`                           |
| Contraseña   | la clave de API de Resend          |
| Sender email | `no-responder@jbrpsicometrias.com` |
| Sender name  | `JBR Psicometrías`                 |

El mismo bloque está preparado en `supabase/config.toml` bajo
`[auth.email.smtp]`, con `enabled = false` para que en local sigan cayendo en
Mailpit. Si prefieres gestionarlo desde el repositorio en vez de desde el
panel, pon `enabled = true` y define `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` en
el entorno.

**El remitente y el nombre solo surten efecto con SMTP activo.** En local
seguirás viendo `Admin <admin@email.com>`: es el valor por defecto de GoTrue y
no significa que esté mal configurado.

Las plantillas ya están en español y con la marca, en `supabase/templates/`.
Sin ellas llegaba el texto por defecto de Supabase —«Confirm your email
address»— que era el primer correo que recibía alguien al registrarse.

---

## 3 · Correos transaccionales

**Dónde corra esto decide el camino**, y el código elige solo:

| Dónde                    | Qué configurar   | Por qué                                                                                                                                                    |
| ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel u otro serverless | `RESEND_API_KEY` | No hay proceso vivo que reutilice conexiones: cada correo por SMTP volvería a pagar saludo, TLS y autenticación. Una tanda de quince invitaciones lo nota. |
| Servidor propio o VPS    | `SMTP_*`         | El grupo de conexiones sí se reutiliza, y permite cambiar de proveedor sin tocar código.                                                                   |

Con clave HTTP presente se usa esa; si no, SMTP. En local no hay clave, así que
se usa SMTP y todo cae en Mailpit.

Para el camino SMTP, las mismas credenciales del paso anterior:

```bash
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASS="re_..."
CORREO_REMITENTE="JBR Psicometrías <no-responder@jbrpsicometrias.com>"
```

En local ya vienen apuntando a Mailpit (`127.0.0.1:54325`), que no pide
usuario ni clave.

Para el camino HTTP basta una variable:

```bash
RESEND_API_KEY="re_..."
CORREO_REMITENTE="JBR Psicometrías <no-responder@jbrpsicometrias.com>"
```

Sin ninguna de las dos, `enviarCorreo` **no falla**: registra el intento y sigue. Es
deliberado —una cita confirmada no debe deshacerse porque el correo no salga—
pero significa que la ausencia de configuración **no se nota** salvo por lo que
no llega. La pantalla de invitaciones sí lo dice: informa de cuántas se
crearon y cuántas se enviaron, y son números distintos cuando falta.

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
  reputación que lo respalde. Hay que salir por un relé —el mismo del paso 2—,
  que es justo lo que hace la configuración actual.
- **Si 587 está bloqueado, prueba 2525.** Casi todos los relés lo ofrecen
  precisamente porque los proveedores no suelen filtrarlo.
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
GOTRUE_SMTP_ADMIN_EMAIL=no-responder@jbrpsicometrias.com
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

- El **profesional**, desde la sesión, con «Invitar a los convocados»: los
  enlaces aparecen en pantalla salgan o no los correos.
- La **empresa**, desde `/empresa/sesiones/[id]`, con «Generar pases de
  acceso». Es la vía que mejor escala: la empresa ya tiene su canal con su
  gente —intranet, grupo del turno, el jefe de área— y llega antes que un
  correo desde fuera.

Quien no tiene cuenta recibe su invitación; quien ya la tiene aparece marcada y
su pase lleva a la entrada normal, porque su evaluación le espera dentro. El QR
está pensado para la entrega en persona: se enseña en pantalla y lo escanea con
su teléfono.

**Lo que hay que aceptar a cambio.** Un pase con testigo es la llave para entrar
como esa persona. Puesto en manos de la empresa, la empresa **puede** crear la
cuenta de su empleado y, con ella, aceptar el consentimiento y responder la
prueba en su lugar. No hay forma de evitarlo: quien tiene el enlace tiene el
acceso. Por eso los pases se generan al pulsar —nunca al abrir la pantalla— y
`access_passes_log` guarda quién los pidió y cuándo.

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

## Lo que sigue pendiente y conviene saber

- **Al convocado no se le avisa si su sesión se cancela.** Hoy el aviso de
  cancelación solo llega a la empresa. Quien ya se había organizado para ese
  día se entera por no verla en su calendario.
- **Los recordatorios no alcanzan a los convocados** de una sesión corporativa,
  solo a los pacientes individuales.
