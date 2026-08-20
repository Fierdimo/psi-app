import { ChevronDown, Users } from "lucide-react";

import { nombreConvocado, type PersonaConvocada } from "@/lib/citas/estados";

/**
 * Las personas convocadas a una sesión de evaluación.
 *
 * Van DENTRO de la solicitud de su empresa y no como entradas sueltas en la
 * bandeja. La sesión es un solo compromiso —una fecha, una sala, una
 * confirmación— y partirla en quince solicitudes obligaría a aceptar quince
 * veces lo mismo y perdería la única pregunta que importa: ¿acepto esta sesión?
 *
 * Es también la forma que tendrá la asignación de la prueba: un acto sobre la
 * sesión, que alcanza a todos los convocados, y no quince asignaciones iguales
 * hechas a mano.
 */
export function Convocados({
  personas,
  compacto = false,
  /**
   * Plegado: se ve cuántos son y se despliega quiénes.
   *
   * En la bandeja, junto al calendario, el listado completo ocupaba más que
   * todo lo demás de la tarjeta y enterraba la fecha y los botones, que es lo
   * que se mira para decidir. Para aceptar una sesión basta con saber a
   * cuántos alcanza; quién es cada uno se consulta cuando hace falta.
   *
   * Se usa `<details>`: funciona sin JavaScript, el teclado lo maneja solo y
   * el buscador del navegador encuentra dentro. Un desplegable propio sería
   * más código y peor comportamiento.
   */
  plegable = false,
  /**
   * Desplegado de entrada, pero plegable.
   *
   * En el detalle de la sesión se entra precisamente a ver a quién se
   * convocó, así que empieza abierto; pero con quince personas la lista
   * empujaba los botones de acción fuera de la pantalla, y en el panel
   * lateral eso los deja invisibles. Abierto, con tope de alto y su propio
   * desplazamiento, y con la opción de plegarlo.
   */
  abierto = false,
}: {
  personas: PersonaConvocada[];
  /** Sin encabezado ni recuadro, para usarlo dentro de una tarjeta ya densa. */
  compacto?: boolean;
  plegable?: boolean;
  abierto?: boolean;
}) {
  if (personas.length === 0) {
    return (
      <p className="text-text-muted text-sm">
        Sin personas convocadas todavía.
      </p>
    );
  }

  /*
   * El vínculo deja de contarse aquí.
   *
   * «2 personas · 1 aspirante» servía cuando empleado y aspirante recibían
   * tratos distintos. Ya no: la evaluación es de la convocatoria y llega igual
   * a todos, así que el dato solo añadía una cifra que nadie usa para decidir.
   */
  const resumen = (
    <>
      <Users aria-hidden="true" className="size-4 shrink-0" />
      {personas.length}{" "}
      {personas.length === 1 ? "persona convocada" : "personas convocadas"}
    </>
  );

  /*
   * El listado nunca crece sin límite.
   *
   * Con más de cinco o seis personas ocupaba toda la altura disponible y lo
   * que venía DEBAJO —los botones de confirmar, de asignar— quedaba fuera de
   * la vista sin que nada indicara que estaba ahí. Un tope con desplazamiento
   * propio deja el listado completo accesible y la acción a la vista.
   */
  const listado = (
    <ul className="border-line divide-line max-h-72 divide-y overflow-y-auto overscroll-contain rounded-md border">
      {/*
        COLUMNAS FIJAS, no `flex-wrap`.

        Con envoltura, cada fila se partía por un sitio distinto según lo largo
        que fuera el nombre: en un panel estrecho el documento saltaba de línea
        en unas filas y en otras no, y la lista dejaba de leerse de un vistazo.
        Una rejilla de anchos fijos mantiene las columnas en su sitio y recorta
        el nombre, que es lo único que puede crecer sin límite.
      */}
      {personas.map((p) => (
        <li
          key={p.documento}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 text-sm"
        >
          <span className="text-text-strong truncate font-medium">
            {nombreConvocado(p)}
            {p.cargo && (
              <span className="text-text-muted font-normal"> · {p.cargo}</span>
            )}
          </span>
          <span className="text-text-muted tabular">{p.documento}</span>
        </li>
      ))}
    </ul>
  );

  if (plegable) {
    return (
      <details open={abierto} className="group flex flex-col gap-2">
        <summary className="text-text-muted hover:text-text-body ease-psi flex cursor-pointer list-none items-center gap-1.5 text-sm transition-colors duration-150">
          {resumen}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
          <span className="text-accent-on-soft ml-auto text-sm font-medium">
            <span className="group-open:hidden">Ver</span>
            <span className="hidden group-open:inline">Ocultar</span>
          </span>
        </summary>
        <div className="pt-2">{listado}</div>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!compacto && (
        <p className="text-text-muted flex items-center gap-1.5 text-sm">
          {resumen}
        </p>
      )}
      {listado}
    </div>
  );
}
