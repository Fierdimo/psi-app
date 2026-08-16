import Pagina from "@/app/empresa/sesiones/nueva/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";

/** Solicitar una sesión, como panel: la lista se queda detrás. */
export default async function Panel() {
  return (
    <PanelLateral titulo="Solicitar una sesión" ruta="/empresa/sesiones/nueva">
      <Pagina />
    </PanelLateral>
  );
}
