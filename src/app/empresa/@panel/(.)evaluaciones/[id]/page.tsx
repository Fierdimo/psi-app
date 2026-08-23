import {
  FichaDeEvaluacion,
  nombreDeEvaluacion,
} from "@/components/empresa/ficha-de-evaluacion";
import { ModalAncho } from "@/components/navegacion/modal-ancho";

/** Una dirección de evaluación es siempre un uuid. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La evaluación, encima del listado y sin perderlo de vista.
 *
 * Un modal ancho y no el panel de la derecha: dentro puede haber un informe
 * entero, y un informe en 600 px se lee a tres palabras por línea.
 */
export default async function PanelEvaluacion({
  params,
  searchParams,
}: PageProps<"/empresa/evaluaciones/[id]">) {
  const { id } = await params;
  const avisos = await searchParams;

  /*
   * Una red, no la solución.
   *
   * `/empresa/evaluaciones/nueva` también encaja en `[id]`, y durante un rato
   * esta comprobación fue todo lo que había: el resultado era que el botón de
   * «encargar una evaluación» cambiaba la dirección y no pasaba nada en
   * pantalla —la intercepción se traga la navegación y el hueco del panel
   * quedaba vacío—. La solución es que `nueva` tenga su propia ruta
   * interceptada, que la gana por ser más específica.
   *
   * Esto se queda por si mañana aparece otro segmento fijo bajo
   * `/empresa/evaluaciones/`: mejor un hueco vacío que un 404 sobre la
   * pantalla que sí funciona.
   */
  if (!UUID.test(id)) return null;

  return (
    <ModalAncho
      titulo={await nombreDeEvaluacion(id)}
      ruta={`/empresa/evaluaciones/${id}`}
    >
      {/*
        Los avisos también aquí, y no solo en la ruta directa.
        
        Al encargar desde el modal —que es el camino normal— la acción redirige
        a esta dirección y la intercepción la atiende ESTA ruta, no la
        completa. Sin esto, quien acababa de gastar un uso no veía ninguna
        confirmación. No hay riesgo de que salga fuera de sitio: el parámetro
        solo existe en la dirección justo después de crearla.
      */}
      <FichaDeEvaluacion
        id={id}
        avisos={{
          nueva: typeof avisos.nueva === "string" ? avisos.nueva : undefined,
          correo: typeof avisos.correo === "string" ? avisos.correo : undefined,
        }}
      />
    </ModalAncho>
  );
}
