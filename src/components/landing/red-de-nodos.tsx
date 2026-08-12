"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Red de nodos viva del hero (SPEC.md §2.6, excepción de la landing).
 *
 * No es un adorno cualquiera: la marca de la consulta es un perfil humano
 * trazado como red de nodos, y su promesa es «mediciones y evaluaciones». Esta
 * pieza es ese mismo lenguaje puesto en movimiento — la única metáfora del
 * hero que sale del oficio del profesional y no de un catálogo de efectos.
 *
 * Decisiones que la mantienen del lado del buen gusto:
 *  - Vive DETRÁS del contenido y muy bajada de opacidad. Si compite con el
 *    nombre, sobra.
 *  - El puntero repele los nodos, no los atrae. Atraerlos los apelmaza en el
 *    cursor y a los pocos segundos la red queda destruida.
 *  - Se detiene cuando la sección sale de pantalla: nadie debe pagar batería
 *    por una animación que no está viendo.
 *  - Con `prefers-reduced-motion` se pinta UN cuadro y se para. Queda la
 *    composición, desaparece el movimiento.
 *
 * Los colores se leen de los tokens en tiempo de ejecución. El canvas no puede
 * usar clases, así que esta es la forma de no escribir un color a mano.
 */

type Nodo = { x: number; y: number; vx: number; vy: number };

/** Un nodo por cada ~16 000 px², con techo para no castigar pantallas grandes. */
const DENSIDAD = 1 / 16000;
const MAX_NODOS = 64;
/** Distancia a la que dos nodos se enlazan, en px CSS. */
const ENLACE = 132;
/** Radio de influencia del puntero. */
const PUNTERO = 150;

export function RedDeNodos({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const lienzo = ref.current;
    const ctx = lienzo?.getContext("2d");
    if (!lienzo || !ctx) return;

    const raiz = getComputedStyle(document.documentElement);
    const colorNodo = raiz.getPropertyValue("--color-brand-600").trim();
    const colorEnlace = raiz.getPropertyValue("--color-brand-400").trim();

    const sinMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let nodos: Nodo[] = [];
    let ancho = 0;
    let alto = 0;
    let cuadro = 0;
    let enPantalla = true;
    const puntero = {
      x: Number.NEGATIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
    };

    function medir() {
      const caja = lienzo!.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) return;

      // Se topa en 2: por encima, el coste de pintar crece sin que se note.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = caja.width;
      alto = caja.height;
      lienzo!.width = Math.round(ancho * dpr);
      lienzo!.height = Math.round(alto * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cuantos = Math.min(
        MAX_NODOS,
        Math.round(ancho * alto * DENSIDAD) || 1,
      );
      nodos = Array.from({ length: cuantos }, () => ({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
      }));
    }

    function pintar() {
      ctx!.clearRect(0, 0, ancho, alto);

      ctx!.strokeStyle = colorEnlace;
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodos.length; i++) {
        for (let j = i + 1; j < nodos.length; j++) {
          const dx = nodos[i].x - nodos[j].x;
          const dy = nodos[i].y - nodos[j].y;
          const distancia = Math.hypot(dx, dy);
          if (distancia > ENLACE) continue;
          ctx!.globalAlpha = (1 - distancia / ENLACE) * 0.75;
          ctx!.beginPath();
          ctx!.moveTo(nodos[i].x, nodos[i].y);
          ctx!.lineTo(nodos[j].x, nodos[j].y);
          ctx!.stroke();
        }
      }

      ctx!.fillStyle = colorNodo;
      for (const nodo of nodos) {
        const cerca = Math.max(
          0,
          1 - Math.hypot(nodo.x - puntero.x, nodo.y - puntero.y) / PUNTERO,
        );
        ctx!.globalAlpha = 0.55 + cerca * 0.45;
        ctx!.beginPath();
        ctx!.arc(nodo.x, nodo.y, 2 + cerca * 2.2, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;
    }

    function avanzar() {
      for (const nodo of nodos) {
        nodo.x += nodo.vx;
        nodo.y += nodo.vy;

        // Rebote en los bordes: mantiene la nube dentro sin recolocar nada.
        if (nodo.x <= 0 || nodo.x >= ancho) nodo.vx *= -1;
        if (nodo.y <= 0 || nodo.y >= alto) nodo.vy *= -1;
        nodo.x = Math.min(Math.max(nodo.x, 0), ancho);
        nodo.y = Math.min(Math.max(nodo.y, 0), alto);

        const dx = nodo.x - puntero.x;
        const dy = nodo.y - puntero.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia < PUNTERO && distancia > 0.5) {
          const empuje = (1 - distancia / PUNTERO) * 0.9;
          nodo.x += (dx / distancia) * empuje;
          nodo.y += (dy / distancia) * empuje;
        }
      }
    }

    function bucle() {
      if (enPantalla) {
        avanzar();
        pintar();
      }
      cuadro = requestAnimationFrame(bucle);
    }

    medir();

    if (sinMovimiento) {
      pintar();
      return;
    }

    function alMover(evento: PointerEvent) {
      const caja = lienzo!.getBoundingClientRect();
      puntero.x = evento.clientX - caja.left;
      puntero.y = evento.clientY - caja.top;
    }

    function alSalir() {
      puntero.x = Number.NEGATIVE_INFINITY;
      puntero.y = Number.NEGATIVE_INFINITY;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        enPantalla = entrada.isIntersecting;
      },
      { threshold: 0 },
    );
    observador.observe(lienzo);

    const observadorTamano = new ResizeObserver(() => medir());
    observadorTamano.observe(lienzo);

    window.addEventListener("pointermove", alMover, { passive: true });
    window.addEventListener("pointerleave", alSalir);
    cuadro = requestAnimationFrame(bucle);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      observadorTamano.disconnect();
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerleave", alSalir);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
    />
  );
}
