import { useCallback, useRef } from "react";

const COLORS = ["#c084fc", "#a855f7", "#f472b6", "#facc15", "#34d399", "#60a5fa"];

/**
 * A small GSAP-driven confetti burst - no extra dependency, just spawns a
 * handful of colored squares at a point and flings them outward with
 * gravity. Used to celebrate a completed daily quest / Blox reward.
 */
export function useConfetti() {
  const busy = useRef(false);

  const burst = useCallback(async (origin?: { x: number; y: number }) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { gsap } = await import("gsap");
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight / 3;

      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden;";
      document.body.appendChild(container);

      const pieces: HTMLElement[] = [];
      const count = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 42;
      for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        const size = 6 + Math.random() * 6;
        piece.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${
          COLORS[i % COLORS.length]
        };border-radius:${Math.random() > 0.5 ? "50%" : "2px"};opacity:0.95;`;
        container.appendChild(piece);
        pieces.push(piece);
      }

      pieces.forEach((piece) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 90 + Math.random() * 160;
        gsap.to(piece, {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance * 0.6 - 40,
          rotation: Math.random() * 360,
          duration: 0.5 + Math.random() * 0.3,
          ease: "power2.out",
        });
        gsap.to(piece, {
          y: `+=${220 + Math.random() * 120}`,
          opacity: 0,
          rotation: `+=${Math.random() > 0.5 ? 180 : -180}`,
          duration: 0.9 + Math.random() * 0.4,
          delay: 0.45,
          ease: "power1.in",
        });
      });

      window.setTimeout(() => {
        container.remove();
        busy.current = false;
      }, 1700);
    } catch {
      busy.current = false;
    }
  }, []);

  return burst;
}
