import { PanelLateral } from "@/components/navegacion/panel-lateral";
import DetalleCita from "@/app/(paciente)/calendario/[id]/page";

/**
 * El detalle de una cita, como panel lateral.
 *
 * Es una RUTA INTERCEPTADA: al pulsar una cita desde el calendario se abre
 * encima, con el calendario todavía detrás; al abrir el mismo enlace directo
 * —desde un correo, un marcador o recargando— se pinta la página entera. La
 * dirección es la misma en los dos casos, así que se puede compartir.
 *
 * Se reutiliza el componente de la página en vez de duplicar su contenido:
 * dos copias de la misma pantalla se separan al primer arreglo que se aplique
 * solo a una.
 */
export default async function PanelDetalleCita(
  props: PageProps<"/calendario/[id]">,
) {
  const { id } = await props.params;

  return (
    <PanelLateral titulo="Detalle de la cita" ruta={`/calendario/${id}`}>
      {/*
        Dentro del panel sobra el «Volver al calendario» de la página: el
        calendario está detrás y la equis ya cierra. Se oculta aquí y no en la
        página, que abierta a pantalla completa sí lo necesita.
      */}
      <div className="[&_a[href='/calendario']]:hidden">
        <DetalleCita {...props} />
      </div>
    </PanelLateral>
  );
}
