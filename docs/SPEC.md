# Psi — Especificación de Diseño y Producto

> **Estado:** v0.3 · **Fecha:** 2026-08-12 · **Implementado**
> **Alcance:** diseño (sistema visual completo) + producto (roles, flujos, pantallas, estados).
> **Marca:** «JBR Psicometrías», la consulta de Jesús Banquez Ramírez, psicólogo
> organizacional. Se resuelve por un único token de marca — ver §2.4.
>
> **Historial**
>
> - **v0.1** — plataforma centrada en pruebas psicotécnicas.
> - **v0.2** — el v1 pasa a **portal del paciente** con el calendario como
>   funcionalidad central; el módulo de evaluaciones queda diferido.
> - **v0.3** — este documento pasa de propuesta a **descripción de lo
>   construido**. Los tonos de texto se rehacen sobre la familia azul
>   institucional (§2.2) tras comprobar que los grises azulados se leían como
>   negro en pantalla.
>
> Lo que sigue marcado como pendiente lo está de verdad: ver §9.3 y §15.

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

- El texto más oscuro de la app es `--ink-900` = `#092096`, un azul saturado de la familia institucional.
- El fondo más oscuro (tema oscuro, footer, hero) es `--brand-950` = `#101740`.
- Las sombras usan RGBA derivado de `--brand-950`, nunca de negro.

**«Nunca negro» no se cumple sobre el papel, se cumple a la vista.** Se
probaron dos valores —`#16233A` y `#233657`— con sesgo azul suficiente para
pasar cualquier comprobación automática. Los dos se leían como negro. Si hay
que medir un color para saber que no es negro, la regla no se está cumpliendo.

Por eso los tres tonos de texto salen ahora de la **familia azul institucional**
y no de una escala de grises azulados: el canal azul queda entre 62 y 141 puntos
por encima del rojo. El tinte no se intuye, se ve.

El título usa un azul saturado y el cuerpo baja la saturación a propósito: un
párrafo largo en el azul del título cansa la vista, mientras que el título lo
aguanta porque son pocas palabras que se leen de un vistazo.

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
| `--ink-900`    | `#092096` | Texto principal, títulos                                | 12.66 : 1 · AAA            |
| `--ink-700`    | `#25378C` | Texto de cuerpo secundario                              | 10.48 : 1 · AAA            |
| `--ink-500`    | `#5E6C9C` | Texto atenuado, etiquetas, ayuda                        | 5.12 : 1 · AA              |
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

El nombre se renderiza como **wordmark tipográfico**: «JBR Psicometrías» en Inter 600, `--brand-800`, tracking −0.02em, acompañado de la **marca real de la consulta** (`/marca/jbr-marca.png`): un perfil humano trazado como red de nodos, en el mismo azul que `--brand-600`. Sobre fondos oscuros no existe versión clara del archivo y se invierte por filtro; al ser una marca de un solo color, la inversión da blanco limpio.

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

**Excepción: la landing pública (`/`).** Dentro de la aplicación el movimiento solo orienta; en la landing además persuade, y por eso ahí sí se permiten revelados al hacer scroll, entrada escalonada y un desplazamiento propio del retrato. La excepción es de superficie, no de criterio, y se acota así:

- Vale **solo en `/`**. Ninguna pantalla del paciente ni del profesional la hereda.
- `prefers-reduced-motion: reduce` sigue apagándolo **todo**, no atenuándolo.
- Sigue sin haber bucles: cada animación termina y se queda quieta.
- El movimiento nunca retrasa la lectura: entradas de 400 ms como máximo, escalonados de 60 ms.
- Se implementa con `motion`, la única dependencia de animación del proyecto, y solo en `src/components/landing/`.

**La red de nodos del hero** es la única animación continua de todo el producto, y existe por una razón concreta: la marca de la consulta es un perfil humano trazado como red de nodos y su promesa es «mediciones y evaluaciones». El fondo del hero es esa misma metáfora en movimiento, no un efecto de catálogo. Se pinta en canvas, lee sus colores de los tokens en tiempo de ejecución, vive detrás del contenido, se detiene cuando sale de pantalla y con `prefers-reduced-motion` pinta un solo cuadro y para. El puntero **repele** los nodos: atraerlos los apelmaza en el cursor y destruye la red a los pocos segundos.

**El movimiento nunca es condición para ver el contenido.** La landing se lee entera sin JavaScript, y hay una prueba que lo comprueba (`auth.spec.ts`, «sin JavaScript»). De ahí salen dos reglas de implementación:

- Las animaciones de **entrada** van en CSS (`.entrada` en `globals.css`), no en JavaScript. Una animación de montaje en JS obliga a servir el bloque en `opacity: 0`, y basta con que el guion no llegue a ejecutarse para que la página aparezca en blanco con el texto dentro del HTML.
- Los **revelados al hacer scroll** salen del servidor visibles (`initial={false}`) y solo se esconden después, ya en el cliente, y únicamente si están por debajo del pliegue.

Se aprendió por las malas: al servir el sitio por un túnel de desarrollo, `next dev` rechazó las peticiones de su propio bundle por venir de otro host, el guion no corrió y la landing salió en blanco. Por eso `next.config.ts` declara además `allowedDevOrigins`.

### 2.7 Iconografía e imagen

- **Iconos:** Lucide, trazo 1.5 px, tamaño 20 px (24 px en navegación). Color heredado del texto, nunca azul salvo que sean accionables.
- **Fotografía:** si se usa, retratos reales en contexto profesional, tratamiento natural. Prohibido el stock de gente sonriendo a la cámara con los brazos cruzados. La landing usa un retrato recortado del propio profesional (`/retrato-jbr.png`) sobre un panel `--brand-50`; la regla del stock no le aplica porque no es un modelo, es él. Del material del sitio anterior se descartaron las ilustraciones de personajes y las fotos de equipos genéricos, que sí caían de lleno en los antipatrones de §1.1.
- **Ilustración:** solo geométrica y abstracta, en tonos de marca, con moderación. Sin personajes.
- **Cero emojis** en la interfaz de producto.

---

## 3. Usuarios y roles

| Rol             | Quién es                                     | Entra por      | Qué puede hacer en v1                                                                                                                              |
| --------------- | -------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paciente**    | Persona que crea su cuenta y recibe atención | `/ingresar`    | Registrarse, editar sus datos, ver su calendario, **solicitar** cita, solicitar reprogramación, cancelar, ver las secciones placeholder            |
| **Profesional** | El psicólogo titular de la plataforma        | `/profesional` | Ver la agenda completa, **autorizar o rechazar** solicitudes, crear citas, reprogramar, cerrar citas como realizadas o no asistidas, ver pacientes |

### 3.1 Los dos roles que entran en v2

La consulta vende dos cosas distintas, y hasta v1 la plataforma solo servía a una. En v2 entran dos actores más:

| Rol          | Quién es                                       | Qué puede hacer                                                                                                                          |
| ------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Empresa**  | Organización cliente que contrata evaluaciones | Registrarse, dar de alta a sus empleados, **solicitar** una cita de evaluación para varios, y ver los informes que el profesional libere |
| **Empleado** | Persona evaluada por encargo de una empresa    | Aceptar su consentimiento, responder la prueba y ver su propio informe                                                                   |

**Un empleado no es un paciente**, y la diferencia no es terminológica: no hay relación clínica, no pide cita —se la agenda su empresa—, y su informe tiene un segundo destinatario. Por eso son roles separados y no un paciente con una etiqueta.

La asimetría fundacional se conserva en las dos ramas: la empresa _pide_, el profesional _autoriza_; y ningún informe llega a nadie —ni al empleado ni a la empresa— hasta que el profesional lo revisa y lo publica.

### 3.2 La relación

La distinción no es de jerarquía sino de **naturaleza de la relación**: quien recibe la atención _pide_, el profesional _autoriza_. Ninguna acción del paciente produce un hecho por sí sola — una cita no existe como compromiso hasta que el profesional la confirma. Esto se refleja en el modelo de estados (§9.1), en el lenguaje de la interfaz (§13: «solicitar», nunca «reservar») y en las entradas separadas (§5.1).

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

### 4.3.1 Las dos áreas nuevas son espacios de trabajo, no bandejas

Ni la empresa ni el profesional entran a «aprobar cosas». Entran a trabajar, y su área tiene que parecerlo desde el primer día: el mapa completo a la vista, con las secciones que aún no existen **atenuadas y explicadas**, igual que ya se hace con el paciente (§7.6).

Enseñar el mapa entero desde el principio genera más confianza que revelarlo por partes. Quien entra entiende hacia dónde va la plataforma y no se pregunta si le falta algo que otros sí tienen. Lo que **no** se hace nunca es simular: un placeholder dice qué vivirá ahí y por qué todavía no está, sin fechas y sin botones que no hacen nada.

#### Área de la empresa (`/empresa`)

| Sección     | Ruta                   | Estado    | Qué hace                                                             |
| ----------- | ---------------------- | --------- | -------------------------------------------------------------------- |
| Inicio      | `/empresa`             | real      | Próxima sesión, personal cargado, solicitudes a la espera            |
| Personal    | `/empresa/personal`    | real      | Su listado de personas: cargar, corregir, ver quién ya tiene cuenta  |
| Sesiones    | `/empresa/sesiones`    | real      | Solicitar evaluación, ver estado y historial                         |
| Informes    | `/empresa/informes`    | pendiente | Los resultados que el profesional publique de su gente               |
| Facturación | `/empresa/facturacion` | pendiente | Comprobantes de lo pagado. El pago se acuerda fuera de la plataforma |
| Datos       | `/empresa/datos`       | real      | Nombre, NIT y canal de contacto por donde se tramita                 |

#### Área del profesional (`/profesional`)

Crece de dos secciones a seis. Las dos que existían siguen siendo el centro del día a día.

| Sección      | Ruta                        | Estado    | Qué hace                                                        |
| ------------ | --------------------------- | --------- | --------------------------------------------------------------- |
| Agenda       | `/profesional/agenda`       | real      | Calendario y bandeja de solicitudes, individuales y de empresa  |
| Pacientes    | `/profesional/pacientes`    | real      | Personas atendidas individualmente                              |
| Empresas     | `/profesional/empresas`     | real      | Organizaciones cliente, su gente y sus sesiones                 |
| Evaluaciones | `/profesional/evaluaciones` | pendiente | Instrumentos, asignaciones y revisión de resultados             |
| Documentos   | `/profesional/documentos`   | pendiente | Certificados e informes emitidos                                |
| La consulta  | `/profesional/consulta`     | real      | Horario de atención, duración por defecto y anticipación mínima |

### 4.4 Área del profesional — v1 mínima

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

Estructura: encabezado fijo con wordmark, navegación por anclas y «Entrar» → sección principal con el nombre del profesional, su especialidad y una llamada clara → sobre mí → para personas → cómo funciona la plataforma en tres pasos → nota de confidencialidad → para empresas → pruebas y evaluaciones → contacto → pie con enlaces legales y datos de contacto.

**Es una sola página.** Las únicas rutas públicas además de `/` son las tres legales, así que el catálogo completo de la consulta vive en la landing y se navega por anclas. La landing no enlaza a nada que no exista.

La consulta tiene dos mitades y solo una pasa por la plataforma. El acompañamiento a personas (acompañamiento psicológico, riesgo psicosocial, acoso y conflicto, burnout, coaching y desarrollo profesional) termina en «Crear cuenta». Los servicios a empresas (selección, evaluación psicotécnica, estudios de confiabilidad, formación y desarrollo, ofertas de empleo) y las pruebas psicométricas no generan paciente ni cita: sus bloques rematan en WhatsApp y correo, nunca en registro.

Cada servicio se renderiza con el mismo componente: tarjeta con título, descripción, fichas opcionales y una línea de beneficios opcional. El detalle del catálogo es contenido, no adorno — es lo que distingue a esta consulta de una tarjeta de presentación. Los inventarios largos van como fichas y no como viñetas: veintiséis puntos en lista leen como un acta; en fichas leen como un repertorio.

**El hero declara la bifurcación antes que el catálogo.** A la izquierda, nombre y credenciales; a la derecha, el retrato. Debajo, dos tarjetas —«Eres una persona» y «Eres una empresa»— que separan las dos puertas desde el primer pantallazo. Quien llega buscando una consultoría no debería tener que leer sobre citas para descubrir que se equivocó de camino.

**Ritmo de bandas.** El fondo alterna `--surface-0`, `--surface-50` y `--brand-50`, con dos momentos en `--brand-800`: las credenciales, justo bajo el hero, y la confidencialidad. Una landing de una sola pieza necesita que cada sección se anuncie sola; por eso todas llevan antetítulo en `--accent`.

- Sin testimonios de pacientes. Además de éticamente delicado en psicología, resta credibilidad.
- Sin precios. Los del catálogo de empresa se negocian por volumen; publicarlos aquí crearía una segunda fuente de verdad.
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

### 9.2 Módulo de evaluaciones — v2

**Alcance: evaluación por encargo de una empresa.** El instrumento con el que arranca el módulo —DISC más dominancia cerebral— es una prueba de selección y desarrollo de personal, y se aplica a empleados y candidatos por cuenta de una organización. La atención individual sigue existiendo, pero **no comparte este circuito**: un paciente pide su cita y recibe acompañamiento; un empleado no pide nada, lo agenda su empresa.

#### El circuito corporativo

```
1. La empresa se registra y da de alta a sus empleados
2. Solicita una cita de evaluación para varios de ellos
3. El profesional resuelve el trámite —pago u otro— POR FUERA de la plataforma
4. Confirma la cita — y por sí solo eso NO envía nada
5. Emite las invitaciones cuando decide que ya pueden empezar
6. El empleado crea su cuenta y acepta SU consentimiento
7. El día de la cita: parte presencial, y el profesional abre el examen en línea
8. El empleado responde; el sistema califica
9. El profesional revisa, redacta y publica
10. El informe queda disponible para el empleado Y para la empresa
```

Tres candados en ese circuito, y ninguno es opcional:

**El consentimiento lo firma el empleado, no su empresa.** Sin aceptación registrada no se abre el examen. El titular del dato es quien lo acepta, y tiene que poder negarse: la opción de rechazar existe y no es decorativa.

**El examen lo abre el profesional durante la sesión.** No basta con que sea el día de la cita: queda bloqueado hasta que él lo habilita. Así se garantiza que la parte presencial ocurrió antes y que la prueba se respondió bajo supervisión, que es lo que da valor al informe.

**Nada sale de la plataforma sin que el profesional lo mande.** Son tres actos suyos y distintos, y no se funden en uno por comodidad: **confirmar** dice «acepto la sesión»; **emitir las invitaciones** dice «ya pueden crear su cuenta»; y **abrir el examen**, durante la sesión presencial, dice «pueden empezar a responder». Confirmar una fecha no debe hacer que a nadie le llegue un correo, porque entre una cosa y otra suele faltar el trámite. Hay una prueba que lo afirma: tras confirmar, la tabla de invitaciones sigue vacía.

**Una solicitud corporativa no se confirma sola.** Entre que la empresa pide y el profesional confirma hay un trámite —el pago, normalmente— que ocurre fuera de la plataforma. Por eso una empresa **no existe sin un canal de contacto**: se le exige un correo o un teléfono al registrarse, porque sin él su solicitud se queda muerta en la bandeja y nadie puede resolverla.

**Nada se publica solo.** El sistema califica en cuanto el empleado envía, pero el informe no existe para nadie hasta que el profesional lo revisa y lo firma.

#### El pago llega tarde y la fecha se pasa

Es el caso normal, no la excepción: la empresa propone el 20, el trámite tarda, el pago entra el 25. **No se confirma una sesión cuya fecha ya pasó** — confirmarla dejaría una sesión «confirmada» en el pasado y las invitaciones convocarían a diez personas a algo que ocurrió la semana anterior.

La salida no es rechazar y pedirle a la empresa que vuelva a empezar, porque eso pierde la solicitud y su historial. El profesional **reagenda la solicitud** a la fecha que acuerde por teléfono o correo —para eso una empresa no existe sin canal de contacto— y confirma después. La solicitud es la misma; solo cambió su fecha, y el cambio queda registrado.

Una solicitud pendiente cuya fecha ya pasó no es un error del sistema: es lo que el paso del tiempo produce solo mientras se espera un pago. La interfaz del profesional debe mostrarla como lo que es —vencida y a la espera de nueva fecha—, no esconderla.

#### Quién ve qué

|                                        | Empleado | Empresa | Profesional |
| -------------------------------------- | -------- | ------- | ----------- |
| Sus propias respuestas                 | ✓        | —       | ✓           |
| Su informe completo, una vez publicado | ✓        | ✓       | ✓           |
| Informes de sus compañeros             | —        | ✓       | ✓           |
| Empleados de otra empresa              | —        | —       | ✓           |

#### Lo que este módulo NO es

La plataforma **no le da a una empresa un espacio para buscar, gestionar o hacer seguimiento de su gente**. No es un sistema de recursos humanos, ni una base de talento, ni un embudo de selección. Es una consulta de psicología que aplica evaluaciones.

El listado de personas existe con un único propósito instrumental: **poder convocar a alguien a una sesión**. Que persista entre sesiones es comodidad —volver a cargar cien personas cada vez sería absurdo—, no una invitación a usarlo como registro de personal. De ahí que no haya ni filtros, ni estados de proceso, ni historial de contrataciones, ni nada que convierta la lista en una herramienta de gestión. Si algún día se pide, la respuesta es que eso es otro producto.

Es un límite de los que se cruzan solos, una función pequeña cada vez.

#### Aspirantes, no solo empleados

Buena parte de las evaluaciones **no son para gente que trabaja en la empresa**, sino para candidatos a un puesto. Llamarles «personal» sería afirmar un vínculo laboral que no existe y puede que nunca exista.

Por eso la interfaz habla de **personas a evaluar**, y cada una lleva su vínculo —aspirante o empleado—, que no está ahí para gestionar plantillas sino porque cambia tres cosas concretas:

- **El consentimiento.** Uno para un proceso de selección dice cosas que no valen para una evaluación de desarrollo interno.
- **El encabezado del informe.** El del propio profesional titula «cargo al que aspira», que no es el cargo que alguien ocupa.
- **La lectura del resultado.** Se interpreta distinto si la persona opta a un puesto o si lleva tres años en él.

Por defecto, **aspirante**: es el caso más frecuente y el error menos dañino de los dos. Tratar a un empleado como candidato produce un informe algo desenfocado; tratar a un candidato como empleado afirma algo falso sobre su vida laboral.

#### La cédula es la identidad; el correo es un canal

**Se pide al crear la cuenta, y es obligatoria.** Antes solo lo era dentro del listado de una empresa, así que quien se registraba por su cuenta nunca la aportaba: la cédula servía para reconocer a alguien entre empresas pero no estaba garantizada en la plataforma. Ahora toda persona queda identificada desde el primer momento.

Es un campo de texto libre —cédula, tarjeta de identidad, cédula de extranjería, pasaporte, permiso— y no un desplegable de tipos, que dejaría fuera a quien no encaje en la lista. Quien evalúa personal operativo se topa con todas esas variantes.

**Un documento ya registrado no se confirma.** La tentación es decir «ya existe una cuenta con ese documento» para que la persona entienda qué pasa, y se rechaza por la misma razón que el ingreso da un único mensaje ante un correo inexistente y ante una contraseña mala: las cédulas son enumerables, y confirmarlo convertiría el registro en un detector de pacientes de una consulta de psicología. El mensaje ofrece la salida —entrar o recuperar la contraseña— sin decir qué dato chocó.

Una persona se identifica por su **documento de identidad**, y por eso es obligatorio al cargarla. El correo no sirve para reconocerla: una empresa la carga con el corporativo y otra con el personal, y sin un dato estable el sistema vería dos personas donde hay una. Al invitarla se le crearía una segunda cuenta y su historial quedaría partido en dos.

Una misma cédula **no puede repetirse dentro de una empresa** —aunque cambie el correo— y **sí puede aparecer en dos empresas distintas**, porque esa es exactamente la persona evaluada por las dos.

#### Cancelar una cita no retira lo ya evaluado

La evaluación se paga antes de aplicarse: no hay forma de llegar a la sesión sin que el trámite esté resuelto. En consecuencia, si una empresa cancela a mitad de camino y alguien ya respondió, **su informe se produce y se entrega igual**. Lo contrario dejaría a la persona sin el resultado de una prueba que sí hizo, y a la empresa sin aquello por lo que ya pagó.

La cancelación afecta a lo que no ha ocurrido, nunca a lo que ya ocurrió.

#### El informe no caduca con el empleo

Lo que una empresa encargó sigue siendo suyo aunque la persona deje de trabajar allí. No es una concesión: la plataforma **no sabe ni sabrá** si alguien sigue vinculado a una empresa, y fingir que lo controla sería peor que no hacerlo. La evaluación la pagó esa empresa y su acceso no se revoca por un cambio de trabajo que nadie nos comunica.

Distinto sería que la empresa pidiera **borrar** ese informe, que es una petición sobre el dato y no sobre el vínculo.

#### La misma persona, evaluada por dos empresas

El caso que decide si el modelo sirve, y por el que existe una prueba dedicada:

> Acme evalúa a una persona. Tiempo después, Globex quiere contratar a esa misma persona y encarga su propia evaluación.

Lo correcto es esto, y no admite matices:

- **Globex ve lo que encargó**, y nada de lo que hizo Acme.
- **Acme no se entera** de que su antiguo evaluado está en un proceso con la competencia. Es la filtración menos obvia y la más dañina para la persona: podría costarle el empleo actual.
- **La persona ve las dos cosas**, porque las dos son suyas.

Esto funciona porque el acceso de una empresa nace de **la evaluación que encargó** y no de quién es el evaluado. Si la pertenencia viviera en el perfil de la persona —como estuvo escrito un día—, este caso sería irrepresentable: alguien solo puede pertenecer a una empresa a la vez.

**La empresa ve el informe individual completo de cada empleado que contrató evaluar.** Es lo que su consentimiento declara y lo que el negocio requiere. Precisamente por eso el consentimiento debe decirlo con todas las letras antes de la primera pregunta, y por eso el aislamiento entre organizaciones es el punto de RLS más delicado de toda la plataforma: un fallo ahí expone resultados psicológicos de personas identificadas a una empresa que no las contrató.

#### La regla que gobierna el módulo

**Ningún resultado llega al paciente sin que el profesional lo revise y lo autorice.** Es la misma asimetría que rige las citas —el paciente pide, el profesional autoriza— aplicada al dato más delicado de la plataforma. Una puntuación cruda sin lectura profesional no informa: desinforma.

De ahí que la calificación y la publicación sean **dos actos separados**. El sistema califica solo, en cuanto el paciente envía; el profesional revisa, escribe su interpretación, adjunta los certificados que correspondan y solo entonces publica. Hasta ese momento el resultado existe, pero para el paciente no.

#### Ciclo de vida de una asignación

```
asignada → en_curso → enviada → calificada → publicada
                ↓                     ↑
             vencida              (la calificación es automática;
                                   la publicación NO)
```

`anulada` es alcanzable desde cualquier estado previo a `publicada`. Volver a aplicar una prueba no reabre la asignación: se asigna otra vez, y el historial conserva las dos.

#### Motor extensible

Un instrumento se compone de dos mitades: **sus ítems son datos** y **su calificación es código**.

Los ítems, sus opciones y su orden viven en tablas, de modo que un único ejecutor de sesión dibuja cualquier prueba y no se escribe interfaz nueva por instrumento. Los tipos previstos son `single_choice`, `likert`, `multiple_choice`, `open_text`, `ranking`, `numeric`, `image_choice` y **`forced_choice`** —elegir dentro de un bloque la que MÁS y la que MENOS describe—, que es el formato ipsativo que usan los instrumentos tipo DISC y que la versión anterior de este spec no contemplaba.

La calificación, en cambio, es un módulo que implementa `MotorDePrueba` y se registra por clave; la plantilla guarda cuál le toca. Se decidió así tras descartar la alternativa: expresar la baremación como reglas en datos funciona mientras solo haya que sumar por escala, pero un instrumento con elección forzada, segmentos y tabla de patrones acaba obligando a inventar un lenguaje de programación en JSON. Un módulo por instrumento se lee y se prueba.

**La calificación corre solo en el servidor.** Si el algoritmo viajara al navegador quedaría público, y quien responde podría orientar sus respuestas hacia el perfil que le convenga. Para una consulta que vende evaluación, esa lógica es el producto.

#### Un resultado no es una puntuación: es un conjunto de parámetros

Cada instrumento **declara sus propios parámetros**, en número y naturaleza libres. Uno puede tener cuatro escalas numéricas; otro, dos categorías y un texto; otro, catorce apartados. La plataforma no presupone ninguna forma.

Un parámetro tiene un tipo —numérico, escala, categoría o texto— y una marca de si **admite texto del profesional**. Esto último es lo que separa este módulo de un corrector automático: hay parámetros que la máquina calcula, hay parámetros que solo el profesional puede redactar, y hay parámetros donde conviven los dos.

El reparto de trabajo es siempre el mismo: **el motor propone, el profesional dispone.** El motor calcula los valores y, cuando el instrumento trae textos normalizados, sugiere su redacción. En la pantalla de revisión el profesional los ve ya rellenos y puede corregirlos, ampliarlos o sustituirlos por completo antes de publicar. Lo que se publica es siempre lo que él firmó, no lo que salió del algoritmo.

Que los parámetros sean filas y no un bloque opaco tiene un segundo beneficio, y es clínico: permite mirar un mismo parámetro a lo largo del tiempo cuando una prueba se aplica más de una vez.

#### Pantallas

**Profesional**

| Ruta                          | Qué hace                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/profesional/pruebas`        | Catálogo de instrumentos disponibles y asignaciones en curso                                           |
| `/profesional/pacientes/[id]` | Gana un bloque de evaluaciones: asignar, ver estado, entrar a revisar                                  |
| `/profesional/pruebas/[id]`   | Revisión: respuestas, puntuaciones, interpretación del motor, nota propia, certificados y **publicar** |

**Paciente**

| Ruta               | Qué hace                                                                              |
| ------------------ | ------------------------------------------------------------------------------------- |
| `/resultados`      | Deja de ser placeholder: sus pruebas con estado real                                  |
| `/resultados/[id]` | Ejecutor de la sesión, o el resultado publicado si ya lo está                         |
| `/documentos`      | Deja de ser placeholder: los certificados e informes que el profesional haya liberado |

El ejecutor muestra un ítem o un bloque cada vez, con progreso visible y **autoguardado en cada respuesta**: perder veintiocho respuestas por una caída de red es perder la prueba entera. Al volver, se retoma donde se dejó.

#### Honestidad de los estados

Igual que una cita pendiente no se disfraza de confirmada, una prueba enviada no se disfraza de disponible. El paciente ve «Enviada · pendiente de revisión», y nada sugiere que pueda consultar algo que su profesional aún no ha leído. Si una asignación vence sin enviarse, lo dice.

#### Consentimiento

La evaluación psicométrica necesita **su propio consentimiento**, distinto del de atención: para qué se aplica, quién verá los resultados y cuánto se conservan. Se acepta antes de la primera prueba, no en el alta.

### 9.3 Decisiones pendientes

- [ ] Instrumento(s) de evaluación y su baremación
- [x] **¿El paciente ve su propio resultado?** Sí, pero **solo tras revisión y autorización expresa del profesional**, junto con los certificados que correspondan. Ver §9.2.
- [x] **¿Candidatos de empresa?** **Sí, y son el caso principal del módulo.** La plataforma se orienta a la asesoría corporativa —evaluación técnica y de empleabilidad por encargo de una organización— sin perder la atención individual, que se reenfoca hacia la mejora del perfil laboral. Ver §9.2.
- [x] **¿Qué ve la empresa?** El **informe individual completo** de cada empleado que mandó evaluar, una vez publicado por el profesional.
- [x] **¿Cómo entra el empleado?** Cuenta propia por invitación al correo. Es la única forma de que acepte un consentimiento verificable y de que el informe le pertenezca de verdad.
- [x] **¿Cuándo se abre el examen?** Lo habilita el profesional durante la sesión presencial. No se abre solo por llegar la fecha.
- [ ] **Licencia del instrumento.** Los ítems y las tablas de interpretación de una edición comercial suelen estar licenciados, aunque el modelo subyacente sea de dominio público. Aplicarlo por un formulario no es lo mismo que servirlo desde una plataforma propia. **Bloquea cargar el contenido real de la prueba**, no el diseño del motor.
- [ ] ¿Puede el paciente subir documentos, o el flujo es solo profesional → paciente? Se asume lo segundo mientras no se diga otra cosa.
- [x] **¿Cómo se reconoce que dos fichas son la misma persona?** Por su **documento de identidad**, que pasa a ser obligatorio en el listado y único por empresa. El correo queda como canal de invitación, no como identidad.
- [ ] Falta la otra mitad: que quien **ya tiene cuenta** pueda aceptar una invitación **con esa cuenta** en vez de crear otra. Se resuelve al construir las invitaciones.
- [ ] ¿El informe de resultados se descarga en PDF? Si sí, hay que rehacer su diseño: el actual usa rojo, verde y cian, ajenos a la paleta.
- [x] **¿Entran pruebas de rendimiento?** Todavía no se aplican, pero **el modelo las contempla desde el primer día**: `assessments.kind` distingue inventario de prueba de rendimiento, y existen `time_limit_seconds` y la clave de corrección del ítem aunque hoy vayan siempre vacíos. Reservar el sitio cuesta tres columnas; añadirlas con el esquema poblado cuesta una migración con datos clínicos dentro.
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
