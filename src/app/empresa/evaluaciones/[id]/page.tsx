import type { Metadata } from "next";

import {
  FichaDeEvaluacion,
  nombreDeEvaluacion,
} from "@/components/empresa/ficha-de-evaluacion";
import { ListadoDeEvaluaciones } from "@/components/empresa/listado-de-evaluaciones";
import { ModalAncho } from "@/components/navegacion/modal-ancho";

export const metadata: Metadata = {
  title: "Evaluación",
  // Fuera de los buscadores: la pantalla puede llevar un informe psicológico.
  robots: { index: false, follow: false },
};

/**
 * Una evaluación abierta EN DIRECTO: al recargar o al pegar la dirección.
 *
 * La intercepción de rutas solo actúa en la navegación de dentro de la
 * aplicación. Al recargar, Next pinta la ruta real, y sin esto el detalle
 * sustituiría al listado: la pantalla cambiaría entera y no habría vuelta
 * atrás salvo el menú.
 *
 * Reconstruye lo mismo que se veía: el listado detrás, el modal encima. La
 * diferencia con la versión interceptada es a dónde lleva cerrar — aquí no hay
 * un «atrás» de confianza, así que se vuelve al listado.
 */
export default async function EvaluacionEmpresaPage({
  params,
  searchParams,
}: PageProps<"/empresa/evaluaciones/[id]">) {
  const { id } = await params;
  const avisos = await searchParams;

  return (
    <>
      <ListadoDeEvaluaciones />
      <ModalAncho
        titulo={await nombreDeEvaluacion(id)}
        volverA="/empresa/evaluaciones"
      >
        <FichaDeEvaluacion
          id={id}
          avisos={{
            nueva: typeof avisos.nueva === "string" ? avisos.nueva : undefined,
            correo:
              typeof avisos.correo === "string" ? avisos.correo : undefined,
          }}
        />
      </ModalAncho>
    </>
  );
}
