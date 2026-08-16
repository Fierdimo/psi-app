import { ChevronDown, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { nombreConvocado, type PersonaConvocada } from "@/lib/citas/estados";

/**
 * Las personas convocadas a una sesión de evaluación.
 *
 * Van DENTRO de la solicitud de su empresa y no como entradas sueltas en la
 * bandeja. La sesión es un solo compromiso —una fecha, una sala, una
 * confirmación— y partirla en quince solicitudes obligaría a aceptar quince
 * veces lo mismo y perdería la única pregunta que importa: ¿acepto esta sesión?
 *
 * Es también la forma que tendrá la asignación de la prueba: un acto sobre la
 * sesión, que alcanza a todos los convocados, y no quince asignaciones iguales
 * hechas a mano.
 */
export function Convocados({
  personas,
  compacto = false,
  /**
   * Plegado: se ve cuántos son y se despliega quiénes.
   *
   * En la bandeja, junto al calendario, el listado completo ocupaba más que
   * todo lo demás de la tarjeta y enterraba la fecha y los botones, que es lo
   * que se mira para decidir. Para aceptar una sesión basta con saber a
   * cuántos alcanza; quién es cada uno se consulta cuando hace falta.
   *
   * Se usa `<details>`: funciona sin JavaScript, el teclado lo maneja solo y
   * el buscador del navegador encuentra dentro. Un desplegable propio sería
   * más código y peor comportamiento.
   */
  plegable = false,
}: {
  personas: PersonaConvocada[];
  /** Sin encabezado ni recuadro, para usarlo dentro de una tarjeta ya densa. */
  compacto?: boolean;
  plegable?: boolean;
}) {
  if (personas.length === 0) {
    return (
      <p className="text-text-muted text-sm">
        Sin personas convocadas todavía.
      </p>
    );
  }

  const aspirantes = personas.filter((p) => p.vinculo === "aspirante").length;

  const resumen = (
    <>
      <Users aria-hidden="true" className="size-4 shrink-0" />
      {personas.length}{" "}
      {personas.length === 1 ? "persona convocada" : "personas convocadas"}
      {aspirantes > 0 && (
        <span>
          {" · "}
          {aspirantes === personas.length
            ? "todas aspirantes"
            : `${aspirantes} aspirante${aspirantes === 1 ? "" : "s"}`}
        </span>
      )}
    </>
  );

  const listado = (
    <ul className="border-line divide-line divide-y rounded-md border">
      {personas.map((p) => (
        <li
          key={p.documento}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
        >
          <span className="text-text-strong font-medium">
            {nombreConvocado(p)}
          </span>
          <span className="text-text-muted tabular">{p.documento}</span>
          {p.cargo && <span className="text-text-muted">{p.cargo}</span>}
          <Badge
            tone={p.vinculo === "empleado" ? "accent" : "neutral"}
            className="ml-auto"
          >
            {p.vinculo === "empleado" ? "Empleado" : "Aspirante"}
          </Badge>
        </li>
      ))}
    </ul>
  );

  if (plegable) {
    return (
      <details className="group flex flex-col gap-2">
        <summary className="text-text-muted hover:text-text-body ease-psi flex cursor-pointer list-none items-center gap-1.5 text-sm transition-colors duration-150">
          {resumen}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="pt-2">{listado}</div>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!compacto && (
        <p className="text-text-muted flex items-center gap-1.5 text-sm">
          {resumen}
        </p>
      )}
      {listado}
    </div>
  );
}
