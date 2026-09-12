import { cn } from "@/lib/utils";

type Props = { code: string; className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={cn("h-4 w-6 shrink-0 rounded-[3px] shadow-sm ring-1 ring-black/10", className)}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function Flag({ code, className }: Props) {
  switch (code) {
    case "fr":
      return (
        <Svg className={className}>
          <rect width="8" height="16" fill="#0055A4" />
          <rect x="8" width="8" height="16" fill="#fff" />
          <rect x="16" width="8" height="16" fill="#EF4135" />
        </Svg>
      );
    case "en":
      return (
        <Svg className={className}>
          <rect width="24" height="16" fill="#fff" />
          {[0, 2, 4, 6].map((i) => (
            <rect key={i} y={i * 2 + 1.2} width="24" height="1.25" fill="#B22234" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={`b${i}`} y={i * 4} width="24" height="1.3" fill="#B22234" />
          ))}
          <rect width="11" height="8.6" fill="#3C3B6E" />
          {[1.6, 4.3, 7].map((y) =>
            [1.6, 4, 6.4, 8.8].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#fff" />
            )),
          )}
        </Svg>
      );
    case "es":
      return (
        <Svg className={className}>
          <rect width="24" height="16" fill="#AA151B" />
          <rect y="4" width="24" height="8" fill="#F1BF00" />
        </Svg>
      );
    case "pt":
      return (
        <Svg className={className}>
          <rect width="24" height="16" fill="#009B3A" />
          <path d="M12 2.2 21.6 8 12 13.8 2.4 8Z" fill="#FEDF00" />
          <circle cx="12" cy="8" r="3.2" fill="#002776" />
          <path d="M9 7.4c2 -0.9 4.2 -0.6 6 0.5" stroke="#fff" strokeWidth="0.7" fill="none" />
        </Svg>
      );
    case "de":
      return (
        <Svg className={className}>
          <rect width="24" height="16" fill="#000" />
          <rect y="5.33" width="24" height="5.33" fill="#DD0000" />
          <rect y="10.66" width="24" height="5.34" fill="#FFCE00" />
        </Svg>
      );
    case "ko":
      return (
        <Svg className={className}>
          <rect width="24" height="16" fill="#fff" />
          <path d="M12 4.6a3.4 3.4 0 0 1 0 6.8 3.4 3.4 0 0 0 0-6.8Z" fill="#0047A0" />
          <path d="M12 4.6a3.4 3.4 0 0 0 0 6.8 3.4 3.4 0 0 1 0-6.8Z" fill="#CD2E3A" />
          <g fill="#000">
            <rect x="3" y="3.4" width="3.4" height="0.6" transform="rotate(30 3 3.4)" />
            <rect x="17.4" y="12.1" width="3.4" height="0.6" transform="rotate(-30 17.4 12.1)" />
          </g>
        </Svg>
      );
    default:
      return (
        <Svg className={className}>
          <rect width="24" height="16" fill="#94a3b8" />
        </Svg>
      );
  }
}
