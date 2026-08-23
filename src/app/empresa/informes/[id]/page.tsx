import { redirect } from "next/navigation";

/**
 * El informe vive dentro de su evaluación (ver `../page.tsx`).
 *
 * Esta dirección salió en los correos de «informe disponible», así que se
 * conserva como redirección: quien abra uno de esos correos meses después
 * aterriza donde está el documento, no en un 404.
 */
export default async function InformeEmpresaPage({
  params,
}: PageProps<"/empresa/informes/[id]">) {
  const { id } = await params;
  redirect(`/empresa/evaluaciones/${id}`);
}
