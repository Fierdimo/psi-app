import Pagina from "@/app/empresa/personas/[id]/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";

/** Editar persona, como panel: la lista se queda detrás. */
export default async function Panel(
  props: PageProps<"/empresa/personas/[id]">,
) {
  const { id } = await props.params;

  return (
    <PanelLateral titulo="Editar persona" ruta={`/empresa/personas/${id}`}>
      <Pagina {...props} />
    </PanelLateral>
  );
}
