import { z } from "zod";

/**
 * Esquemas compartidos entre el formulario y la acción de servidor.
 *
 * La validación del cliente es comodidad; la del servidor es la que cuenta.
 * Usar el mismo esquema en ambos lados evita que se desincronicen.
 */

const correo = z
  .string()
  .trim()
  .min(1, "Escribe tu correo electrónico")
  .email("Ese correo no parece válido")
  .toLowerCase();

/**
 * Requisitos de contraseña. Se muestran ANTES de escribir, nunca como error
 * posterior (SPEC.md §7.2).
 *
 * Longitud por encima de complejidad: obligar a símbolos produce contraseñas
 * como «Passw0rd!» que son peores que una frase larga, y empuja a la gente a
 * reutilizarlas.
 */
export const REQUISITOS_CONTRASENA = [
  "Al menos 10 caracteres",
  "Una letra y un número",
] as const;

const contrasena = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .regex(/[a-zA-Z]/, "La contraseña debe incluir al menos una letra")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número");

export const esquemaIngreso = z.object({
  correo,
  contrasena: z.string().min(1, "Escribe tu contraseña"),
});

export const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre"),
  apellidos: z.string().trim().min(1, "Escribe tus apellidos"),
  /*
   * Campo libre a propósito: acepta cédula, tarjeta de identidad, cédula de
   * extranjería, pasaporte o permiso. Un desplegable de tipos dejaría fuera a
   * quien no encaje en la lista, y quien evalúa a personal operativo se topa
   * con todas esas variantes.
   *
   * Es la identidad de la persona en la plataforma: lo que permite reconocer
   * que quien acepta la invitación de una empresa es quien ya tenía cuenta.
   */
  documento: z
    .string()
    .trim()
    .min(4, "El documento es demasiado corto")
    .max(30, "El documento es demasiado largo"),
  correo,
  contrasena,
});

export const esquemaRecuperar = z.object({ correo });

export const esquemaNuevaContrasena = z.object({ contrasena });

export type EstadoFormulario = {
  ok: boolean;
  /** Mensaje general del formulario. */
  mensaje?: string;
  /** Errores por campo, para pintarlos bajo cada uno. */
  errores?: Record<string, string>;
};

/** Traduce un ZodError al formato que consumen los formularios. */
export function erroresDeZod(error: z.ZodError): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path[0];
    if (typeof campo === "string" && !salida[campo]) {
      salida[campo] = issue.message;
    }
  }
  return salida;
}
