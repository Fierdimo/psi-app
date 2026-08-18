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

Las mismas credenciales del paso anterior, en el entorno donde corra la
aplicación:

```bash
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASS="re_..."
CORREO_REMITENTE="JBR Psicometrías <no-responder@jbrpsicometrias.com>"
```

En local ya vienen apuntando a Mailpit (`127.0.0.1:54325`), que no pide
usuario ni clave.

Sin `SMTP_HOST`, `enviarCorreo` **no falla**: registra el intento y sigue. Es
deliberado —una cita confirmada no debe deshacerse porque el correo no salga—
pero significa que la ausencia de configuración **no se nota** salvo por lo que
no llega. La pantalla de invitaciones sí lo dice: informa de cuántas se
crearon y cuántas se enviaron, y son números distintos cuando falta.

---

## 4 · Comprobar que funciona

En este orden, que es el de las dependencias:

1. **Registro.** Crear una cuenta con una dirección real y confirmarla desde el
   correo. Si no llega, el problema es el SMTP de Supabase, no la aplicación.
2. **Recuperar contraseña**, desde `/recuperar`.
3. **Invitación a una evaluación.** Confirmar una sesión de empresa y pulsar
   «Invitar a los convocados»: tiene que decir _«N invitaciones enviadas por
   correo»_. Si dice _«N creadas, 0 enviadas»_, falta la configuración SMTP.
4. **Recordatorio de víspera.** Lo dispara `/api/tareas/recordatorios` con el
   secreto `TAREAS_SECRETO`; hay que programarlo una vez al día.

---

## Lo que sigue pendiente y conviene saber

- **Al convocado no se le avisa si su sesión se cancela.** Hoy el aviso de
  cancelación solo llega a la empresa. Quien ya se había organizado para ese
  día se entera por no verla en su calendario.
- **Los recordatorios no alcanzan a los convocados** de una sesión corporativa,
  solo a los pacientes individuales.
