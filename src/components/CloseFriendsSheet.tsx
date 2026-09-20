import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { StoredImage } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { Sheet } from "@/components/ui-kit";

/** Manages the private "close friends" list used to gate a Story's audience
 * to fewer people than all followers. Only ever shown to the list's owner -
 * nobody else can see who's on it (see the close_friends RLS policy). */
export function CloseFriendsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const closeFriends = useQuery({
    queryKey: ["close-friends", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("close_friends")
        .select("friend_id")
        .eq("user_id", user!.id);
      const ids = (rows ?? []).map((r) => r.friend_id);
      if (!ids.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);
      return people ?? [];
    },
  });

  const followers = useQuery({
    queryKey: ["close-friends-candidates", user?.id, search.trim()],
    enabled: open && !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", user!.id);
      const ids = (rows ?? []).map((r) => r.follower_id);
      if (!ids.length) return [];
      let query = supabase.from("profiles").select("id,username,avatar_url").in("id", ids);
      if (search.trim()) query = query.ilike("username", `%${search.trim()}%`);
      const { data } = await query.limit(30);
      return data ?? [];
    },
  });

  async function add(friendId: string) {
    if (!user) return;
    await supabase.from("close_friends").upsert({ user_id: user.id, friend_id: friendId });
    void qc.invalidateQueries({ queryKey: ["close-friends", user.id] });
  }

  async function remove(friendId: string) {
    if (!user) return;
    await supabase.from("close_friends").delete().eq("user_id", user.id).eq("friend_id", friendId);
    void qc.invalidateQueries({ queryKey: ["close-friends", user.id] });
  }

  const closeIds = new Set((closeFriends.data ?? []).map((p) => p.id));

  return (
    <Sheet open={open} onClose={onClose} title={t("closeFriendsTitle")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("closeFriendsHint")}</p>

      {closeFriends.data?.length ? (
        <div className="mb-4 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("closeFriendsCurrentList", { count: closeFriends.data.length })}
          </p>
          {closeFriends.data.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl p-1.5">
              <StoredImage
                path={p.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full"
                fallback={p.username?.[0]?.toUpperCase() ?? "?"}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">@{p.username}</span>
              <button
                onClick={() => void remove(p.id)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("closeFriendsRemove")}
              >
                <UserMinus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <label className="mb-2 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("closeFriendsSearchFollowers")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <div className="max-h-[35dvh] space-y-1.5 overflow-y-auto">
        {(followers.data ?? [])
          .filter((p) => !closeIds.has(p.id))
          .map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl p-1.5">
              <StoredImage
                path={p.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full"
                fallback={p.username?.[0]?.toUpperCase() ?? "?"}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">@{p.username}</span>
              <button
                onClick={() => void add(p.id)}
                className="rounded-full p-1.5 text-primary hover:bg-primary/10"
                aria-label={t("closeFriendsAdd")}
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          ))}
        {!followers.data?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("closeFriendsNoFollowers")}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
