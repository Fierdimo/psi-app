import { redirect } from "next/navigation";

/**
 * El formulario se mudó a `/solicitar-cita`.
 *
 * Vivía en `/calendario/solicitar`, es decir en el mismo espacio de nombres
 * que los identificadores de cita —`/calendario/[id]`—. Mientras no hubo
 * panel lateral daba igual; con la ruta interceptada dejó de darlo: el hueco
 * del panel tomaba «solicitar» por un identificador, respondía 404 y, como
 * toda intercepción congela el contenido principal, la pantalla se quedaba
 * en el calendario. El botón parecía no hacer nada.
 *
 * Ponerle un tope al interceptor no arregla eso: basta con que ALGO case para
 * que la navegación se considere interceptada. La solución es que no case,
 * y para eso la ruta tiene que salir de ahí.
 *
 * Esta redirección se queda para los enlaces viejos. Solo la alcanza una
 * navegación completa, que no pasa por la intercepción.
 */
export default function SolicitarLegado() {
  redirect("/solicitar-cita");
}
