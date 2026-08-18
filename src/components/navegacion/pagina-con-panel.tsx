import { PanelLateral } from "@/components/navegacion/panel-lateral";

/**
 * Una ruta de panel abierta EN DIRECTO: al recargar o al pegar la dirección.
 *
 * La intercepción de rutas solo actúa en la navegación de dentro de la
 * aplicación. Al recargar, Next pinta la ruta real, y el detalle sustituía al
 * listado: la pantalla cambiaba entera y no había vuelta atrás salvo el menú.
 * Para quien recarga con un panel abierto —que es lo normal cuando algo no se
 * ve bien— era como si la aplicación se hubiera movido sola.
 *
 * Esto reconstruye lo mismo que se veía: el listado detrás, el panel encima.
 *
 * La diferencia con la versión interceptada es a dónde lleva cerrar. Aquí no
 * hay un «atrás» de confianza —en una pestaña nueva no hay ninguno— así que se
 * va al listado. En la interceptada se vuelve atrás de verdad, que conserva el
 * scroll y el mes que se estaba mirando.
 */
export function PaginaConPanel({
  fondo,
  titulo,
  volverA,
  children,
}: {
  fondo: React.ReactNode;
  titulo: string;
  volverA: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {fondo}
      <PanelLateral titulo={titulo} volverA={volverA}>
        {children}
      </PanelLateral>
    </>
  );
}
