import DetalleCitaProfesional from "@/app/profesional/(privado)/citas/[id]/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";

/**
 * El detalle de una cita del profesional, como panel lateral.
 *
 * Misma ruta interceptada que en el área del paciente: pulsando desde la
 * agenda se abre encima —y al cerrar el calendario sigue en la semana que se
 * estaba mirando, que es justo lo que se pierde al cambiar de pantalla—;
 * abriendo el enlace directo se pinta la página entera.
 *
 * Aquí importa más todavía que en el paciente: quien revisa su agenda entra y
 * sale de varias citas seguidas, y volver a situarse cada vez es el trabajo
 * que esta pantalla debería ahorrar.
 */
export default async function PanelCitaProfesional(
  props: PageProps<"/profesional/citas/[id]">,
) {
  return (
    <PanelLateral titulo="Detalle de la cita">
      {/* Dentro del panel sobra el «Volver a la agenda»: está detrás y la
          equis ya cierra. */}
      <div className="[&_a[href='/profesional/agenda']]:hidden">
        <DetalleCitaProfesional {...props} />
      </div>
    </PanelLateral>
  );
}
