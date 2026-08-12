"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Movimiento de la landing pública (SPEC.md §2.6, excepción de la landing).
 *
 * Dentro de la aplicación el movimiento solo orienta. Aquí, en la superficie
 * comercial, además persuade: es lo que separa una consulta viva de un
 * documento. La excepción está acotada a `/` y documentada en el spec.
 *
 * Tres reglas que NO decaen con la excepción:
 *  - `prefers-reduced-motion` desactiva todo. No se atenúa: se apaga.
 *  - Nada se mueve en bucle. Todo termina y se queda quieto.
 *  - El movimiento nunca retrasa la lectura: entradas de 400 ms como máximo y
 *    escalonados de 60 ms, no de 300.
 */

const CURVA = [0.2, 0, 0, 1] as const;

/**
 * Aparición al entrar en pantalla. Una sola vez, nunca al volver a subir.
 *
 * REGLA DURA: el marcado del servidor sale VISIBLE. `initial={false}` impide
 * que se serialice `opacity: 0`, y el bloque solo se esconde después, ya en el
 * cliente, y únicamente si está por debajo del pliegue —donde esconderlo no
 * puede verse—. Si el JavaScript nunca corre, la página se lee entera.
 *
 * Esto no es una precaución teórica: al servir el sitio por un túnel de
 * desarrollo el guion no llegó a ejecutarse y la landing apareció en blanco,
 * con todo el texto dentro del HTML pero invisible.
 */
export function Revelar({
  children,
  retraso = 0,
  className,
}: {
  children: ReactNode;
  /** Escalonado en segundos. */
  retraso?: number;
  className?: string;
}) {
  const sinMovimiento = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || sinMovimiento) return;

    // Ya a la vista: se queda como está. Esconderlo ahora sería un parpadeo.
    if (el.getBoundingClientRect().top <= window.innerHeight) return;

    setOculto(true);
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setOculto(false);
        observador.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [sinMovimiento]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={oculto ? { opacity: 0, y: 14 } : { opacity: 1, y: 0 }}
      // Esconder es instantáneo y ocurre fuera de pantalla; solo la aparición
      // se anima.
      transition={
        oculto
          ? { duration: 0 }
          : { duration: 0.4, delay: retraso, ease: CURVA }
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Entrada del hero, en CSS (`.entrada` de globals.css).
 *
 * No usa `motion` a propósito: una animación de montaje en JavaScript exige
 * servir el hero invisible, y ese es justo el fallo que dejaba la página en
 * blanco sin guion. En CSS la animación corre sola y termina siempre visible.
 */
export function EntradaHero({
  children,
  retraso = 0,
  className,
}: {
  children: ReactNode;
  /** Escalonado en segundos. */
  retraso?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("entrada", className)}
      style={retraso ? { animationDelay: `${retraso}s` } : undefined}
    >
      {children}
    </div>
  );
}

/** Barra de progreso de lectura. Orienta en una página larga de una sola pieza. */
export function BarraProgreso() {
  const sinMovimiento = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const avance = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  });

  if (sinMovimiento) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: avance }}
      className="bg-accent absolute inset-x-0 bottom-0 h-0.5 origin-left"
    />
  );
}

/**
 * Composición del hero: disco de acento, motivo de marca y retrato recortado.
 *
 * El retrato original es casi cuadrado (479×521). Metido en una caja
 * rectangular sobraba fondo por los lados y la relación entre foto y panel
 * parecía accidental. Aquí manda la foto: el disco se inscribe en un cuadrado,
 * el retrato se apoya en su base y la cabeza rompe el borde superior. La
 * proporción de la imagen nunca se toca —`object-contain` y alto automático—;
 * lo que cambia es el marco.
 *
 * El disco y el retrato se desplazan a distinta velocidad al hacer scroll. Son
 * 28 px de diferencia: suficiente para que la composición tenga profundidad,
 * demasiado poco para marear.
 */
export function Retrato({ className }: { className?: string }) {
  const sinMovimiento = useReducedMotion();
  const { scrollY } = useScroll();
  const yRetrato = useTransform(scrollY, [0, 700], [0, -36]);
  const yDisco = useTransform(scrollY, [0, 700], [0, -8]);

  const quieto = sinMovimiento ?? false;

  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[400px]",
        className,
      )}
    >
      {/* Disco y anillo: decorativos, nunca anunciados.
          Aquí estuvo la marca de la consulta, y se quitó: el retrato la tapaba
          casi entera y lo poco que asomaba se leía como una mancha. Además es
          un perfil humano, así que competía con la cabeza que tiene delante.
          El anillo concéntrico da la misma profundidad y sí se ve. */}
      <motion.div
        aria-hidden="true"
        style={quieto ? undefined : { y: yDisco }}
        className="absolute inset-0"
      >
        <div className="border-accent-soft-border absolute inset-[-5%] rounded-full border" />
        <div className="bg-accent-soft absolute inset-0 rounded-full" />
      </motion.div>

      {/* La aparición va en CSS (`.entrada`) y el desplazamiento por scroll en
          JavaScript: así el retrato se ve aunque el guion no corra, y solo se
          pierde el efecto de profundidad, que es prescindible. */}
      <motion.div
        style={quieto ? undefined : { y: yRetrato }}
        className="entrada absolute inset-x-0 bottom-0 flex justify-center"
      >
        <Image
          src="/retrato-jbr.png"
          alt="Jesús Banquez Ramírez"
          width={479}
          height={521}
          priority
          sizes="(max-width: 640px) 300px, 400px"
          // El recorte del original termina en un corte recto a la altura de
          // la cintura. Sin desvanecerlo, la silueta se lee como una pegatina
          // pegada encima del disco en vez de apoyada en él.
          style={{
            // color-guard-ignore: en una máscara el color no se pinta, se lee
            // como canal alfa — `black` significa «opaco» y `transparent`
            // significa «invisible». Ningún píxel negro llega a la pantalla.
            maskImage: "linear-gradient(to bottom, black 76%, transparent 98%)",
          }}
          className="h-auto w-[104%] max-w-none object-contain"
        />
      </motion.div>
    </div>
  );
}
