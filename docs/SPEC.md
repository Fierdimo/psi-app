# Psi — Especificación de Diseño y Producto

> **Estado:** Borrador v0.2 · **Fecha:** 2026-08-11
> **Cambios frente a v0.1:** el v1 pasa de «plataforma de pruebas psicotécnicas» a **portal del paciente**, con el calendario de citas como funcionalidad central. El módulo de evaluaciones queda diferido a placeholder hasta definir instrumento.
> **Alcance:** diseño (sistema visual completo) + producto (roles, flujos, pantallas, estados).
> **Nombre provisional:** «Psi». Reemplazar vía un único token de marca — ver §2.4.

---

## 1. Contexto y objetivo

Plataforma web para la práctica de un profesional de la psicología en **Latinoamérica**. Los pacientes crean una cuenta y acceden a un espacio privado donde consultan sus **citas**, gestionan sus datos y —a futuro— acceden a evaluaciones, recursos y documentos.

**Objetivo de diseño:** que un paciente que entra a ver cuándo es su próxima sesión perciba en los primeros cinco segundos que está en un entorno **serio, clínico y confidencial**, sin que la interfaz se sienta burocrática o anticuada.

La tensión central del proyecto es _confianza_ contra _modernidad_. Se resuelve así: la **estructura** es conservadora (jerarquía clara, densidad baja, nada de sorpresas) y el **acabado** es contemporáneo (tipografía nítida, espacio generoso, transiciones suaves, cero ornamento).

### 1.1 Lo que NO debe parecer

| Antipatrón                                                         | Por qué se rechaza                               |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| Landing de startup SaaS (gradientes, emojis, «🚀 Empieza gratis»)  | Trivializa un acto clínico                       |
| Portal gubernamental / intranet hospitalaria                       | Genera desconfianza y sensación de trámite       |
| App de bienestar/mindfulness (pasteles, ilustraciones redondeadas) | Sugiere entretenimiento, no atención profesional |
| Dashboard de analítica denso                                       | Abruma; el paciente no es un operador            |

---

## 2. Identidad visual

### 2.1 Regla fundacional: nunca negro

**No se usa `#000000` ni ningún neutro puro en ninguna parte de la interfaz** — ni en texto, ni en bordes, ni en sombras, ni en iconos, ni en overlays.

Todo neutro oscuro se construye desplazado hacia el azul institucional. Esto no es un capricho estético: un texto azul-tinta sobre blanco se lee como más suave y menos agresivo que el negro puro, que en pantallas modernas produce un contraste duro asociado a interfaces de sistema, no a entornos de cuidado.

- El texto más oscuro de la app es `--ink-900` = `#16233A`.
- El fondo más oscuro (tema oscuro, footer, hero) es `--brand-950` = `#101740`.
- Las sombras usan RGBA derivado de `--brand-950`, nunca de negro.

```css
/* ✅ correcto */
box-shadow: 0 1px 2px rgba(16, 23, 64, 0.06);
color: #16233a;

/* ❌ prohibido */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
color: #000;
color: black;
```

> **Acción para implementación:** añadir una regla de lint (stylelint o un test de CI que haga grep) que falle ante `#000`, `black`, `rgba(0,0,0`, `#111`, `#222` en el código de estilos.

### 2.2 Paleta

Los tres colores institucionales son **azul rey**, **azul rey oscuro** y **blanco**, con **grises** de soporte. Se expanden a escalas completas porque una escala de tres pasos no alcanza para cubrir estados (hover, activo, deshabilitado, foco, superficie sutil).

#### Marca — Azul rey

| Token             | Hex           | Uso                                                                               |
| ----------------- | ------------- | --------------------------------------------------------------------------------- |
| `--brand-50`      | `#EEF3FF`     | Fondo de avisos informativos, chips seleccionados, **relleno de cita confirmada** |
| `--brand-100`     | `#DCE5FF`     | Fondo de estado activo suave, barras de progreso (pista)                          |
| `--brand-200`     | `#BCCBFF`     | Bordes de acento, texto sobre fondos muy oscuros                                  |
| `--brand-300`     | `#93A9FB`     | Texto de enlace en tema oscuro                                                    |
| `--brand-400`     | `#6B86F4`     | Iconografía decorativa sobre oscuro                                               |
| `--brand-500`     | `#4B66E8`     | Estados hover sobre superficies oscuras                                           |
| **`--brand-600`** | **`#2F49D4`** | **Azul rey. Color primario: botones, enlaces, foco, acento**                      |
| `--brand-700`     | `#2438AC`     | Hover de primario, texto de enlace sobre claro                                    |
| **`--brand-800`** | **`#1C2C84`** | **Azul rey oscuro. Encabezados de marca, estado presionado**                      |
| `--brand-900`     | `#16225F`     | Superficies oscuras secundarias                                                   |
| `--brand-950`     | `#101740`     | Fondo oscuro más profundo. Sustituye al negro                                     |

#### Neutros — Grises azulados («ink» para texto, «surface» para fondos)

| Token          | Hex       | Uso                                                     | Contraste s/ blanco        |
| -------------- | --------- | ------------------------------------------------------- | -------------------------- |
| `--ink-900`    | `#16233A` | Texto principal, títulos                                | 15.72 : 1 · AAA            |
| `--ink-700`    | `#33415C` | Texto de cuerpo secundario                              | 10.24 : 1 · AAA            |
| `--ink-500`    | `#64748B` | Texto atenuado, etiquetas, ayuda                        | 4.76 : 1 · AA              |
| `--ink-400`    | `#8494AC` | **Bordes de campos interactivos**, iconos inactivos     | 3.08 : 1 · AA-UI           |
| `--ink-300`    | `#C6D0DE` | Bordes decorativos (no interactivos)                    | 1.56 : 1 · solo decorativo |
| `--ink-200`    | `#DDE3ED` | Divisores, **líneas de la retícula del calendario**     | decorativo                 |
| `--ink-100`    | `#EDF1F7` | Fondo de estado deshabilitado, superficies hundidas     |
| `--surface-50` | `#F7F9FC` | Fondo de página, **celdas de día fuera del mes actual** |
| `--surface-0`  | `#FFFFFF` | Fondo de tarjeta, superficie elevada                    |

> **El contraste hay que medirlo sobre CADA fondo en que se usa el color.**
> `--ink-500` cumplía de sobra sobre blanco y fallaba sobre las superficies
> hundidas —cabeceras del calendario, conmutador de vistas—, donde también se
> usa. Se oscureció hasta que cumple en las tres superficies del sistema. Un
> token que solo se valida contra un fondo no está validado.

> **Regla de contraste que rige los bordes:** WCAG 2.2 §1.4.11 exige 3:1 para el límite visual de un componente interactivo. `--ink-300` (1.56:1) **no puede** usarse como borde de un input, checkbox o botón secundario — solo `--ink-400` o más oscuro. Esta es la desviación más común respecto a los grises «bonitos» y hay que sostenerla.

#### Semánticos

Desaturados a propósito para no competir con el azul de marca ni activar alarma innecesaria en un contexto clínico.

| Token           | Hex                              | Contraste s/ blanco | Uso                                    |
| --------------- | -------------------------------- | ------------------- | -------------------------------------- |
| `--success-600` | `#146B4B`                        | 6.49 : 1 · AA       | Cita confirmada, guardado correcto     |
| `--success-50`  | `#E9F6F0`                        | —                   | Fondo de aviso de éxito                |
| `--warning-700` | `#7A4A02`                        | 7.48 : 1 · AAA      | Cita solicitada pendiente de confirmar |
| `--warning-50`  | `#FDF5E6`                        | —                   | Fondo de aviso de advertencia          |
| `--danger-600`  | `#B3261E`                        | 6.54 : 1 · AA       | Error de validación, cancelación       |
| `--danger-50`   | `#FDECEA`                        | —                   | Fondo de aviso de error                |
| `--info-*`      | usa `--brand-700` / `--brand-50` | 8.45 : 1 · AAA      | Avisos informativos                    |

**Nunca comunicar estado solo por color.** Todo aviso lleva icono + texto; toda cita lleva su estado escrito además del tratamiento visual.

#### Proporción de uso

Regla 60/30/10 para que el azul conserve fuerza de señal:

- **60 %** blanco y `--surface-50` — el lienzo
- **30 %** neutros de texto y borde
- **10 %** azul rey — reservado a lo accionable y a lo que indica estado

> **La excepción del calendario.** Una vista de mes llena de bloques azules sólidos rompe esta proporción y satura. Por eso las citas **no se pintan como bloques de color sólido**: se pintan como _tinte_ — fondo `--brand-50`, texto `--brand-700`, borde izquierdo 3 px `--brand-600`. Mantiene la legibilidad, respeta la proporción y deja que el azul saturado siga significando «accionable».

### 2.3 Tipografía

**Familia única: Inter.** Autohospedada con `next/font/local` — nunca desde un CDN externo (requisito de privacidad: una petición a fuentes de terceros filtra la IP del usuario en el momento en que consulta información clínica).

Un solo tipo de letra, bien usado, se lee como más profesional que un emparejamiento decorativo. Inter tiene alturas de x altas y numeración tabular, ambas necesarias aquí.

- Activar `font-feature-settings: "cv05", "ss03"` para una `l` y una `a` más distinguibles.
- Usar `font-variant-numeric: tabular-nums` en **horas, fechas y contadores** para que los dígitos no salten. En un calendario esto no es cosmético: sin él, las columnas de hora bailan.

| Rol               | Tamaño / Interlineado | Peso    | Tracking            | Color         |
| ----------------- | --------------------- | ------- | ------------------- | ------------- |
| Display           | 48 / 52 px            | 600     | −0.02em             | `--ink-900`   |
| H1                | 36 / 42 px            | 600     | −0.02em             | `--ink-900`   |
| H2                | 30 / 38 px            | 600     | −0.015em            | `--ink-900`   |
| H3                | 24 / 32 px            | 600     | −0.01em             | `--ink-900`   |
| H4                | 20 / 28 px            | 600     | 0                   | `--ink-900`   |
| Cuerpo grande     | 18 / 30 px            | 400     | 0                   | `--ink-700`   |
| **Cuerpo (base)** | **16 / 26 px**        | **400** | **0**               | `--ink-700`   |
| Cuerpo pequeño    | 14 / 22 px            | 400     | 0                   | `--ink-500`   |
| Etiqueta          | 14 / 20 px            | 500     | 0                   | `--ink-700`   |
| Micro / ayuda     | 12 / 18 px            | 400     | +0.01em             | `--ink-500`   |
| Overline          | 12 / 16 px            | 600     | +0.08em, mayúsculas | `--ink-500`   |
| **Chip de cita**  | **12.5 / 16 px**      | **500** | 0                   | `--brand-700` |

**Reglas duras:**

- El cuerpo base nunca baja de 16 px. Nada en la app usa menos de 12 px.
- Ancho de medida máximo: **68 caracteres** (`max-width: 68ch`) en párrafos de texto corrido.
- Sin texto en mayúsculas sostenidas salvo el estilo _overline_.
- Sin cursivas para énfasis; usar peso 600.

### 2.4 Marca

Hasta tener identidad definitiva, el nombre se renderiza como **wordmark tipográfico**: «Psi» en Inter 600, `--brand-800`, tracking −0.02em, acompañado de una marca gráfica simple (un glifo Ψ geométrico o un monograma en cuadrado redondeado `--brand-600`).

Se implementa como un componente único `<Brand />` y un token `NEXT_PUBLIC_BRAND_NAME`, de modo que el cambio a la marca real toque un solo archivo.

### 2.5 Espaciado, radios, elevación

**Espaciado** — escala de 4 px: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96`. Todo margen y padding sale de aquí.

**Radios**

| Token           | Valor   | Uso                                       |
| --------------- | ------- | ----------------------------------------- |
| `--radius-sm`   | 6 px    | Chips, badges, **eventos del calendario** |
| `--radius-md`   | 8 px    | Botones, inputs                           |
| `--radius-lg`   | 12 px   | Tarjetas                                  |
| `--radius-xl`   | 16 px   | Modales, contenedores mayores             |
| `--radius-full` | 9999 px | Solo avatares e indicadores circulares    |

**Elevación** — sombras difusas y de baja opacidad, siempre derivadas de `--brand-950`. La app es mayormente plana; la elevación se reserva para lo que realmente flota.

```css
--shadow-xs: 0 1px 2px rgba(16, 23, 64, 0.05);
--shadow-sm: 0 1px 3px rgba(16, 23, 64, 0.07), 0 1px 2px rgba(16, 23, 64, 0.04);
--shadow-md:
  0 4px 12px rgba(16, 23, 64, 0.08), 0 2px 4px rgba(16, 23, 64, 0.04);
--shadow-lg:
  0 12px 32px rgba(16, 23, 64, 0.12), 0 4px 8px rgba(16, 23, 64, 0.06);
```

Jerarquía: página plana → tarjetas con `xs` o borde `--ink-200` → menús/popovers `md` → modales `lg`.

### 2.6 Movimiento

Discreto y rápido. El movimiento aquí sirve para orientar, nunca para entretener.

- Duraciones: **150 ms** microinteracciones, **200 ms** entrada/salida, **300 ms** transición de pantalla.
- Curva: `cubic-bezier(0.2, 0, 0, 1)`.
- Cambio de mes en el calendario: fundido de 150 ms sin desplazamiento lateral. El deslizamiento horizontal marea y confunde la dirección temporal.
- **Sin animaciones en bucle, sin parallax, sin contadores animados.**
- Respetar `prefers-reduced-motion: reduce` desactivando todo desplazamiento y dejando solo fundidos de opacidad.

### 2.7 Iconografía e imagen

- **Iconos:** Lucide, trazo 1.5 px, tamaño 20 px (24 px en navegación). Color heredado del texto, nunca azul salvo que sean accionables.
- **Fotografía:** si se usa, retratos reales en contexto profesional, tratamiento natural. Prohibido el stock de gente sonriendo a la cámara con los brazos cruzados.
- **Ilustración:** solo geométrica y abstracta, en tonos de marca, con moderación. Sin personajes.
- **Cero emojis** en la interfaz de producto.

---

## 3. Usuarios y roles

| Rol             | Quién es                                     | Entra por      | Qué puede hacer en v1                                                                                                                              |
| --------------- | -------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paciente**    | Persona que crea su cuenta y recibe atención | `/ingresar`    | Registrarse, editar sus datos, ver su calendario, **solicitar** cita, solicitar reprogramación, cancelar, ver las secciones placeholder            |
| **Profesional** | El psicólogo titular de la plataforma        | `/profesional` | Ver la agenda completa, **autorizar o rechazar** solicitudes, crear citas, reprogramar, cerrar citas como realizadas o no asistidas, ver pacientes |

La distinción no es de jerarquía sino de **naturaleza de la relación**: el paciente _pide_, el profesional _autoriza_. Ninguna acción del paciente produce un hecho por sí sola — una cita no existe como compromiso hasta que el profesional la confirma. Esto se refleja en el modelo de estados (§9.1), en el lenguaje de la interfaz (§13: «solicitar», nunca «reservar») y en las dos entradas separadas (§5.1).

El área del profesional crece con el producto: hoy autoriza citas, mañana enviará documentos, asignará evaluaciones y compartirá recursos. Las cuatro secciones placeholder del paciente (§4.3) son, vistas desde el otro lado, cuatro funcionalidades futuras del profesional.

En v1 hay **un solo profesional**. El modelo de datos lo contempla como entidad para no bloquear el crecimiento, pero la interfaz no construye gestión multi-profesional, y **no existe pantalla para crear cuentas de profesional** — se hace por migración de datos.

---

## 4. Alcance v1

### 4.1 Público

1. **Landing** — presentación del profesional y sus servicios, con llamada a crear cuenta
2. **Registro** e **inicio de sesión** (correo + contraseña) con verificación de correo
3. **Recuperación de contraseña**
4. **Páginas legales:** privacidad, términos, consentimiento informado

### 4.2 Privado — funcional

5. **Panel de inicio** — próxima cita destacada y accesos a las secciones
6. **Calendario de citas** — vistas de mes, semana y día; solicitar, reprogramar y cancelar
7. **Mis datos** — edición de perfil, cambio de contraseña, zona horaria, cerrar sesión

### 4.3 Privado — placeholder

Cuatro secciones existen en la navegación, con su ruta, su encabezado y un estado vacío explicativo. **No son páginas «en construcción»**: comunican qué vivirá ahí y por qué todavía no hay nada. Ver §7.6.

8. **Resultados de evaluaciones**
9. **Mis sesiones**
10. **Recursos y tareas**
11. **Documentos y consentimientos**

### 4.4 Área del profesional — mínima

12. **Agenda** — vista de todas las citas, confirmar/rechazar solicitudes, crear cita, reprogramar
13. **Pacientes** — listado con datos de contacto y próxima cita

### 4.5 Fuera de v1

Pagos y facturación, mensajería paciente-profesional, videollamada integrada, app móvil nativa, informes automáticos, multi-idioma, multi-profesional, **el motor de evaluaciones y su contenido** (diferido hasta definir instrumento — ver §9), sincronización con Google Calendar.

---

## 5. Arquitectura de información

```
── Público ───────────────────────────────
/                          Landing
/ingresar                  Inicio de sesión — paciente
/registro                  Crear cuenta
/verificar-correo          Confirmación de correo
/recuperar                 Recuperación de contraseña
/privacidad · /terminos · /consentimiento

── Área del paciente ─────────────────────
/panel                     Inicio: próxima cita y accesos
/calendario                Calendario de citas
/calendario/[id]           Detalle de una cita
/mis-datos                 Perfil, contraseña, preferencias
/resultados                Placeholder
/sesiones                  Placeholder
/recursos                  Placeholder
/documentos                Placeholder

── Área del profesional ──────────────────
/profesional               Inicio de sesión — profesional (no enlazado públicamente)
/profesional/agenda        Agenda completa y bandeja de solicitudes
/profesional/pacientes     Listado de pacientes
/profesional/pacientes/[id]  Ficha de paciente
```

**Navegación del paciente** — barra lateral en escritorio (≥1024 px), barra inferior en móvil. Orden: Inicio · Calendario · Resultados · Sesiones · Recursos · Documentos · Mis datos. Las secciones placeholder se muestran atenuadas con un punto indicador, no ocultas: comunicar el mapa completo del producto desde el inicio genera más confianza que revelarlo por partes.

### 5.1 Dos entradas separadas

El paciente y el profesional **no comparten puerta**. Son dos personas con relaciones distintas hacia la plataforma: una consulta lo suyo, la otra autoriza, agenda y —a futuro— envía documentos. Mezclarlas en una sola pantalla que luego bifurca produce una interfaz que no le habla bien a ninguna de las dos.

|                           | Paciente       | Profesional                                   |
| ------------------------- | -------------- | --------------------------------------------- |
| Ruta de entrada           | `/ingresar`    | `/profesional`                                |
| Enlazada desde la landing | Sí, prominente | **No.** Ruta conocida solo por el profesional |
| Registro público          | Sí             | **No existe.** La cuenta se crea manualmente  |
| Destino tras entrar       | `/panel`       | `/profesional/agenda`                         |

**Reglas que sostienen la separación sin crear trampas:**

- Las dos pantallas usan el **mismo sistema de autenticación**. La separación es de experiencia y de superficie expuesta, no de mecanismo — la frontera real de seguridad son las políticas de acceso a datos, no la URL.
- Si un paciente entra por `/profesional` con credenciales válidas, **se le redirige a `/panel` sin error**. Nunca un mensaje del tipo «esta cuenta no es de profesional»: eso convertiría el formulario en un detector de cuentas privilegiadas.
- Si el profesional entra por `/ingresar`, se le lleva a su agenda. La puerta equivocada no debe bloquear a alguien legítimo.
- `/profesional` no lleva enlace a «Crear cuenta». No hay registro de profesionales por interfaz — es una decisión de seguridad, no una funcionalidad pendiente.

### 5.2 Dos entornos visualmente distintos

Al entrar, tiene que ser evidente en qué lado se está. Comparten el sistema de diseño, no la atmósfera:

|            | Área del paciente                         | Área del profesional                                         |
| ---------- | ----------------------------------------- | ------------------------------------------------------------ |
| Cabecera   | Blanca, ligera                            | `--brand-800`, con el rol visible junto al nombre            |
| Densidad   | Baja: espacio generoso, una cosa a la vez | Media: es una herramienta de trabajo, admite tablas y listas |
| Navegación | 7 secciones, iconos grandes               | 2 secciones, compacta                                        |
| Tono       | «Tu próxima cita»                         | «Solicitudes pendientes (3)»                                 |

La cabecera oscura del área del profesional cumple una función concreta: es un recordatorio permanente de que lo que se ve en pantalla son datos de otras personas.

---

## 6. Flujos

### 6.1 Alta y primer acceso

```
Landing → Crear cuenta → Verificar correo → Iniciar sesión
        → Consentimiento informado (una sola vez, bloqueante)
        → Completar datos básicos (nombre, teléfono, zona horaria)
        → Panel
```

El consentimiento informado es una pantalla propia, no una casilla al pie del registro. Explica qué datos se recogen, quién los ve, cuánto se conservan y cómo se revocan. Requiere una acción afirmativa explícita, y **se registra con versión y fecha** (§9.1). Es un requisito ético de la práctica psicológica y además el momento donde más se gana o se pierde confianza.

### 6.2 Solicitar una cita

```
Calendario → [Solicitar cita]
           → Formulario: fecha y hora preferida, alternativa opcional,
             modalidad (presencial / virtual), motivo breve (opcional)
           → Confirmación: «Solicitud enviada»
           → La cita aparece en el calendario con estado SOLICITADA
           → El profesional confirma o propone otra hora
           → Notificación por correo al paciente
```

**Reglas:**

- El paciente propone; **no reserva**. La interfaz nunca debe sugerir que la hora está garantizada antes de la confirmación.
- Una cita `SOLICITADA` se distingue visualmente de una `CONFIRMADA` con tratamiento y texto, no solo con color (§7.4).
- Anticipación mínima configurable (por defecto 24 h). Si el paciente elige una hora dentro de ese margen, la interfaz lo explica antes de enviar, no después.
- El paciente puede tener como máximo **una solicitud pendiente** a la vez. Evita saturar la agenda del profesional y es más fácil de razonar.

### 6.3 Reprogramar y cancelar

```
Detalle de cita → [Solicitar reprogramación] → nueva fecha/hora propuesta
                                             → estado REPROGRAMACIÓN SOLICITADA
                → [Cancelar cita] → confirmación con motivo opcional
                                  → estado CANCELADA
```

Cancelar dentro del margen de anticipación muestra un aviso que explica la política de la consulta antes de confirmar. La política es texto configurable, no lógica de negocio en v1.

### 6.4 Confirmación por el profesional

```
Agenda → Solicitudes pendientes → [Confirmar] → cita CONFIRMADA + correo al paciente
                                → [Proponer otra hora] → nueva propuesta + correo
                                → [Rechazar] → cita RECHAZADA + correo con motivo
```

---

## 7. Especificación de pantallas

### 7.1 Landing (`/`)

Objetivo único: que alguien que llega por recomendación entienda quién es el profesional y cree una cuenta.

Estructura: encabezado con wordmark y «Ingresar» → sección principal con el nombre del profesional, su especialidad y una llamada clara → enfoque y áreas de trabajo → cómo funciona la plataforma en tres pasos → nota de confidencialidad → pie con enlaces legales.

- Sin testimonios de pacientes. Además de éticamente delicado en psicología, resta credibilidad.
- Sin precios en v1.
- La nota de confidencialidad es una sección, no letra pequeña.

### 7.2 Autenticación (`/ingresar`, `/registro`)

**Layout:** dos columnas en ≥1024 px. Izquierda (45 %): panel `--brand-800` con el wordmark, una frase sobre confidencialidad y un sello de cifrado. Derecha (55 %): formulario centrado sobre blanco, ancho máximo 400 px. Bajo 1024 px, solo la columna de formulario con el wordmark arriba.

- Campos apilados, etiqueta encima (nunca _placeholder_ como etiqueta).
- Botón primario a ancho completo.
- Requisitos de contraseña visibles **antes** de escribir, no como error posterior.
- Errores de credenciales: mensaje genérico («Correo o contraseña incorrectos»), nunca revelar si el correo existe.

### 7.3 Panel (`/panel`)

Encabezado de bienvenida con el nombre de pila. Debajo, en este orden:

**Tarjeta de próxima cita** — el elemento más importante de la app. Es lo que el paciente viene a ver.

```
┌────────────────────────────────────────────────┐
│ PRÓXIMA CITA                    [CONFIRMADA]   │
│                                                │
│ Martes 18 de agosto                            │  ← H3
│ 10:00 – 11:00  ·  Presencial                   │  ← 18px, tabular-nums
│ Consultorio 402, Av. Principal 1234            │  ← 14px, ink-500
│                                                │
│ En 6 días                                      │  ← chip brand-50
│ ──────────────────────────────────────────     │
│        [ Reprogramar ]   [ Ver detalle → ]     │
└────────────────────────────────────────────────┘
```

Si no hay próxima cita, la tarjeta se convierte en la invitación a solicitar una — no en un vacío.

Debajo: **accesos a secciones** en cuadrícula, y **solicitudes pendientes** si las hay, con estado explícito.

### 7.4 Calendario (`/calendario`)

La pantalla con más carga de diseño del v1.

**Escritorio (≥1024 px)** — dos columnas:

- _Izquierda, 264 px:_ mini-calendario de mes para navegación, botón «Solicitar cita» primario, lista de próximas citas, leyenda de estados.
- _Derecha, resto:_ la vista principal con conmutador Mes / Semana / Día y navegación `←` `Hoy` `→`.

**Móvil (<768 px):** la vista por defecto es **agenda en lista**, no la retícula de mes. Una cuadrícula mensual en 375 px de ancho es ilegible y los chips se vuelven objetos de toque imposibles. La retícula queda disponible como opción secundaria, en modo consulta.

**Vista de mes:** retícula 7×5-6, líneas `--ink-200` de 1 px. Días fuera del mes en `--surface-50` con número en `--ink-400`. Hoy: número en círculo `--brand-600` con texto blanco. Máximo 3 chips por celda y «+N más» que abre el día.

**Vista de semana y día:** columnas por día, filas por hora, franja horaria configurable (por defecto 7:00–21:00). Línea de hora actual en `--danger-600` de 2 px con punto en el extremo — es el único uso de rojo que no significa error, y funciona porque es la convención universal en calendarios.

**Chips de cita** — tratamiento por estado, siempre con texto además del color:

| Estado                    | Tratamiento                                                                | Texto                  |
| ------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| Confirmada                | Fondo `--brand-50`, borde izq. 3 px `--brand-600`, texto `--brand-700`     | Hora + modalidad       |
| Solicitada                | Fondo blanco, borde punteado 1.5 px `--warning-700`, texto `--warning-700` | Hora + «Por confirmar» |
| Reprogramación solicitada | Igual que solicitada, icono de flechas                                     | Hora + «Cambio pedido» |
| Realizada                 | Fondo `--ink-100`, texto `--ink-500`                                       | Hora + «Realizada»     |
| Cancelada / rechazada     | Fondo blanco, texto `--ink-400` tachado                                    | Hora + «Cancelada»     |

**Zona horaria:** el calendario muestra siempre la zona horaria activa en la cabecera («Hora de Bogotá, GMT-5»). Si la del dispositivo difiere de la del perfil, aparece un aviso con opción de cambiar. En Latinoamérica esto no es un detalle: un paciente que viaja o migra puede perder una sesión por una diferencia de una hora.

### 7.5 Mis datos (`/mis-datos`)

Columna única, máximo 720 px, en secciones separadas por tarjeta:

1. **Datos personales** — nombre, apellidos, teléfono, fecha de nacimiento, documento de identidad
2. **Cuenta** — correo (cambio con reverificación), contraseña
3. **Preferencias** — zona horaria, recordatorios por correo
4. **Privacidad** — descargar mis datos, solicitar eliminación de cuenta

Guardado explícito por sección, con botón que se activa solo si hay cambios y confirmación por _toast_. La sección de privacidad no es opcional: en régimen de habeas data el titular tiene derecho de acceso y supresión, y la ruta tiene que existir en la interfaz, no solo en un correo.

### 7.6 Secciones placeholder

Un placeholder bien hecho construye confianza; uno mal hecho parece abandono. La regla: **explica qué vivirá aquí, por qué aún no está, y qué hacer mientras tanto.**

Cada sección tiene encabezado real (título + descripción), y en el cuerpo un estado vacío centrado, máximo 480 px:

- Icono geométrico en círculo `--brand-50`
- Título de lo que será
- Una o dos frases explicando el contenido futuro
- Chip `--ink-100` con «Próximamente»
- Enlace secundario a la sección activa más relevante

| Ruta          | Título                       | Explicación                                                                                                 |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/resultados` | Resultados de evaluaciones   | «Aquí aparecerán las evaluaciones que tu profesional te asigne y sus resultados, una vez revisados con él.» |
| `/sesiones`   | Mis sesiones                 | «El historial de tus sesiones y el material que tu profesional decida compartir contigo.»                   |
| `/recursos`   | Recursos y tareas            | «Lecturas, ejercicios y registros que tu profesional te asigne entre sesiones.»                             |
| `/documentos` | Documentos y consentimientos | «Tus consentimientos firmados, políticas de la consulta y comprobantes.»                                    |

**Nunca** poner una fecha estimada. Una promesa incumplida cuesta más que la ausencia.

---

## 8. Componentes

Base **shadcn/ui**, repintada con los tokens. Se personalizan, no se usan por defecto.

### 8.1 Botones

| Variante    | Fondo          | Texto         | Borde            | Uso                                    |
| ----------- | -------------- | ------------- | ---------------- | -------------------------------------- |
| Primario    | `--brand-600`  | blanco        | —                | Una sola acción principal por pantalla |
| Secundario  | blanco         | `--brand-700` | 1 px `--ink-400` | Acciones alternativas                  |
| Fantasma    | transparente   | `--ink-700`   | —                | Terciarias, barras de herramientas     |
| Destructivo | `--danger-600` | blanco        | —                | Cancelar cita, eliminar cuenta         |

Alturas: `sm` 36 px, `md` 44 px (por defecto), `lg` 52 px. Padding horizontal 20 px. Peso 500.
Hover del primario → `--brand-700`; activo → `--brand-800`; deshabilitado → fondo `--ink-100`, texto `--ink-400`, sin `cursor: not-allowed`.
Todo botón que dispara una operación de red tiene estado de carga con texto propio y queda bloqueado para evitar doble envío.

### 8.2 Campos de formulario

Alto 44 px, borde 1 px `--ink-400`, radio `md`, fondo blanco, texto 16 px (obligatorio: por debajo de 16 px iOS hace zoom al enfocar).
Foco: borde `--brand-600` + anillo `0 0 0 3px rgba(47,73,212,0.15)`.
Error: borde `--danger-600` + mensaje con icono bajo el campo, ligado con `aria-describedby`.
Etiqueta siempre visible arriba, 14 px / peso 500. Campos opcionales marcados «(opcional)» — no marcar los obligatorios con asterisco.

**Selector de fecha y hora:** componente propio sobre la base de shadcn, con entrada por teclado además de por clic. Un selector que solo funciona con ratón excluye a quien usa lector de pantalla y es más lento para todos.

### 8.3 Anillo de foco (global)

`outline: 2px solid var(--brand-600); outline-offset: 2px;` en **todos** los elementos interactivos. Jamás se elimina el `outline` sin un sustituto de contraste equivalente. Sobre fondos oscuros se usa `--brand-200`.

### 8.4 Otros

- **Tarjeta:** blanco, radio `lg`, borde `--ink-200` o sombra `xs` (no ambos), padding 24–32 px.
- **Badge:** 12 px / peso 600, padding 4 × 10 px, radio `sm`.
- **Aviso (alert):** fondo del tono 50, borde izquierdo 3 px del tono 600, icono + título + descripción.
- **Diálogo:** máximo 480 px, radio `xl`, sombra `lg`, overlay `rgba(16,23,64,0.45)` con `backdrop-filter: blur(2px)`. Foco atrapado, cierre con `Esc`, foco devuelto al disparador.
- **Toast:** esquina inferior derecha, para confirmaciones no bloqueantes. Nunca para errores que exigen acción.
- **Chip de cita:** ver §7.4. Es un componente propio, no un badge.

---

## 9. Modelo de dominio

### 9.1 Entidades de v1

| Entidad               | Descripción                                           | Campos clave                                                                                                             |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Profile**           | Datos del usuario, extiende la tabla de autenticación | rol, nombre, apellidos, teléfono, fecha de nacimiento, documento, zona horaria (IANA)                                    |
| **Appointment**       | Cita                                                  | paciente, profesional, inicio (`timestamptz`), fin, modalidad, ubicación o enlace, estado, nota del paciente, creado por |
| **AppointmentChange** | Historial de cambios de una cita                      | cita, estado anterior, estado nuevo, actor, motivo, fecha                                                                |
| **Consent**           | Aceptación de consentimiento                          | usuario, clave de documento, versión, fecha, IP, agente                                                                  |
| **AuditLog**          | Registro de acceso y modificación                     | actor, acción, entidad, id, metadatos, fecha                                                                             |

**Estados de una cita:** `solicitada` → `confirmada` → `realizada`, con salidas `cancelada`, `rechazada`, `no_asistio`, y el estado intermedio `reprogramacion_solicitada`.

Toda hora se almacena en `timestamptz` (UTC) y se presenta en la zona horaria del perfil. Nunca se guarda una hora local sin zona.

`AppointmentChange` y `AuditLog` no son opcionales aunque no tengan interfaz en v1: en un contexto clínico hay que poder responder quién cambió qué y cuándo.

### 9.2 Diferido — módulo de evaluaciones

El instrumento está **por definir**, y podrían incorporarse varias pruebas ahora o más adelante. En v1 no se implementa: la sección es placeholder (§7.6) y no se crean tablas más allá de lo necesario para no bloquear.

Cuando se retome, el diseño previsto es un motor extensible con entidades `Assessment` (plantilla) · `Item` · `Assignment` (asignación con fechas) · `Session` (intento) · `Response` · `Result`, y tipos de ítem intercambiables (`single_choice`, `likert`, `multiple_choice`, `open_text`, `ranking`, `numeric`, `image_choice`) que se renderizan en un mismo marco de sesión. Esa especificación se retomará cuando haya instrumento.

### 9.3 Decisiones pendientes

- [ ] Instrumento(s) de evaluación y su baremación
- [ ] ¿El paciente ve su propio resultado? (se asume que no, sin interpretación profesional)
- [ ] Duración por defecto de una cita y franja horaria de atención
- [ ] Política de cancelación (texto y margen de anticipación)
- [ ] País concreto de ejercicio, para precisar el marco de habeas data
- [ ] Retención de datos: cuánto se conservan y ruta de eliminación

---

## 10. Estados y casos límite

Toda vista debe especificar cuatro estados antes de darse por terminada: **cargando · vacío · error · con datos**.

- **Cargando:** esqueletos (`--ink-100`, pulso 1.5 s) con la forma del contenido real. Sin spinners centrados en página completa.
- **Vacío:** icono + título + una frase + acción si la hay. Nunca un contenedor en blanco.
- **Error:** mensaje en lenguaje llano que dice qué pasó y qué hacer. Sin códigos crudos, sin «Algo salió mal» a secas. Siempre con acción de reintento.
- **Calendario sin citas:** estado vacío con la invitación a solicitar la primera.
- **Cita en el pasado sin cerrar:** se muestra atenuada; solo el profesional puede marcarla como realizada o no asistida.
- **Sesión expirada:** avisar antes de expirar y ofrecer renovar sin perder cambios de formulario.

---

## 11. Accesibilidad — objetivo WCAG 2.2 AA

Es un requisito, no un extra: parte de los pacientes tendrá alguna discapacidad, y una plataforma inaccesible excluye a quien más necesita el acceso.

1. Contraste ≥ 4.5:1 en texto, ≥ 3:1 en bordes de componentes interactivos. Validado en §2.2.
2. Toda funcionalidad operable solo con teclado; orden de tabulación lógico; enlace «Saltar al contenido».
3. Foco visible en todo momento (§8.3).
4. Objetivos de toque ≥ 44 × 44 px. **En el calendario esto obliga a alturas de celda generosas** y es la razón principal de que móvil use vista de agenda.
5. El calendario se anuncia como tabla con encabezados de día; cada cita es un botón con etiqueta accesible completa («Cita confirmada, martes 18 de agosto, 10:00 a 11:00, presencial»), no solo la hora visible.
6. Cambios de mes y de estado anunciados en región `aria-live="polite"`.
7. Errores ligados vía `aria-describedby` y anunciados.
8. Zoom al 200 % sin pérdida de contenido ni desplazamiento horizontal.
9. `prefers-reduced-motion` respetado (§2.6).
10. El color nunca es el único portador de información.
11. Idioma declarado (`lang="es"`).

---

## 12. Responsive

| Punto de quiebre | Ancho        | Comportamiento                                                                       |
| ---------------- | ------------ | ------------------------------------------------------------------------------------ |
| `sm`             | < 640 px     | Columna única, padding 16 px, navegación inferior, **calendario en vista de agenda** |
| `md`             | 640–1023 px  | Columna única, padding 24 px, calendario en vista de semana                          |
| `lg`             | 1024–1279 px | Contenedor máx. 1120 px, barra lateral, calendario con panel lateral                 |
| `xl`             | ≥ 1280 px    | Contenedor máx. 1280 px en calendario, 1120 px en el resto                           |

Contenedor de lectura y de formularios: **máx. 720 px** en todos los tamaños. El calendario es la única vista que aprovecha el ancho completo.

---

## 13. Tono de voz

Claro, respetuoso, en segunda persona («tu próxima cita», «tu solicitud»). Sin jerga clínica hacia el paciente, sin lenguaje motivacional, sin humor.

| En vez de                             | Escribir                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| «¡Genial! 🎉 Cita agendada»           | «Solicitud enviada. Te avisaremos al confirmarla.»                        |
| «Error 422: validation failed»        | «Revisa los campos marcados para continuar»                               |
| «Usuario» (dirigiéndose a la persona) | Su nombre de pila                                                         |
| «No hay datos»                        | «Aún no tienes citas programadas»                                         |
| «Reservar»                            | «Solicitar» — porque no queda reservada hasta que el profesional confirme |

La palabra «paciente» se usa en el área del profesional; hacia la persona se usa su nombre.

---

## 14. Tema oscuro

**Fuera del alcance de v1.** Los tokens se definen desde el principio con la estructura que permite añadirlo (§2.2), pero no se implementa hasta tener el producto estable.

---

## 15. Riesgos y consideraciones abiertas

1. **Legal — habeas data (Latinoamérica).** Los datos de atención psicológica son sensibles bajo las leyes de protección de datos de la región. Requiere autorización expresa del titular, finalidad declarada, política de retención y ruta de acceso, rectificación y supresión. Precisar el país determina requisitos concretos.
2. **Confidencialidad en las notificaciones.** Los correos de cita no deben revelar contenido clínico ni el motivo de consulta. Asunto y cuerpo neutros: fecha, hora y modalidad, nada más. Un correo visible en la pantalla de bloqueo del teléfono no puede exponer que alguien está en terapia.
3. **Zona horaria.** Fuente de errores reales y de citas perdidas. Se decide desde el modelo de datos (§9.1), no al maquetar.
4. **El calendario es más trabajo del que parece.** Vistas múltiples, zonas horarias, estados, accesibilidad y móvil. Es la partida más grande del v1 y conviene no subestimarla al estimar.
5. **Alcance del módulo de evaluaciones.** Cuando llegue el instrumento, puede traer condiciones de administración que impongan restricciones sobre decisiones de interfaz tomadas aquí.

---

## Documentos relacionados

- `docs/PLAN.md` — planeación técnica: stack, modelo de datos, seguridad, orden de construcción
- `docs/design-system.html` — versión visual del sistema de diseño
