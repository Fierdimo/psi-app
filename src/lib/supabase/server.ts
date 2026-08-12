import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para componentes de servidor y acciones de servidor.
 *
 * Usa la clave anónima y la sesión del usuario, así que **todas las consultas
 * pasan por RLS**. Esa es la intención: aunque una ruta tenga un fallo de
 * lógica, la base sigue devolviendo únicamente lo que le corresponde a quien
 * pregunta.
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los componentes de servidor no pueden escribir cookies. No es un
            // problema: el middleware ya refrescó la sesión en esta petición.
          }
        },
      },
    },
  );
}
