import { NextResponse, type NextRequest } from "next/server";

import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Punto de aterrizaje de los enlaces enviados por correo: verificación de
 * cuenta y recuperación de contraseña.
 *
 * Cambia el código de un solo uso por una sesión y redirige. Si el código es
 * inválido o ya se usó, se vuelve a la entrada con un aviso genérico — nunca
 * se detalla por qué falló.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const siguiente = searchParams.get("siguiente");

  /*
   * Sin destino explícito, al área de empresa.
   *
   * Era `/panel`, el del paciente, que es a quien creaba el registro. Desde
   * que el alta pública es la de una empresa, quien acaba de verificar su
   * correo administra una organización — y el enrutado la mandaría allí de
   * todas formas, pero pasando antes por una pantalla que no es suya.
   */
  const destino =
    siguiente?.startsWith("/") && !siguiente.startsWith("//")
      ? siguiente
      : "/empresa";

  if (!code) {
    return NextResponse.redirect(`${origin}/ingresar?error=enlace`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/ingresar?error=enlace`);
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
