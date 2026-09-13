import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Sheet } from "@/components/ui-kit";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { Verified } from "@/components/Verified";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({ meta: [{ title: "Messages — Bloxspark" }] }),
  component: MessagesPage,
});

type Person = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  verified: boolean | null;
};
type Row = {
  id: string;
  is_group: boolean;
  name: string | null;
  others: Person[];
  preview: string;
};
type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
  unread: boolean;
};
const ICONS: Record<string, string> = { match: "✨", like: "💙", message: "💬", system: "📣" };

function MessagesPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const [tab, setTab] = useState<"messages" | "notifications">("messages");
  const [search, setSearch] = useState("");
  const [newGroup, setNewGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const storyInput = useRef<HTMLInputElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);
      const ids = (parts ?? []).map((p) => p.conversation_id);
      if (!ids.length) return [];
      const [{ data: convos }, { data: members }, { data: lastMessages }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id,is_group,name,last_message_at")
          .in("id", ids)
          .order("last_message_at", { ascending: false }),
        supabase
          .from("conversation_participants")
          .select("conversation_id,user_id")
          .in("conversation_id", ids),
        supabase
          .from("messages")
          .select("conversation_id,content,kind,created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      const personIds = [
        ...new Set((members ?? []).map((m) => m.user_id).filter((id) => id !== user!.id)),
      ];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified")
        .in("id", personIds.length ? personIds : ["00000000-0000-0000-0000-000000000000"]);
      return (convos ?? []).map((c) => {
        const others = (members ?? [])
          .filter((m) => m.conversation_id === c.id && m.user_id !== user!.id)
          .map((m) => (people ?? []).find((p) => p.id === m.user_id))
          .filter(Boolean) as Person[];
        const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
        const preview =
          last?.kind === "voice"
            ? `🎙️ ${t("voiceMessage")}`
            : last?.kind === "image"
              ? "🖼️ Photo"
              : (last?.content ?? "");
        return { id: c.id, is_group: c.is_group, name: c.name, others, preview };
      });
    },
  });

  const stories = useQuery({
    queryKey: ["stories", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Story[]> => {
      const { data: rows } = await supabase
        .from("stories")
        .select("id,user_id,media_url,media_type,caption,created_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      const ids = [...new Set((rows ?? []).map((s) => s.user_id))];
      const [{ data: people }, { data: views }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,username,avatar_url")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("story_views").select("story_id").eq("user_id", user!.id),
      ]);
      const seen = new Set((views ?? []).map((v) => v.story_id));
      return (rows ?? []).map((s) => {
        const p = (people ?? []).find((x) => x.id === s.user_id);
        return {
          ...s,
          username: p?.username ?? "joueur",
          avatar_url: p?.avatar_url ?? null,
          unread: !seen.has(s.id),
        };
      });
    },
  });

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("id,kind,body,read,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });

  const matches = useQuery({
    queryKey: ["match-profiles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("user_a,user_b")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      const ids = (data ?? []).map((m) => (m.user_a === user!.id ? m.user_b : m.user_a));
      if (!ids.length) return [] as Person[];
      return (
        (await supabase.from("profiles").select("id,username,avatar_url,verified").in("id", ids))
          .data ?? []
      );
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("messages-hub-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void conversations.refetch(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => void notifications.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversations, notifications]);

  async function createGroup() {
    if (!groupTitle.trim() || !selected.length) return;
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

  async function uploadStory(file: File) {
    if (!user) return;
    try {
      const path = await uploadFile("stories", user.id, file, file.name.split(".").pop() || "jpg");
      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: path,
        media_type: file.type.startsWith("video/") ? "video" : "image",
      });
      if (error) throw error;
      toast.success("Story publiée pour 24 h");
      void stories.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorGeneric"));
    }
  }

  async function openStory(story: Story) {
    setActiveStory(story);
    if (story.unread && user) {
      await supabase.from("story_views").upsert({ story_id: story.id, user_id: user.id });
      void stories.refetch();
    }
  }

  async function markAll() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    void notifications.refetch();
  }

  const peopleStories = (stories.data ?? []).filter(
    (story, index, all) => all.findIndex((x) => x.user_id === story.user_id) === index,
  );
  const filtered = (conversations.data ?? []).filter((c) =>
    (c.is_group ? c.name : c.others[0]?.username)?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">BloxSpark</p>
          <h1 className="text-3xl font-black">{t("messages")}</h1>
        </div>
        <Button size="icon" onClick={() => setNewGroup(true)} aria-label={t("newGroup")}>
          <Plus className="h-5 w-5" />
        </Button>
      </header>
      <div className="mt-5 flex gap-1 rounded-2xl bg-surface-2 p-1">
        <button
          onClick={() => setTab("messages")}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-bold",
            tab === "messages" && "bg-background text-primary shadow-sm",
          )}
        >
          Discussions
        </button>
        <button
          onClick={() => setTab("notifications")}
          className={cn(
            "relative flex-1 rounded-xl px-4 py-2.5 text-sm font-bold",
            tab === "notifications" && "bg-background text-primary shadow-sm",
          )}
        >
          <Bell className="mr-1 inline h-4 w-4" /> {t("notifications")}
          {(notifications.data ?? []).some((n) => !n.read) ? (
            <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </button>
      </div>
      {tab === "messages" ? (
        <>
          <section className="no-scrollbar -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2">
            <button
              onClick={() => storyInput.current?.click()}
              className="w-16 shrink-0 text-center"
            >
              <span className="relative mx-auto block h-16 w-16 rounded-full border-2 border-dashed border-primary bg-primary/10 p-1">
                <span className="grid h-full w-full place-items-center rounded-full bg-surface">
                  <Plus className="h-6 w-6 text-primary" />
                </span>
              </span>
              <span className="mt-1 block truncate text-[11px] font-semibold">Ta story</span>
            </button>
            <input
              ref={storyInput}
              hidden
              type="file"
              accept="image/*,video/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadStory(f);
                e.target.value = "";
              }}
            />
            {peopleStories.map((s) => (
              <button
                key={s.id}
                onClick={() => void openStory(s)}
                className="w-16 shrink-0 text-center"
              >
                <span
                  className={cn(
                    "mx-auto block h-16 w-16 rounded-full p-[3px]",
                    s.unread ? "bg-primary" : "bg-border",
                  )}
                >
                  <StoredImage
                    path={s.avatar_url}
                    alt={s.username}
                    className="h-full w-full rounded-full border-2 border-background"
                    fallback={s.username[0]?.toUpperCase() ?? "?"}
                  />
                </span>
                <span className="mt-1 block truncate text-[11px] font-semibold">{s.username}</span>
              </button>
            ))}
          </section>
          <label className="mt-4 flex h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="mt-4 space-y-1">
            {!filtered.length ? (
              <p className="py-14 text-center text-sm text-muted-foreground">
                {t("noConversations")}
              </p>
            ) : null}
            {filtered.map((c) => {
              const name = c.is_group ? c.name : c.others[0]?.username;
              const person = c.others[0];
              return (
                <Link
                  key={c.id}
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-surface-2 active:scale-[.99]"
                >
                  <StoredImage
                    path={c.is_group ? null : person?.avatar_url}
                    alt={name ?? ""}
                    className="h-14 w-14 shrink-0 rounded-full"
                    fallback={c.is_group ? "👥" : (name?.[0]?.toUpperCase() ?? "?")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-bold">
                      <span className="truncate">{name || "Discussion"}</span>
                      {!c.is_group && person?.verified ? <Verified /> : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.preview || "Commence la discussion"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Activité récente</p>
            <button
              onClick={() => void markAll()}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <CheckCheck className="h-4 w-4" /> {t("markAllRead")}
            </button>
          </div>
          {(notifications.data ?? []).map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex gap-3 rounded-2xl p-4",
                n.read ? "bg-surface" : "bg-primary/10 ring-1 ring-primary/20",
              )}
            >
              <span className="text-xl">{ICONS[n.kind] ?? "🔔"}</span>
              <div>
                <p className="text-sm">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {!notifications.data?.length ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              {t("noNotifications")}
            </p>
          ) : null}
        </div>
      )}
      <Sheet open={newGroup} onClose={() => setNewGroup(false)} title={t("newGroup")}>
        <div className="space-y-4">
          <Input
            placeholder={t("groupName")}
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
          />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(matches.data ?? []).map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id),
                    )
                  }
                />
                <StoredImage
                  path={m.avatar_url}
                  alt={m.username ?? ""}
                  className="h-10 w-10 rounded-full"
                  fallback={m.username?.[0] ?? "?"}
                />
                <span className="font-semibold">{m.username}</span>
              </label>
            ))}
          </div>
          <Button className="w-full" onClick={() => void createGroup()}>
            {t("create")}
          </Button>
        </div>
      </Sheet>
      {activeStory ? (
        <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />
      ) : null}
    </div>
  );
}

function StoryViewer({ story, onClose }: { story: Story; onClose: () => void }) {
  const url = useSignedUrl(story.media_url);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/95 p-3" onClick={onClose}>
      <button
        className="absolute right-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white"
        aria-label="Fermer"
      >
        <X className="h-6 w-6" />
      </button>
      <div
        className="relative h-full max-h-[850px] w-full max-w-md overflow-hidden rounded-3xl bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        {url ? (
          story.media_type === "video" ? (
            <video src={url} autoPlay controls className="h-full w-full object-contain" />
          ) : (
            <img src={url} alt="Story" className="h-full w-full object-contain" />
          )
        ) : null}
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 text-white">
          <StoredImage
            path={story.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full"
            fallback={story.username[0] ?? "?"}
          />
          <div>
            <p className="font-bold">@{story.username}</p>
            <p className="text-[11px] text-white/70">Story · 24 h</p>
          </div>
        </div>
        {story.caption ? (
          <p className="absolute inset-x-4 bottom-5 rounded-2xl bg-black/55 p-3 text-sm text-white backdrop-blur">
            {story.caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}
