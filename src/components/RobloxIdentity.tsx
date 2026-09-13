import { cn } from "@/lib/utils";

export function RobloxMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid h-5 w-5 shrink-0 place-items-center rounded-md bg-black shadow-sm",
        className,
      )}
      title="Roblox"
    >
      <img src="/roblox-logo-white.png" alt="Roblox" className="h-3.5 w-3.5 object-contain" />
    </span>
  );
}

export function RobloxIdentity({
  displayName,
  username,
  className,
}: {
  displayName?: string | null | undefined;
  username?: string | null | undefined;
  className?: string;
}) {
  if (!displayName && !username) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <RobloxMark />
      <span className="truncate font-semibold">{displayName || username}</span>
      {displayName && username && displayName !== username ? (
        <span className="truncate text-muted-foreground">@{username}</span>
      ) : null}
    </span>
  );
}
