import type { ReactNode } from "react";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

/**
 * Fades + slides its children into place the first time they scroll into
 * view. Wrap any section with it: <Reveal><section>...</section></Reveal>.
 * `delay` staggers a group of Reveals (in ms); `y` controls travel distance.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transform: inView ? "translateY(0)" : `translateY(${y}px)`,
      }}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
