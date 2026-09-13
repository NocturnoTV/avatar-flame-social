import { cn } from "@/lib/utils";

export type PresenceProfile = {
  last_active_at?: string | null;
  show_online_status?: boolean | null;
  dnd?: boolean | null;
};

export function isRecentlyActive(lastActiveAt: string | null | undefined) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000;
}

export type PresenceStatus = "online" | "offline" | "dnd";

/** The color a viewer should see, honoring the target's own privacy choices. */
export function presenceStatus(profile: PresenceProfile): PresenceStatus {
  if (profile.dnd) return "dnd";
  if (profile.show_online_status === false) return "offline";
  return isRecentlyActive(profile.last_active_at) ? "online" : "offline";
}

/**
 * Small colored ring shown on a profile photo: green = online, gray =
 * offline, red = do not disturb. Never used on video thumbnails — only on
 * real profile-picture spots (messages, conversation header, profile pages).
 */
export function PresenceDot({
  profile,
  className,
}: {
  profile: PresenceProfile;
  className?: string;
}) {
  const status = presenceStatus(profile);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block rounded-full border-2 border-background",
        status === "online" && "bg-[#20D778]",
        status === "dnd" && "bg-red-500",
        status === "offline" && "bg-muted-foreground/50",
        className,
      )}
    />
  );
}
