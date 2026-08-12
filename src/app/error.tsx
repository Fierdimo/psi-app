"use client";

import { useEffect } from "react";

import { Brand } from "@/components/marca/brand";
import { Button } from "@/components/ui/button";

/**
 * Página de error de la aplicación.
 *
 * Reglas del spec que se aplican aquí (SPEC.md §10, §13):
 *  - Lenguaje llano: qué pasó y qué hacer. Nunca «Algo salió mal» a secas.
 *  - Siempre una acción de reintento.
 *  - NUNCA se muestra el mensaje crudo del error al usuario: puede filtrar
 *    detalles de la base de datos o de la infraestructura. Va a la consola en
 *    desarrollo y, más adelante, al servicio de errores con los datos
 *    personales depurados (PLAN.md §13).
 */
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center"
    >
      <Brand size="lg" />

      <div className="flex flex-col gap-2">
        <h1 className="text-h2">No pudimos cargar esta página</h1>
        <p className="text-text-body">
          Fue un problema de nuestro lado, no tuyo. Tus datos están a salvo.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Reintentar</Button>
      </div>

      {error.digest && (
        <p className="text-micro text-text-muted tabular">
          Referencia: {error.digest}
        </p>
      )}
    </main>
  );
}
