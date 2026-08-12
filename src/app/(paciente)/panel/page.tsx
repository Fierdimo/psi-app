import type { Metadata } from "next";
import Link from "next/link";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { SECCIONES } from "@/components/navegacion/secciones";
import { Alert } from "@/components/ui/alert";
import { exigirSesion } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Panel de inicio.
 *
 * La tarjeta de próxima cita —el elemento más importante de la app— llega en
 * F4, cuando exista el calendario. De momento el panel hace de mapa: en móvil
 * es la única forma de alcanzar las secciones que no caben en la barra
 * inferior.
 */
export default async function PanelPage() {
  const perfil = await exigirSesion();
  const accesos = SECCIONES.filter((s) => s.href !== "/panel");

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo={`Hola, ${perfil.nombre ?? "bienvenido"}`}
        descripcion="Este es tu espacio privado. Solo tú y tu profesional pueden ver lo que hay aquí."
      />

      <Alert tone="info" title="Tu calendario estará disponible muy pronto">
        Podrás ver tus citas y solicitar nuevos horarios sin salir de la
        plataforma. Mientras tanto, comunícate con la consulta para agendar.
      </Alert>

      <section className="flex flex-col gap-4">
        <h2 className="text-h3">Tus secciones</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map(({ href, etiqueta, icono: Icono, placeholder }) => (
            <li key={href}>
              <Link
                href={href}
                className="border-line bg-panel hover:border-accent hover:bg-accent-soft ease-psi flex h-full items-start gap-3 rounded-lg border p-4 transition-colors duration-150"
              >
                <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-md">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-text-strong font-medium">
                    {etiqueta}
                  </span>
                  <span className="text-text-muted text-micro">
                    {placeholder ? "Próximamente" : "Disponible"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Pantalla>
  );
}
