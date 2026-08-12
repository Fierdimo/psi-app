import "server-only";

import { redirect } from "next/navigation";

import { CONSENTIMIENTO } from "@/lib/consentimiento";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Rol = "paciente" | "profesional";

export type Perfil = {
  id: string;
  role: Rol;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  timezone: string;
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
    .select("id, role, nombre, apellidos, telefono, timezone")
    .eq("id", user.id)
    .single();

  return (data as Perfil) ?? null;
}

/** Ruta de inicio de cada rol. Un solo lugar donde vive esta correspondencia. */
export function inicioSegunRol(rol: Rol) {
  return rol === "profesional" ? "/profesional/agenda" : "/panel";
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
 * Exige sesión con consentimiento vigente y devuelve el perfil.
 *
 * El consentimiento se evalúa ANTES que el rol y aplica a los dos: nadie usa
 * la plataforma sin haber aceptado la versión en vigor (SPEC.md §6.1).
 */
export async function exigirSesion(): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/ingresar");

  if (!(await tieneConsentimientoVigente(perfil.id)))
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
  if (perfil.role !== "profesional") redirect("/panel");
  return perfil;
}
