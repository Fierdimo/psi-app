import { Building2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AceptarInvitacion } from "@/components/auth/aceptar-invitacion";
import { Brand } from "@/components/marca/brand";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Invitación",
  // Un enlace de invitación jamás debe acabar en un buscador.
  robots: { index: false, follow: false },
};

/**
 * Aceptación de una invitación a una sesión de evaluación.
 *
 * Ruta pública porque quien llega puede no tener cuenta todavía — de eso trata
 * la invitación. Lo que NO es público es el contenido: para leer de qué va hay
 * que traer el testigo en la URL, y sin sesión no se puede aceptar nada.
 *
 * Se muestra qué empresa convoca antes de pedir nada. Quien recibe esto tiene
 * derecho a saber de parte de quién viene antes de crear una cuenta, y a
 * marcharse sin hacerlo.
 */
export default async function InvitacionPage({
  params,
  searchParams,
}: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const { aceptada } = await searchParams;

  /*
   * Se lee con privilegios de servidor y por el HASH del testigo, nunca por su
   * valor: la tabla no concede lectura a nadie, y quien llega aquí todavía no
   * tiene sesión con la que pasar RLS.
   */
  const admin = crearClienteAdmin();
  const { data: invitacion, error } = await admin
    .from("invitations")
    .select(
      "id, accepted_at, expires_at, persona:organization_people(nombre, apellidos, organizacion:organizations(nombre))",
    )
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();

  /*
   * El error se distingue de «no existe», y no es una sutileza.
   *
   * Durante un rato la tabla no concedía lectura ni al propio servidor, así
   * que la consulta fallaba y la pantalla decía «esta invitación no es
   * válida»: un enlace perfectamente bueno parecía roto, y el motivo real
   * quedaba invisible. Tratar «sin permiso» como «no existe» convierte un
   * fallo de configuración en un misterio.
   */
  if (error) {
    console.error("[invitacion] no se pudo leer la invitación:", error.message);
  }

  const perfil = await obtenerPerfil();

  const persona = normalizar(invitacion?.persona);
  const empresa = normalizar(persona?.organizacion)?.nombre ?? null;
  const vencida =
    invitacion != null && new Date(invitacion.expires_at) <= new Date();

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-8 px-6 py-12"
    >
      <Brand size="md" />

      {error ? (
        <Alert tone="danger" title="No pudimos comprobar tu invitación">
          Es un problema nuestro, no del enlace. Inténtalo en un momento; si
          sigue igual, avísale a quien te convocó.
        </Alert>
      ) : !invitacion ? (
        <Alert tone="danger" title="Esta invitación no es válida">
          Puede que el enlace esté incompleto o que se haya emitido uno nuevo.
          Pídele a la empresa que solicite otro.
        </Alert>
      ) : invitacion.accepted_at ? (
        aceptada ? (
          <Alert tone="success" title="Tu acceso está activo">
            Ya no tienes que hacer nada más hasta el día de la sesión. Allí el
            profesional te explicará la evaluación, te pedirá tu consentimiento
            y abrirá el examen.
          </Alert>
        ) : (
          <Alert tone="info" title="Esta invitación ya fue aceptada">
            Si fuiste tú, entra con tu cuenta. Si no la reconoces, avísale al
            profesional.
          </Alert>
        )
      ) : vencida ? (
        <Alert tone="warning" title="Esta invitación ya venció">
          Los enlaces caducan por seguridad. Pídele a la empresa que solicite
          uno nuevo.
        </Alert>
      ) : (
        <>
          <header className="flex flex-col gap-3">
            <span className="bg-accent-soft text-accent grid size-11 place-items-center rounded-full">
              <Building2 aria-hidden="true" className="size-5.5" />
            </span>
            <h1 className="text-h1">Te han convocado a una evaluación</h1>
            <p className="text-text-body text-lg">
              {empresa ?? "Una empresa"} pidió evaluarte
              {persona?.nombre ? `, ${persona.nombre}` : ""}. Para participar
              necesitas una cuenta en la plataforma.
            </p>
          </header>

          <div className="border-line bg-panel flex flex-col gap-4 rounded-lg border p-6">
            <div className="text-text-body flex items-start gap-2.5 text-sm">
              <ShieldCheck
                aria-hidden="true"
                className="text-accent mt-0.5 size-5 shrink-0"
              />
              <p>
                Aceptar solo activa tu acceso. El consentimiento de la
                evaluación se firma aparte, y sin él no se te evalúa: puedes
                cerrar esta página y no pasa nada.
              </p>
            </div>

            {perfil ? (
              <AceptarInvitacion token={token} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-text-body text-sm">
                  Entra o crea tu cuenta y vuelve a abrir este enlace. Si ya
                  tenías cuenta —porque otra empresa te evaluó antes—, usa esa:
                  así tus resultados quedan juntos.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/registro?siguiente=/invitacion/${token}`}
                    className={buttonVariants()}
                  >
                    Crear mi cuenta
                  </Link>
                  <Link
                    href={`/ingresar?siguiente=/invitacion/${token}`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

/** SHA-256 en hexadecimal, igual que lo calcula la base al guardar. */
async function sha256Hex(valor: string) {
  const datos = new TextEncoder().encode(valor);
  const resumen = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** PostgREST devuelve las relaciones embebidas como arreglo aunque sean de una. */
function normalizar<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}
