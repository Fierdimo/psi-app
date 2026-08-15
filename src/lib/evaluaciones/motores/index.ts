/**
 * El registro de motores.
 *
 * Cada motor se registra al importarse, así que este archivo es el único sitio
 * donde hay que acordarse de añadir uno nuevo. Importar el registro sin pasar
 * por aquí daría «no hay motor para tal clave» sobre un instrumento que sí
 * existe, y el error apuntaría al sitio equivocado.
 */
import "./disc-dominancia.ts";

export { motorDe } from "../motor.ts";
