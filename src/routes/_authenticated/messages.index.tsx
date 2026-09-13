import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Heart, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Sheet } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { Verified } from "@/components/Verified";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Messages — Bloxspark" },
      { name: "description", content: "Tes discussions privées et tes groupes Bloxspark." },
      { property: "og:title", content: "Messages — Bloxspark" },
      {
        property: "og:description",
        content: "Discute en privé ou en groupe, avec vocaux et emojis.",
      },
    ],
  }),
  component: MessagesPage,
});

type Row = {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message_at: string | null;
  others: {
    id: string;
    username: string | null;
    avatar_url?: string | null;
    roblox_avatar_url?: string | null;
    verified?: boolean | null;
  }[];
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
        .select("id,username,avatar_url,roblox_avatar_url,verified")
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
            avatar_url: (people ?? []).find((p) => p.id === m.user_id)?.avatar_url ?? null,
            roblox_avatar_url:
              (people ?? []).find((p) => p.id === m.user_id)?.roblox_avatar_url ?? null,
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
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,roblox_avatar_url")
        .in("id", ids);
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
    <div className="mx-auto min-h-full w-full max-w-lg bg-background px-4 pt-4">
      <header className="grid grid-cols-[44px_1fr_44px] items-center">
        <button
          type="button"
          onClick={() => setNewGroup(true)}
          className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-muted"
          aria-label={t("newGroup")}
        >
          <UserRoundPlus className="h-6 w-6" />
        </button>
        <h1 className="text-center text-xl font-black">{t("messages")}</h1>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-muted"
          aria-label="Search"
        >
          <Search className="h-7 w-7" />
        </button>
      </header>

      <section className="scrollbar-none -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-3">
        <button
          type="button"
          onClick={() => setNewGroup(true)}
          className="w-[72px] shrink-0 text-center"
        >
          <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-primary/50 bg-muted">
            <UserRoundPlus className="h-6 w-6 text-primary" />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-primary text-sm font-bold text-white">
              +
            </span>
          </span>
          <span className="mt-2 block truncate text-xs font-bold">{t("create")}</span>
        </button>
        {(matches.data ?? []).slice(0, 8).map((match, index) => {
          const avatar = match.roblox_avatar_url ?? match.avatar_url;
          return (
            <div key={match.id} className="w-[72px] shrink-0 text-center">
              <span className="mx-auto block rounded-full bg-gradient-to-br from-sky-400 via-primary to-cyan-300 p-[3px]">
                <span className="grid h-[58px] w-[58px] place-items-center overflow-hidden rounded-full border-[3px] border-background bg-muted text-lg font-bold">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (match.username?.[0]?.toUpperCase() ?? "?")
                  )}
                </span>
              </span>
              <span className="mt-2 block truncate text-xs font-bold">
                {match.username ?? `Player ${index + 1}`}
              </span>
            </div>
          );
        })}
      </section>

      <div className="mt-3 space-y-1">
        <Link
          to="/notifications"
          className="flex items-center gap-4 rounded-2xl px-1 py-3 transition hover:bg-muted/60"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sky-500 text-white">
            <UsersRound className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-semibold">Nouveaux followers</strong>
            <span className="block truncate text-sm text-muted-foreground">
              Découvre les nouveaux membres qui te suivent
            </span>
          </span>
        </Link>
        <Link
          to="/notifications"
          className="flex items-center gap-4 rounded-2xl px-1 py-3 transition hover:bg-muted/60"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-pink-500 text-white">
            <Heart className="h-7 w-7 fill-current" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-semibold">Activité</strong>
            <span className="block truncate text-sm text-muted-foreground">
              Likes, commentaires et réactions
            </span>
          </span>
        </Link>

        {(conversations.data ?? []).length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("noConversations")}</p>
        ) : null}
        {(conversations.data ?? []).map((c) => {
          const name = c.is_group ? c.name : (c.others[0]?.username ?? "?");
          return (
            <Link
              key={c.id}
              to="/messages/$id"
              params={{ id: c.id }}
              className="flex items-center gap-4 rounded-2xl px-1 py-3 transition hover:bg-muted/60 active:scale-[.99]"
            >
              <div className="relative spark-gradient flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white">
                {!c.is_group && (c.others[0]?.roblox_avatar_url || c.others[0]?.avatar_url) ? (
                  <img
                    src={c.others[0]?.roblox_avatar_url ?? c.others[0]?.avatar_url ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : c.is_group ? (
                  "👥"
                ) : (
                  (name?.[0]?.toUpperCase() ?? "?")
                )}
                {!c.is_group ? (
                  <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{name}</span>
                  {!c.is_group && c.others[0]?.verified ? <Verified /> : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{c.preview || "—"}</p>
              </div>
              <Camera className="h-6 w-6 shrink-0 text-muted-foreground" />
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
                    setSelected((s) =>
                      e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id),
                    )
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
