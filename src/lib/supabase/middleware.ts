import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { CONSENTIMIENTO } from "@/lib/consentimiento";
import { CONDICIONES_EMPRESA } from "@/lib/legal/condiciones-empresa";

/** Rutas privadas del paciente. Prefijos. */
/*
 * Exige sesión pero NO el consentimiento de atención.
 *
 * Quien responde una evaluación que encargó una empresa no está en
 * tratamiento con nadie: pedirle un documento clínico para entrar sería el
 * mismo error de categoría que ya costó tres capas (SPEC §9.2).
 */
const RUTAS_CON_SESION = ["/evaluacion"];

const RUTAS_PACIENTE = [
  "/panel",
  "/calendario",
  "/mis-datos",
  "/resultados",
  "/consentimiento",
];

/** Rutas privadas del profesional. Su entrada, `/profesional` a secas, es pública. */
const RUTA_PROFESIONAL = "/profesional/";

/** Área de la empresa. Toda ella privada, incluida su raíz. */
const RUTA_EMPRESA = "/empresa";

/** Pantallas de entrada. Con sesión activa no tiene sentido volver a ellas. */
const RUTAS_DE_ENTRADA = ["/ingresar", "/registro", "/profesional"];

const empiezaPor = (pathname: string, rutas: string[]) =>
  rutas.some((r) => pathname === r || pathname.startsWith(`${r}/`));

export function esRutaPrivada(pathname: string) {
  return (
    empiezaPor(pathname, RUTAS_CON_SESION) ||
    // Las condiciones de la empresa: hay que tener sesión para aceptarlas, y
    // sin esto quien llegara sin ella vería la pantalla y no el ingreso.
    pathname === "/condiciones" ||
    RUTAS_PACIENTE.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`),
    ) ||
    pathname.startsWith(RUTA_PROFESIONAL) ||
    pathname === RUTA_EMPRESA ||
    pathname.startsWith(`${RUTA_EMPRESA}/`)
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

  // Puerta del consentimiento.
  //
  // Se pedía a TODO el mundo, y era un error de categoría: el consentimiento
  // informado lo otorga el paciente AL profesional. Pedírselo al profesional
  // es pedirle que se autorice a sí mismo, y pedírselo a una empresa es peor,
  // porque el consentimiento de una evaluación lo firma la persona evaluada y
  // nunca quien la manda evaluar (SPEC §9.2).
  //
  // Va por rol y no por ruta porque es el rol quien determina si la persona
  // está en posición de otorgarlo.
  /*
   * El consentimiento de atención se exige al entrar al ESPACIO DE ATENCIÓN,
   * no por tener sesión. Responder una evaluación encargada por una empresa no
   * lo es (SPEC §9.2).
   */
  const exigeConsentimiento =
    esRutaPrivada(pathname) &&
    pathname !== "/consentimiento" &&
    pathname !== "/condiciones" &&
    !empiezaPor(pathname, RUTAS_CON_SESION);

  if (user && exigeConsentimiento) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    /*
     * Cada rol firma un documento distinto, y ninguno firma el del otro.
     *
     * El paciente otorga el consentimiento de atención —esa rama muere con su
     * área—. La empresa acepta sus condiciones de uso, y eso NO es un trámite
     * simétrico: dentro va la obligación de custodiar el informe de una
     * persona que no está en la sala. El consentimiento que ella firma le
     * promete justamente eso, así que si aquí no se pidiera, aquella promesa
     * sería falsa.
     */
    const documento =
      perfil?.role === "paciente"
        ? {
            clave: CONSENTIMIENTO.clave,
            version: CONSENTIMIENTO.version,
            ruta: "/consentimiento",
          }
        : perfil?.role === "empresa"
          ? {
              clave: CONDICIONES_EMPRESA.clave,
              version: CONDICIONES_EMPRESA.version,
              ruta: "/condiciones",
            }
          : null;

    if (documento) {
      const { data: aceptado } = await supabase
        .from("consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("document_key", documento.clave)
        .eq("version", documento.version)
        .maybeSingle();

      if (!aceptado) {
        const destino = request.nextUrl.clone();
        destino.pathname = documento.ruta;
        destino.search = "";
        return NextResponse.redirect(destino);
      }
    }
  }

  return response;
}
