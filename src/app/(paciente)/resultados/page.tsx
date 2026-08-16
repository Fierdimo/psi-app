import { redirect } from "next/navigation";

/**
 * La sección «Resultados» dejó de existir.
 *
 * Un informe se lee dentro de su evaluación: es la misma cosa en dos momentos
 * y tenerla en dos sitios hacía perder el hilo de dónde estaba lo que uno
 * había respondido. La ruta se conserva redirigiendo porque puede estar en un
 * correo o en un marcador de alguien.
 */
export default function ResultadosPage() {
  redirect("/evaluacion");
}
