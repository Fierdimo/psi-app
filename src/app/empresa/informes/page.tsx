import { redirect } from "next/navigation";

/**
 * «Informes» dejó de ser una sección.
 *
 * Era la misma lista que «Evaluaciones» con otro nombre: tenía que incluir las
 * no publicadas —o quien encargó veinte y ve cinco no sabe si las otras quince
 * se perdieron— y acababa siendo la lista de evaluaciones otra vez. Ahora hay
 * una fila por encargo y el informe está dentro cuando existe.
 *
 * Se redirige en vez de borrar la ruta porque la dirección viajó en correos ya
 * enviados. Un enlace que responde 404 en el correo de alguien es una llamada
 * de soporte.
 */
export default function InformesPage() {
  redirect("/empresa/evaluaciones");
}
