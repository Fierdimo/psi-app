import { ArmazonPrivado } from "@/components/navegacion/armazon-privado";
import { exigirSesion } from "@/lib/auth/perfil";

/**
 * Área del paciente (SPEC.md §5).
 *
 * `exigirSesion()` comprueba sesión Y consentimiento vigente. Es la segunda
 * barrera: la primera es el proxy, que además garantiza que la URL coincida con
 * lo que se ve.
 *
 * El armazón vive aparte porque `/evaluacion` lo necesita igual pero NO puede
 * exigir el consentimiento de atención: quien responde una prueba que encargó
 * una empresa no está en tratamiento con nadie.
 */
export default async function LayoutPaciente({
  children,
  panel,
}: LayoutProps<"/">) {
  const perfil = await exigirSesion();

  return (
    <ArmazonPrivado nombre={perfil.nombre ?? "Tu espacio"}>
      {children}
      {/* Hueco del panel lateral: lo llena una ruta interceptada cuando se
          abre una cita desde el calendario, y va vacío el resto del tiempo. */}
      {panel}
    </ArmazonPrivado>
  );
}
