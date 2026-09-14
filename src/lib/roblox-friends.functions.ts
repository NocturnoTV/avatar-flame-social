import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Roblox friend lists are public data on the classic Roblox API (no OAuth
 * scope needed beyond the account link we already have) — this cross-
 * references the signed-in user's Roblox friends against BloxSpark
 * accounts that have linked the same Roblox user ID.
 */
export const getRobloxFriendSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ robloxUserIds: string[] }> => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("roblox_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me?.roblox_user_id) return { robloxUserIds: [] };

    try {
      const response = await fetch(
        `https://friends.roblox.com/v1/users/${encodeURIComponent(me.roblox_user_id)}/friends`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
      );
      if (!response.ok) return { robloxUserIds: [] };
      const payload = (await response.json()) as { data?: { id?: number }[] };
      const ids = (payload.data ?? [])
        .map((f) => (typeof f.id === "number" ? String(f.id) : null))
        .filter((id): id is string => id !== null);
      return { robloxUserIds: ids };
    } catch {
      // A private friends list, rate limit, or Roblox hiccup — the
      // suggestion feature just quietly has nothing from this source.
      return { robloxUserIds: [] };
    }
  });
