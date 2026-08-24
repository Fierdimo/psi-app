import Link from "next/link";

import { Brand } from "@/components/marca/brand";
import {
  BarraInferior,
  BarraLateral,
} from "@/components/navegacion/nav-privada";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Area } from "@/components/navegacion/nav-privada";
import { cerrarSesion } from "@/lib/auth/acciones";

/**
 * El armazón de las pantallas privadas: cabecera, navegación y pie.
 *
 * Estaba escrito dentro del layout del paciente, y por eso `/evaluacion` —que
 * vive fuera de esa carpeta para no exigir el consentimiento de atención— se
 * quedó sin cabecera ni navegación. La persona entraba a su prueba y la
 * aplicación desaparecía a su alrededor.
 *
 * La lección: separar una ruta por sus PERMISOS no debería costarle su
 * aspecto. Ahora el armazón es un componente y cada layout decide qué exige
 * antes de pintarlo.
 */
export function ArmazonPrivado({
  nombre,
  children,
  /** En una prueba en curso la navegación estorba y se puede ocultar. */
  conNavegacion = true,
  area = "paciente",
  /** A dónde lleva la marca. Cada área tiene su propia puerta de entrada. */
  inicio = "/panel",
  /**
   * Cabecera oscura para las áreas que muestran datos de OTRAS personas.
   *
   * No es un capricho: es un recordatorio permanente de dónde está uno. El
   * área del paciente la lleva clara y la del profesional oscura, y la
   * diferencia tiene que notarse de un vistazo sin leer nada.
   */
  tono = "claro",
  /** Etiqueta junto a la marca, del tipo «Área profesional». */
  insignia,
}: {
  nombre: string;
  children: React.ReactNode;
  conNavegacion?: boolean;
  area?: Area;
  inicio?: string;
  tono?: "claro" | "oscuro";
  insignia?: string;
}) {
  const oscura = tono === "oscuro";

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Al imprimir, el armazón desaparece.

        Cabecera, barra lateral, barra inferior y crédito no son el documento:
        son cómo se llega a él. En papel ocupan la primera plana y no dicen
        nada, y la barra lateral además parte la tabla en dos columnas
        inservibles.

        Las dos barras llevan su `print:hidden` DENTRO, en su propio elemento.
        Envolverlas aquí en un `div` las sustituía como hijas del flex: la
        lateral perdía su ancho fijo y el `sticky` de dentro cambiaba de
        contenedor, así que dejaba de quedarse quieta al desplazar. Lo detectó
        la prueba que vigila justo eso.
      */}
      <header
        className={cn(
          "sticky top-0 z-20 h-[var(--alto-cabecera)] border-b print:hidden",
          oscura ? "bg-brand-800 border-brand-900" : "border-line bg-panel",
        )}
      >
        <div className="mx-auto flex h-full w-full max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href={inicio} className="rounded-md">
              <Brand size="sm" tone={oscura ? "dark" : undefined} />
            </Link>
            {insignia ? (
              <span className="bg-brand-900 text-brand-200 text-micro rounded-sm px-2 py-1 font-semibold tracking-[0.06em] uppercase">
                {insignia}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "hidden text-sm sm:inline",
                oscura ? "text-brand-200" : "text-text-muted",
              )}
            >
              {nombre}
            </span>
            <form action={cerrarSesion}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className={
                  oscura
                    ? "text-brand-200 hover:bg-brand-900 hover:text-surface-0"
                    : undefined
                }
              >
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/*
        Se aprovecha el ancho de la pantalla.

        Antes todo iba centrado en 1280 px: en un monitor de trabajo quedaban
        dos franjas vacías a los lados mientras el calendario se apretaba en el
        centro y la bandeja de solicitudes partía sus tarjetas en cinco líneas.
        Un panel de trabajo no es un artículo.

        El tope de 1800 px sí se queda, para pantallas muy anchas: pasada esa
        medida no se gana nada y la cabecera se separa tanto del contenido que
        cuesta relacionarlos. Y donde SÍ hay prosa —descripciones, informes— la
        medida de lectura la acota cada componente, que es donde importa.
      */}
      <div className="mx-auto flex w-full max-w-[1800px] flex-1">
        {conNavegacion ? <BarraLateral area={area} /> : null}
        <main id="contenido" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {/*
        El crédito, una sola vez y al final.
        Aquí dentro no está para convencer a nadie —quien entra ya es cliente—
        sino para que quede constancia de quién mantiene esto. Por eso va en el
        tono más bajo de la escala y después de todo el contenido, no
        compitiendo con la barra de navegación.
      */}
      <footer className="border-line mx-auto w-full max-w-[1800px] border-t px-4 py-5 sm:px-6 print:hidden">
        <p className="text-text-muted text-micro">
          Desarrollado por{" "}
          <a
            href="https://nexias.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent ease-psi font-medium transition-colors duration-150"
          >
            Nexias
          </a>
        </p>
      </footer>

      {conNavegacion ? <BarraInferior area={area} /> : null}
    </div>
  );
}
