import Pagina from "@/app/empresa/sesiones/[id]/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";

/** Editar la solicitud, como panel: la lista se queda detrás. */
export default async function Panel(
  props: PageProps<"/empresa/sesiones/[id]">,
) {
  const { id } = await props.params;

  return (
    <PanelLateral titulo="Editar la solicitud" ruta={`/empresa/sesiones/${id}`}>
      <Pagina {...props} />
    </PanelLateral>
  );
}
