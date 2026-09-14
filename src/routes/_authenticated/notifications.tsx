import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications - Bloxspark" },
      { name: "description", content: "Tes matchs, likes et nouveaux messages sur Bloxspark." },
      { property: "og:title", content: "Notifications - Bloxspark" },
      { property: "og:description", content: "Ne rate aucun spark." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<string, string> = {
  match: "✨",
  like: "💖",
  message: "💬",
  system: "📣",
};

function NotificationsPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,kind,body,read,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel("notifications-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        void notifications.refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [notifications]);

  async function markAll() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    void notifications.refetch();
    void qc.invalidateQueries({ queryKey: ["unread-notifications"] });
  }

  // Viewing the list is enough to clear the badge - same "seen it" behavior
  // as opening a conversation, rather than requiring the explicit button.
  useEffect(() => {
    if (user) void markAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("notifications")}</h1>
        <Button variant="ghost" size="sm" onClick={markAll}>
          {t("markAllRead")}
        </Button>
      </header>

      <div className="mt-5 space-y-2">
        {(notifications.data ?? []).length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
        ) : null}
        {(notifications.data ?? []).map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 rounded-2xl border p-3 ${
              n.read ? "border-border bg-card" : "border-primary/40 bg-surface-2"
            }`}
          >
            <span className="text-xl">{ICONS[n.kind] ?? "🔔"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
