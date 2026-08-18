import { ContenidoNuevaPersona } from "@/app/empresa/personas/nueva/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";

/** Cargar una persona, como panel: la lista se queda detrás. */
export default async function Panel() {
  return (
    <PanelLateral titulo="Cargar una persona" ruta="/empresa/personas/nueva">
      <ContenidoNuevaPersona />
    </PanelLateral>
  );
}
