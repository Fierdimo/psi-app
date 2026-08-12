import type { Metadata } from "next";

import { ArmazonAuth } from "@/components/auth/armazon-auth";
import { FormularioNuevaContrasena } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Nueva contraseña" };

/**
 * Se llega aquí desde el enlace del correo, ya con sesión abierta por
 * `/auth/callback`. Por eso no se pide la contraseña anterior: quien tiene el
 * enlace ya demostró control del buzón.
 */
export default function NuevaContrasenaPage() {
  return (
    <ArmazonAuth
      titulo="Crea una contraseña nueva"
      descripcion="Al guardarla entrarás directamente a tu espacio."
    >
      <FormularioNuevaContrasena />
    </ArmazonAuth>
  );
}
