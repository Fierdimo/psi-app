import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave de servicio. **SALTA RLS POR COMPLETO.**
 *
 * `import "server-only"` hace que el build falle si alguien lo importa desde
 * un componente cliente, en vez de descubrirlo cuando la clave ya está en el
 * paquete que se envía al navegador.
 *
 * Se usa exclusivamente donde el servidor necesita escribir algo que el
 * usuario no debe poder falsificar. Hoy: el registro de consentimientos, que
 * guarda IP y agente tomados de la petición real y no de lo que el cliente
 * declare.
 *
 * Ante la duda, NO uses este cliente: usa `crearClienteServidor()`.
 */
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
