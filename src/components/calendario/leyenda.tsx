import { ASPECTO, type EstadoCita } from "@/lib/citas/estados";

const MOSTRADOS: EstadoCita[] = [
  "confirmada",
  "solicitada",
  "realizada",
  "cancelada",
];

/**
 * Leyenda de estados.
 *
 * Existe porque el calendario usa forma además de color —borde punteado para
 * lo pendiente, tachado para lo cancelado— y esas convenciones hay que
 * enseñarlas una vez. También es la red de seguridad para quien no distingue
 * los tonos.
 */
export function Leyenda() {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-text-muted text-micro font-semibold tracking-[0.08em] uppercase">
        Estados
      </h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-2">
        {MOSTRADOS.map((estado) => {
          const aspecto = ASPECTO[estado];
          return (
            <li
              key={estado}
              className="text-text-body flex items-center gap-2 text-sm"
            >
              <span
                aria-hidden="true"
                className={`size-3.5 shrink-0 rounded-[3px] ${aspecto.chip}`}
              />
              {aspecto.etiqueta}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
