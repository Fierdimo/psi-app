/**
 * Zonas horarias ofrecidas en el perfil.
 *
 * Se guarda el identificador IANA, nunca un desplazamiento: «-05:00» deja de
 * ser cierto en cuanto hay horario de verano o la persona se muda, y una cita
 * mal convertida es una sesión perdida (PLAN.md §10).
 *
 * La lista cubre Latinoamérica y España porque es donde estarán los pacientes.
 * No se ofrece el catálogo IANA completo: 400 opciones en un desplegable no
 * ayudan a nadie a encontrar la suya.
 */
export const ZONAS_HORARIAS = [
  { valor: "America/Bogota", etiqueta: "Bogotá, Lima, Quito (GMT−5)" },
  { valor: "America/Mexico_City", etiqueta: "Ciudad de México (GMT−6)" },
  { valor: "America/Argentina/Buenos_Aires", etiqueta: "Buenos Aires (GMT−3)" },
  { valor: "America/Santiago", etiqueta: "Santiago de Chile (GMT−4/−3)" },
  { valor: "America/Sao_Paulo", etiqueta: "São Paulo (GMT−3)" },
  { valor: "America/Caracas", etiqueta: "Caracas (GMT−4)" },
  { valor: "America/La_Paz", etiqueta: "La Paz (GMT−4)" },
  { valor: "America/Asuncion", etiqueta: "Asunción (GMT−4/−3)" },
  { valor: "America/Montevideo", etiqueta: "Montevideo (GMT−3)" },
  { valor: "America/Panama", etiqueta: "Panamá (GMT−5)" },
  { valor: "America/Costa_Rica", etiqueta: "San José (GMT−6)" },
  { valor: "America/Guatemala", etiqueta: "Guatemala, San Salvador (GMT−6)" },
  { valor: "America/Santo_Domingo", etiqueta: "Santo Domingo (GMT−4)" },
  { valor: "America/New_York", etiqueta: "Nueva York, Miami (GMT−5/−4)" },
  { valor: "America/Los_Angeles", etiqueta: "Los Ángeles (GMT−8/−7)" },
  { valor: "Europe/Madrid", etiqueta: "Madrid (GMT+1/+2)" },
] as const;

export const ZONAS_VALIDAS = ZONAS_HORARIAS.map((z) => z.valor);

/**
 * Nombre de ciudad en español, con su acentuación.
 *
 * Los identificadores IANA son ASCII —`America/Bogota`, `America/Mexico_City`—
 * así que derivar el nombre del identificador produce «Bogota» y «Mexico
 * City». En un producto en español eso se lee como descuido.
 */
export const CIUDAD_DE_ZONA: Record<string, string> = {
  "America/Bogota": "Bogotá",
  "America/Mexico_City": "Ciudad de México",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Santiago": "Santiago",
  "America/Sao_Paulo": "São Paulo",
  "America/Caracas": "Caracas",
  "America/La_Paz": "La Paz",
  "America/Asuncion": "Asunción",
  "America/Montevideo": "Montevideo",
  "America/Panama": "Panamá",
  "America/Costa_Rica": "San José",
  "America/Guatemala": "Guatemala",
  "America/Santo_Domingo": "Santo Domingo",
  "America/New_York": "Nueva York",
  "America/Los_Angeles": "Los Ángeles",
  "Europe/Madrid": "Madrid",
};

export function etiquetaDeZona(valor: string) {
  return ZONAS_HORARIAS.find((z) => z.valor === valor)?.etiqueta ?? valor;
}

/** Zona que el navegador cree que es la del dispositivo. */
export function zonaDelDispositivo() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
