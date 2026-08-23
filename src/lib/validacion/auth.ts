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

/**
 * El alta pública, que es la de una EMPRESA.
 *
 * Antes pedía nombre, apellidos y documento de identidad: eran los datos de un
 * paciente, y el documento era su identidad en la plataforma —lo que permitía
 * reconocer que quien aceptaba la invitación de una empresa ya tenía cuenta—.
 * Ese circuito no existe: quien responde una evaluación no llega a tener
 * cuenta, así que aquí no hay ninguna identidad que reconocer.
 *
 * Lo que se pide ahora son dos cosas distintas en un solo formulario: los
 * datos de la organización y los de quien va a administrarla.
 */
export const esquemaRegistro = z.object({
  empresaNombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la empresa")
    .max(160, "El nombre es demasiado largo"),
  /*
   * El NIT es opcional a propósito, y lo era ya en el modelo de datos: se
   * puede empezar a trabajar con una empresa antes de tener su papeleo
   * completo, y exigirlo aquí frena el alta por un dato que nadie necesita
   * hasta facturar.
   */
  empresaNit: z
    .string()
    .trim()
    .max(40, "El NIT es demasiado largo")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  empresaTelefono: z
    .string()
    .trim()
    .max(40, "El teléfono es demasiado largo")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  nombre: z.string().trim().min(1, "Escribe tu nombre"),
  apellidos: z.string().trim().min(1, "Escribe tus apellidos"),
  correo,
  contrasena,
});

export const esquemaRecuperar = z.object({ correo });

export const esquemaNuevaContrasena = z.object({ contrasena });

/**
 * Un acceso listo para entregar en mano.
 *
 * Existe en claro este instante y no vuelve: los testigos de invitación se
 * guardan como hash y de la base no se recuperan. Si el correo no llega
 * —dirección vieja, carpeta de spam, o sencillamente no hay servicio de correo
 * contratado— esta pantalla es la única forma de entregar el acceso.
 */
export type EnlaceDeAcceso = {
  nombre: string;
  correo: string;
  enlace: string;
  /**
   * La hora a la que se le espera, si el profesional ya repartió el día.
   *
   * Va con el enlace porque se reparten juntos: quien recibe un pase sin hora
   * pregunta «¿a qué hora?», y esa vuelta es justo la que esta pantalla existe
   * para ahorrar.
   */
  hora?: string | null;
  /**
   * Sin cuenta y sin invitación viva. No debería pasar —se preparan al
   * confirmar la sesión— pero omitir a esa persona de la lista la dejaría sin
   * pase y sin nadie que lo notara.
   */
  sinPase?: boolean;
};

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
