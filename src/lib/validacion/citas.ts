import { z } from "zod";

/*
 * `guid` y no `uuid`: en Zod 4, `.uuid()` exige un UUID conforme a RFC 4122,
 * con sus bits de versión y variante. Postgres acepta cualquier valor de 128
 * bits con esa forma, así que un identificador perfectamente válido para la
 * base podía ser rechazado aquí. Se valida la forma, que es lo que nos
 * corresponde comprobar.
 */

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
  cita: z.guid("Cita no válida"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora"),
});

export const esquemaCancelacion = z.object({
  cita: z.guid("Cita no válida"),
  motivo: z
    .string()
    .trim()
    .max(500, "El motivo no puede pasar de 500 caracteres")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});
