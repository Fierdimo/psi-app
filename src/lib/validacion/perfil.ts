import { z } from "zod";

import { ZONAS_VALIDAS } from "@/lib/fechas/zonas";

const opcional = (esquema: z.ZodString) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || esquema.safeParse(v).success, {
      message: "Ese valor no es válido",
    });

export const esquemaDatosPersonales = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre"),
  apellidos: z.string().trim().min(1, "Escribe tus apellidos"),
  telefono: opcional(
    z
      .string()
      .min(7, "El teléfono debe tener al menos 7 dígitos")
      .regex(/^[+\d\s()-]+$/, "El teléfono solo admite números y + ( ) -"),
  ),
  fecha_nacimiento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine(
      (v) => {
        if (v === null) return true;
        const fecha = new Date(v);
        if (Number.isNaN(fecha.getTime())) return false;
        // Ni el futuro ni 140 años atrás son fechas de nacimiento plausibles.
        const hoy = new Date();
        const limite = new Date();
        limite.setFullYear(hoy.getFullYear() - 140);
        return fecha <= hoy && fecha >= limite;
      },
      { message: "Esa fecha no parece correcta" },
    ),
  documento: opcional(z.string().min(4, "El documento parece demasiado corto")),
});

export const esquemaPreferencias = z.object({
  timezone: z.enum(ZONAS_VALIDAS as unknown as [string, ...string[]], {
    message: "Elige una zona horaria de la lista",
  }),
  recordatorios_email: z.boolean(),
});

export const esquemaCambioCorreo = z.object({
  correo: z
    .string()
    .trim()
    .min(1, "Escribe el nuevo correo")
    .email("Ese correo no parece válido")
    .toLowerCase(),
});

export const esquemaCambioContrasena = z
  .object({
    actual: z.string().min(1, "Escribe tu contraseña actual"),
    nueva: z
      .string()
      .min(10, "La contraseña debe tener al menos 10 caracteres")
      .regex(/[a-zA-Z]/, "La contraseña debe incluir al menos una letra")
      .regex(/[0-9]/, "La contraseña debe incluir al menos un número"),
  })
  .refine((d) => d.actual !== d.nueva, {
    path: ["nueva"],
    message: "La contraseña nueva debe ser distinta de la actual",
  });

export const esquemaEliminacion = z.object({
  motivo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  confirmacion: z.literal("ELIMINAR", {
    message: "Escribe ELIMINAR en mayúsculas para confirmar",
  }),
});
