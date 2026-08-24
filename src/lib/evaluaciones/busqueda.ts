/**
 * Qué se mira al buscar una evaluación.
 *
 * Vive aparte porque lo usan DOS pantallas —el listado y su vista de
 * impresión— y tienen que buscar lo mismo o el PDF no coincidiría con lo que
 * había en la pantalla de la que salió. Que el papel diga otra cosa que la
 * pantalla es peor que no poder imprimir.
 *
 * Lo compartido es esto y no la consulta entera: el `select` tiene que ser una
 * cadena literal o el comprobador de tipos de la biblioteca no puede deducir
 * la forma de lo que vuelve.
 *
 * Se busca por lo que se recuerda de alguien: un nombre a medias, un apellido,
 * la cédula, el correo por el que se le mandó el enlace.
 */
export function filtroDeBusqueda(busqueda: string): string | null {
  const limpia = busqueda.trim();
  if (!limpia) return null;

  return [
    `nombre.ilike.%${limpia}%`,
    `apellidos.ilike.%${limpia}%`,
    `documento.ilike.%${limpia}%`,
    `email.ilike.%${limpia}%`,
  ].join(",");
}
