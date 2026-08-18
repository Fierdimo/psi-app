import Pagina from "@/app/empresa/sesiones/[id]/page";
import { PanelLateral } from "@/components/navegacion/panel-lateral";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * La sesión, como panel: la lista se queda detrás.
 *
 * El título se lee del estado y no está escrito a fijo porque la pantalla hace
 * dos cosas distintas: editar mientras es solicitud, repartir accesos cuando
 * ya está confirmada. Un panel titulado «Editar la solicitud» sobre unos pases
 * de acceso hace dudar de si se abrió el que era.
 */
export default async function Panel(
  props: PageProps<"/empresa/sesiones/[id]">,
) {
  const { id } = await props.params;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  return (
    <PanelLateral
      titulo={
        data?.status === "solicitada" ? "Editar la solicitud" : "La sesión"
      }
      ruta={`/empresa/sesiones/${id}`}
    >
      <Pagina {...props} />
    </PanelLateral>
  );
}
