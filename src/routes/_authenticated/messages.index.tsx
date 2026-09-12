import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Sheet } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Messages — Bloxspark" },
      { name: "description", content: "Tes discussions privées et tes groupes Bloxspark." },
      { property: "og:title", content: "Messages — Bloxspark" },
      { property: "og:description", content: "Discute en privé ou en groupe, avec vocaux et emojis." },
    ],
  }),
  component: MessagesPage,
});

type Row = {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message_at: string | null;
  others: { id: string; username: string | null; verified?: boolean | null }[];
  preview: string;
};

function MessagesPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [newGroup, setNewGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: async (): Promise<Row[]> => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user?.id ?? "");
      const ids = (parts ?? []).map((p) => p.conversation_id);
      if (ids.length === 0) return [];
      const { data: convos } = await supabase
        .from("conversations")
        .select("id,is_group,name,last_message_at")
        .in("id", ids)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const { data: members } = await supabase
        .from("conversation_participants")
        .select("conversation_id,user_id")
        .in("conversation_id", ids);
      const otherIds = [...new Set((members ?? []).map((m) => m.user_id))].filter(
        (id) => id !== user?.id,
      );
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,verified")
        .in("id", otherIds.length > 0 ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("conversation_id,content,kind,created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });

      return (convos ?? []).map((c) => {
        const others = (members ?? [])
          .filter((m) => m.conversation_id === c.id && m.user_id !== user?.id)
          .map((m) => ({
            id: m.user_id,
            username: (people ?? []).find((p) => p.id === m.user_id)?.username ?? null,
            verified: (people ?? []).find((p) => p.id === m.user_id)?.verified ?? false,
          }));

        const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
        const preview =
          last?.kind === "voice"
            ? "🎙️ " + t("voiceMessage")
            : last?.kind === "image"
              ? "🖼️"
              : (last?.content ?? "");
        return { ...c, others, preview };
      });
    },
    enabled: !!user,
  });

  const matches = useQuery({
    queryKey: ["match-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("user_a,user_b")
        .or(`user_a.eq.${user?.id},user_b.eq.${user?.id}`);
      const ids = (data ?? []).map((m) => (m.user_a === user?.id ? m.user_b : m.user_a));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", ids);
      return profiles ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel("conversation-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void conversations.refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversations]);

  async function createGroup() {
    if (!groupTitle.trim() || selected.length === 0) return;
    const { error } = await supabase.rpc("create_group", {
      _name: groupTitle.trim(),
      _members: selected,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewGroup(false);
    setGroupTitle("");
    setSelected([]);
    void conversations.refetch();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("messages")}</h1>
        <Button size="sm" onClick={() => setNewGroup(true)}>
          <Plus className="h-4 w-4" /> {t("newGroup")}
        </Button>
      </header>

      <div className="mt-5 space-y-2">
        {(conversations.data ?? []).length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("noConversations")}</p>
        ) : null}
        {(conversations.data ?? []).map((c) => {
          const name = c.is_group ? c.name : (c.others[0]?.username ?? "?");
          return (
            <Link
              key={c.id}
              to="/messages/$id"
              params={{ id: c.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
            >
              <div className="spark-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white">
                {c.is_group ? "👥" : (name?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{name}</span>
                  {!c.is_group && c.others[0]?.verified ? <Verified /> : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{c.preview || "—"}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <Sheet open={newGroup} onClose={() => setNewGroup(false)} title={t("newGroup")}>
        <div className="space-y-4">
          <Input
            placeholder={t("groupName")}
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t("addMembers")}</p>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {(matches.data ?? []).map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--spark)]"
                  checked={selected.includes(m.id)}
                  onChange={(e) =>
                    setSelected((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))
                  }
                />
                {m.username}
              </label>
            ))}
            {(matches.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMatchesYet")}</p>
            ) : null}
          </div>
          <Button className="w-full" onClick={createGroup}>
            {t("create")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
