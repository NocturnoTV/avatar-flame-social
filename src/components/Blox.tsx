import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/** The Blox currency mark: a purple/fuchsia coin with a four-point sparkle,
 * used everywhere a Blox amount is shown (balance chips, pack cards, prices
 * on the Blox Store). Pure inline SVG so it themes and scales cleanly. */
export function BloxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-4 w-4", className)} aria-hidden>
      <defs>
        <linearGradient
          id="bloxCoinGrad"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#e9a6ff" />
          <stop offset="55%" stopColor="#c355f5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="17" r="13" fill="#2f1152" />
      <circle cx="16" cy="15" r="13" fill="url(#bloxCoinGrad)" />
      <circle cx="16" cy="15" r="9.5" fill="#2f1152" />
      <path
        d="M16 8.5 L18.3 13.7 L23.5 16 L18.3 18.3 L16 23.5 L13.7 18.3 L8.5 16 L13.7 13.7 Z"
        fill="#e9a6ff"
      />
      <path d="M16 8.5 L18.3 13.7 L23.5 16 L18.3 18.3 L16 23.5 Z" fill="#c355f5" />
      <path
        d="M23.5 6.5 L24.6 9 L27.1 10 L24.6 11 L23.5 13.5 L22.4 11 L19.9 10 L22.4 9 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Reads the signed-in user's own Blox balance. Only ever fetches by our own
 * id - blox_balance sits on the broadly-readable `profiles` row, so we rely
 * on never querying it for anyone else rather than a column-level policy
 * (Postgres RLS has no such thing). */
export function useBloxBalance() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["blox-balance", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("blox_balance")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.blox_balance ?? 0;
    },
  });
}

export function useInvalidateBloxBalance() {
  const { user } = useSession();
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["blox-balance", user?.id] });
}

/** Small "🪙 1 234" chip - the standard top-right balance display used on
 * the shop, Blox Store, Rewards and billing pages. */
export function BloxBalanceChip({ className }: { className?: string }) {
  const balance = useBloxBalance();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-black text-primary",
        className,
      )}
    >
      <BloxIcon className="h-4 w-4" />
      {(balance.data ?? 0).toLocaleString()}
    </span>
  );
}

/** The Blox Store badges a profile currently has equipped, shown as a small
 * row of emoji next to the username - same idea as Discord's badge row. */
export function EquippedBadges({
  userId,
  className,
}: {
  userId: string | undefined;
  className?: string;
}) {
  const badges = useQuery({
    queryKey: ["profile-badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId!)
        .eq("equipped", true);
      const ids = (rows ?? []).map((r) => r.badge_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("badges").select("id,name,emoji").in("id", ids);
      return data ?? [];
    },
  });
  if (!badges.data?.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {badges.data.map((b) => (
        <span key={b.id} title={b.name} className="text-base leading-none">
          {b.emoji}
        </span>
      ))}
    </span>
  );
}
