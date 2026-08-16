import SolicitarCita from "@/app/(paciente)/solicitar-cita/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";

/**
 * El formulario de solicitud, como panel lateral.
 *
 * Se pide una cita MIRANDO el calendario: qué semana está libre, cuándo cae la
 * anterior. Mandar a otra pantalla obligaba a memorizar eso y volver.
 *
 * Ahora es una ruta propia y no `/calendario/solicitar`, así que el
 * interceptor no puede confundirla con el identificador de una cita — que es
 * exactamente lo que la rompió la vez anterior.
 */
export default async function PanelSolicitarCita() {
  return (
    <PanelLateral titulo="Solicitar una cita" ruta="/solicitar-cita">
      {/* El «volver» de la página sobra aquí: el calendario está detrás. */}
      <div className="[&_a[href='/calendario']]:hidden">
        {/* La página no recibe parámetros: no hay nada que pasarle. */}
        <SolicitarCita />
      </div>
    </PanelLateral>
  );
}
