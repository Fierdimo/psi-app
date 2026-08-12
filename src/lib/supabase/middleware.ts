import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { CONSENTIMIENTO } from "@/lib/consentimiento";

/** Rutas privadas del paciente. Prefijos. */
const RUTAS_PACIENTE = [
  "/panel",
  "/calendario",
  "/mis-datos",
  "/resultados",
  "/sesiones",
  "/recursos",
  "/documentos",
  "/consentimiento",
];

/** Rutas privadas del profesional. Su entrada, `/profesional` a secas, es pública. */
const RUTA_PROFESIONAL = "/profesional/";

/** Pantallas de entrada. Con sesión activa no tiene sentido volver a ellas. */
const RUTAS_DE_ENTRADA = ["/ingresar", "/registro", "/profesional"];

export function esRutaPrivada(pathname: string) {
  return (
    RUTAS_PACIENTE.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`),
    ) || pathname.startsWith(RUTA_PROFESIONAL)
  );
}

/**
 * Refresca la sesión y protege las rutas privadas.
 *
 * IMPORTANTE — esto no es la frontera de seguridad. El middleware solo decide
 * a qué pantalla se llega; quién puede leer qué lo decide RLS en Postgres. Si
 * alguien saltara este middleware, la base seguiría devolviéndole únicamente
 * sus propios datos.
 *
 * El rol NO se comprueba aquí a propósito: obligaría a consultar la base en
 * cada petición, incluidas las de recursos estáticos. Se comprueba en los
 * layouts privados, que ya consultan el perfil de todos modos.
 *
 * El CONSENTIMIENTO sí se comprueba aquí, y por un motivo concreto: hacerlo
 * solo en un layout anidado produce una redirección de React que renderiza la
 * pantalla de consentimiento SIN cambiar la URL del navegador. El usuario ve
 * un documento legal mientras la barra de direcciones dice «/agenda», que es
 * exactamente la clase de incoherencia que erosiona la confianza en un portal
 * clínico. Desde aquí es una redirección HTTP y la URL siempre coincide con lo
 * que se ve. Los layouts mantienen su propia comprobación como segunda
 * barrera.
 */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token contra el servidor de autenticación. getSession()
  // se limita a leer la cookie, que el navegador puede haber manipulado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && esRutaPrivada(pathname)) {
    const destino = request.nextUrl.clone();
    // La entrada del profesional es la que corresponde si iba a su área.
    destino.pathname = pathname.startsWith(RUTA_PROFESIONAL)
      ? "/profesional"
      : "/ingresar";
    destino.searchParams.set("siguiente", pathname);
    return NextResponse.redirect(destino);
  }

  if (user && RUTAS_DE_ENTRADA.includes(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/panel";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  // Puerta del consentimiento. Se evalúa antes que el rol y aplica a los dos
  // roles: nadie usa la plataforma sin haber aceptado la versión en vigor.
  if (user && esRutaPrivada(pathname) && pathname !== "/consentimiento") {
    const { data: consentimiento } = await supabase
      .from("consents")
      .select("id")
      .eq("user_id", user.id)
      .eq("document_key", CONSENTIMIENTO.clave)
      .eq("version", CONSENTIMIENTO.version)
      .maybeSingle();

    if (!consentimiento) {
      const destino = request.nextUrl.clone();
      destino.pathname = "/consentimiento";
      destino.search = "";
      return NextResponse.redirect(destino);
    }
  }

  return response;
}
