import { ContenidoNuevaEvaluacion } from "@/app/empresa/evaluaciones/nueva/page";
import { ModalAncho } from "@/components/navegacion/modal-ancho";

/**
 * Encargar una evaluación, como modal.
 *
 * ESTA RUTA NO ES UN ADORNO: sin ella el botón no hacía nada. Existe
 * `(.)evaluaciones/[id]` para abrir una evaluación, y Next hace encajar
 * «nueva» en ese `[id]` — intercepta la navegación, deja el listado donde
 * estaba y pinta el hueco del panel con lo que devuelva esa ruta. Como allí se
 * comprueba que el segmento sea un identificador, no devolvía nada: la
 * dirección cambiaba y en pantalla no pasaba nada.
 *
 * Con una ruta propia gana la más específica y el formulario aparece donde
 * tiene que aparecer.
 */
export default function PanelNuevaEvaluacion() {
  return (
    <ModalAncho
      titulo="Encargar una evaluación"
      ruta="/empresa/evaluaciones/nueva"
    >
      <ContenidoNuevaEvaluacion />
    </ModalAncho>
  );
}
