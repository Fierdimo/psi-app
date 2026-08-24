"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Abre el diálogo de impresión al llegar, y deja el botón para repetir.
 *
 * El diálogo del navegador resuelve las dos cosas que se piden aquí —guardar
 * como PDF e imprimir en papel— sin añadir ninguna dependencia. Generar el PDF
 * en el servidor pediría un navegador sin cabeza en el despliegue, que es un
 * peso enorme para un documento que es una tabla.
 *
 * Se abre SOLO UNA VEZ. En desarrollo React monta dos veces a propósito, y sin
 * el testigo el diálogo salía repetido en cuanto se cerraba el primero.
 *
 * Y esta pantalla se abre en una pestaña nueva: si se cancela el diálogo, se
 * cierra la pestaña y el listado sigue detrás como estaba.
 */
export function BotonImprimir() {
  const yaAbierto = useRef(false);

  useEffect(() => {
    if (yaAbierto.current) return;
    yaAbierto.current = true;

    /*
     * Un respiro antes de imprimir.
     *
     * Sin él el diálogo se abre mientras la tipografía todavía se está
     * cargando, y la vista previa sale con la de reserva. Es la clase de
     * detalle que solo se ve imprimiendo de verdad.
     */
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="size-4" />
      Imprimir o guardar como PDF
    </Button>
  );
}
