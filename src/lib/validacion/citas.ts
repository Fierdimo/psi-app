import { z } from "zod";

export const esquemaSolicitud = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora"),
  modalidad: z.enum(["presencial", "virtual"], {
    message: "Elige la modalidad",
  }),
  nota: z
    .string()
    .trim()
    .max(500, "El mensaje no puede pasar de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export const esquemaReprogramacion = z.object({
  cita: z.string().uuid("Cita no válida"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora"),
});

export const esquemaCancelacion = z.object({
  cita: z.string().uuid("Cita no válida"),
  motivo: z
    .string()
    .trim()
    .max(500, "El motivo no puede pasar de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});
