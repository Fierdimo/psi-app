import type { NextRequest } from "next/server";

import { actualizarSesion } from "@/lib/supabase/middleware";

/**
 * En Next.js 16 el convenio `middleware` pasó a llamarse `proxy`. Es un cambio
 * de nombre: se ejecuta igual, antes de que la petición llegue a una ruta.
 */
export default async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    /*
     * Todo salvo estáticos e imágenes. Refrescar la sesión en cada petición de
     * un icono es trabajo desperdiciado y multiplica las llamadas al servidor
     * de autenticación.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
