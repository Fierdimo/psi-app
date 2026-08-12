# Imágenes de stock — PROVISIONALES

Estas tres imágenes son **marcadores de posición**. Se sustituyen en cuanto
haya fotografía propia del profesional: él en consulta, aplicando una prueba o
dando una formación. Ese es el objetivo; esto es el puente.

## Origen y licencia

Todas provienen de **StockSnap.io** bajo **CC0 1.0** (dominio público): uso
comercial permitido, sin atribución obligatoria y con derecho a modificarlas.
Se localizaron a través de la API pública de Openverse filtrando por `license=cc0`.

| Archivo        | Título original | Origen                                                  |
| -------------- | --------------- | ------------------------------------------------------- |
| `personas.jpg` | Writing Writer  | https://cdn.stocksnap.io/img-thumbs/960w/9QEVP5YHO3.jpg |
| `empresas.jpg` | Team Meeting    | https://cdn.stocksnap.io/img-thumbs/960w/JBW2PXDOL6.jpg |
| `pruebas.jpg`  | Writing Drawing | https://cdn.stocksnap.io/img-thumbs/960w/8Y0EDX4VP9.jpg |

## Por qué estas y no otras

SPEC.md §2.7 prohíbe «el stock de gente sonriendo a la cámara con los brazos
cruzados», y §1.1 rechaza las ilustraciones de personajes redondeados. Las tres
elegidas esquivan ambas cosas: son manos, mesas y entornos de trabajo, sin
retratos posados ni miradas a cámara.

Aun así son stock, y se nota. Por eso se sirven en **duotono azul de marca**
—escala de grises más una capa `--brand-800` en `mix-blend-color`—: unificadas
con la paleta pesan como textura de fondo y no como fotografía protagonista,
que es exactamente el papel que deben tener mientras sean provisionales.

## Al sustituirlas

Basta con dejar el archivo propio con el mismo nombre en esta carpeta. Si la
foto propia es buena, conviene además **quitarle el duotono** en
`componente ImagenSeccion` de `src/app/(publico)/page.tsx`: el tratamiento
existe para disimular que la imagen es genérica, y una foto real no necesita
disimulo.
