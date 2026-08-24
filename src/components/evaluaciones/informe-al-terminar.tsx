"use client";

import { Printer } from "lucide-react";

import { Informe } from "@/components/evaluaciones/informe";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { InformeCompleto } from "@/lib/evaluaciones/acciones-pase";

/**
 * El informe de quien acaba de responder, en la misma pantalla.
 *
 * ES SU ÚNICA OPORTUNIDAD DE VERLO, y por eso la pantalla lo dice antes que
 * ninguna otra cosa.
 *
 * La razón está en la revisión de seguridad del enlace de acceso: ese enlace
 * es una credencial al portador que viaja por correo, se imprime en un QR y se
 * queda en historiales de navegador. Mientras siguiera abriendo el informe,
 * cualquiera que lo tuviera podía leer un perfil psicológico con nombre. Así
 * que el enlace se apaga aquí, en el momento en que la persona —la única de la
 * que sabemos con certeza que es ella, porque acaba de responder— lo tiene
 * delante.
 *
 * Lo que se cede a cambio es real y no se disimula: si cierra la pestaña sin
 * guardarlo, no hay forma de recuperarlo desde la plataforma. El consentimiento
 * lo dice con estas mismas palabras antes de empezar.
 *
 * Y es EL MISMO documento que recibe la empresa, con el mismo componente. Dos
 * versiones del informe acabarían diciendo cosas distintas al primer cambio, y
 * la persona tiene derecho a saber qué se dijo de ella.
 */
export function InformeAlTerminar({
  informe,
}: {
  informe: InformeCompleto | null;
}) {
  /*
   * El motor no llegó a publicar.
   *
   * Ocurre —el cierre automático está escrito para no lanzar nunca— y en ese
   * caso el enlace NO se apagó, a propósito: es lo único que le queda a esta
   * persona para volver. El texto se lo dice.
   */
  if (!informe) {
    return (
      <div className="mx-auto flex w-full max-w-[70ch] flex-col gap-6">
        <Alert tone="success" title="Recibimos tus respuestas">
          Tu informe se está preparando. Vuelve a abrir el mismo enlace de tu
          correo en un rato y lo verás aquí.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/*
        La advertencia va ARRIBA, antes del informe.

        Debajo no la lee nadie: quien termina una prueba de media hora baja
        leyendo sus resultados y cierra. Tiene que encontrarse con esto antes
        de empezar a leer, no después de terminar.
      */}
      <div className="mx-auto w-full max-w-[70ch] print:hidden">
        <Alert
          tone="warning"
          title="Guarda esto ahora: no podrás volver a abrirlo"
        >
          Este es tu informe y esta es la única vez que se te muestra. Tu enlace
          de acceso queda cerrado desde este momento. Imprímelo o guárdalo como
          PDF con el botón de abajo; también lo recibió la empresa que encargó
          la evaluación.
        </Alert>
      </div>

      <div className="border-line overflow-hidden rounded-xl border print:border-0">
        <Informe
          parametros={informe.parametros}
          valores={informe.valores}
          notaGlobal={informe.notaGlobal}
          textosFijos={informe.textosFijos}
          evaluado={informe.evaluado}
        />
      </div>

      {/*
        Imprimir y no «descargar».

        Un enlace de descarga necesitaría una dirección que devolviera el
        documento, y esa dirección sería exactamente la credencial al portador
        que acabamos de apagar. El diálogo del navegador guarda como PDF en
        todos los sistemas y no deja nada abierto detrás.
      */}
      <div className="mx-auto print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-4" />
          Imprimir o guardar como PDF
        </Button>
      </div>
    </div>
  );
}
