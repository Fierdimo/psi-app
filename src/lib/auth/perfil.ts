import "server-only";

import { redirect } from "next/navigation";

import { CONSENTIMIENTO } from "@/lib/consentimiento";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Rol = "paciente" | "profesional" | "empresa";

export type Perfil = {
  id: string;
  role: Rol;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  timezone: string;
  /** Solo para el rol `empresa`: la organización que administra. */
  organization_id: string | null;
};

/** Perfil de la sesión actual, o `null` si no hay sesión. */
export async function obtenerPerfil(): Promise<Perfil | null> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, nombre, apellidos, telefono, timezone, organization_id")
    .eq("id", user.id)
    .single();

  return (data as Perfil) ?? null;
}

/** Ruta de inicio de cada rol. Un solo lugar donde vive esta correspondencia. */
export function inicioSegunRol(rol: Rol) {
  if (rol === "profesional") return "/profesional/agenda";
  if (rol === "empresa") return "/empresa";
  return "/panel";
}

/** ¿Aceptó esta persona la versión vigente del consentimiento? */
export async function tieneConsentimientoVigente(userId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", userId)
    .eq("document_key", CONSENTIMIENTO.clave)
    .eq("version", CONSENTIMIENTO.version)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Exige sesión y, si quien mira es paciente, consentimiento vigente.
 *
 * Solo el paciente lo otorga. El profesional lo RECIBE —pedírselo sería
 * pedirle que se autorice a sí mismo— y una empresa no puede consentir por la
 * persona a la que manda evaluar, que firma el suyo antes de responder
 * (SPEC.md §9.2).
 *
 * La comprobación vive en tres sitios —aquí, en el proxy y en la acción de
 * ingreso— porque cada uno protege una puerta distinta, y durante un tiempo
 * solo dos de los tres estuvieron corregidos: el fallo seguía apareciendo por
 * el tercero. Si se cambia la regla, se cambian los tres.
 */
export async function exigirSesion(): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");

  if (
    perfil.role === "paciente" &&
    !(await tieneConsentimientoVigente(perfil.id))
  )
    redirect("/consentimiento");

  return perfil;
}

/**
 * Exige que quien mira sea el profesional.
 *
 * Un paciente que llega aquí es redirigido a su panel SIN mensaje de error.
 * Decirle «no tienes permisos de profesional» convertiría la ruta en un
 * detector de cuentas privilegiadas (SPEC.md §5.1).
 */
export async function exigirProfesional(): Promise<Perfil> {
  const perfil = await exigirSesion();
  // A su sitio, no a un error: decir «no tienes permiso» convertiría la ruta
  // en un detector de cuentas privilegiadas.
  if (perfil.role !== "profesional") redirect(inicioSegunRol(perfil.role));
  return perfil;
}

/**
 * Exige que quien mira administre una empresa.
 *
 * Devuelve también su organización, que es lo que toda pantalla del área va a
 * necesitar de inmediato. Una cuenta de empresa sin organización no debería
 * existir —`registrar_empresa()` las crea juntas— pero si ocurriera, se la
 * trata como a cualquiera que no tiene nada que hacer aquí.
 */
export async function exigirEmpresa(): Promise<
  Perfil & { organization_id: string }
> {
  const perfil = await exigirSesion();

  if (perfil.role !== "empresa" || !perfil.organization_id) {
    redirect(inicioSegunRol(perfil.role));
  }

  return perfil as Perfil & { organization_id: string };
}
