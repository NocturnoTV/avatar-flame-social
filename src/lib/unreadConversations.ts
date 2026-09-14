import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const UNREAD_CONVERSATIONS_KEY = "unread-conversations";

/**
 * Real count of conversations with an unread message (last_message_at newer
 * than my own last_read_at) — used for the Messages badge everywhere
 * (bottom nav, side nav, the Sparks menu). Kept live via realtime so the
 * badge clears the moment a conversation is actually read, instead of
 * waiting on the 20s poll.
 */
export function useUnreadConversations() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data = 0 } = useQuery({
    queryKey: [UNREAD_CONVERSATIONS_KEY, user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const [{ data: mine }, { data: convos }] = await Promise.all([
        supabase
          .from("conversation_participants")
          .select("conversation_id,last_read_at")
          .eq("user_id", user!.id),
        supabase.from("conversations").select("id,last_message_at").eq("request_status", "accepted"),
      ]);
      const readAt = new Map((mine ?? []).map((m) => [m.conversation_id, m.last_read_at]));
      const mineIds = new Set((mine ?? []).map((m) => m.conversation_id));
      return (convos ?? []).filter((c) => {
        if (!mineIds.has(c.id)) return false;
        const lastRead = readAt.get(c.id);
        return !lastRead || new Date(c.last_message_at).getTime() > new Date(lastRead).getTime();
      }).length;
    },
  });

  useEffect(() => {
    if (!user) return;
    const invalidate = () =>
      void qc.invalidateQueries({ queryKey: [UNREAD_CONVERSATIONS_KEY, user.id] });
    const channel = supabase
      .channel(`unread-conversations-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, invalidate)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return data;
}
