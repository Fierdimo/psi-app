import { ArmazonPrivado } from "@/components/navegacion/armazon-privado";
import { exigirProfesional } from "@/lib/auth/perfil";

/**
 * Área del profesional (SPEC.md §5.2).
 *
 * El grupo `(privado)` existe para que este layout NO envuelva a
 * `/profesional`, que es la pantalla de entrada y debe ser pública.
 *
 * Mismo armazón que el paciente, con sus secciones y su cabecera oscura. Antes
 * llevaba una fila horizontal propia: tres áreas con tres navegaciones era una
 * diferencia sin motivo, y quien usa las tres tenía que aprender tres. La
 * barra lateral además crece sin quedarse sin sitio, que es donde la fila se
 * rompía —ya iban siete secciones y empezaban a desplazarse en horizontal—.
 *
 * La cabecera oscura sí se conserva: recuerda de un vistazo que lo que hay en
 * pantalla son datos de otras personas.
 */
export default async function LayoutProfesional({
  children,
  panel,
}: LayoutProps<"/profesional">) {
  const perfil = await exigirProfesional();

  return (
    <ArmazonPrivado
      nombre={`${perfil.nombre ?? ""} ${perfil.apellidos ?? ""}`.trim()}
      area="profesional"
      inicio="/profesional/agenda"
      tono="oscuro"
      insignia="Área profesional"
    >
      {children}
      {/* Hueco del panel lateral: lo llena una ruta interceptada al abrir una
          cita desde la agenda. */}
      {panel}
    </ArmazonPrivado>
  );
}
