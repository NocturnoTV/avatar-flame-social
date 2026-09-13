import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCheck,
  ChevronRight,
  Inbox,
  Newspaper,
  Pin,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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
  request_status: string;
  created_by: string | null;
  pinned: boolean;
  muted: boolean;
  last_message_at: string;
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
const ICONS: Record<string, string> = {
  match: "✨",
  like: "💙",
  message: "💬",
  system: "📣",
};

function MessagesPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const storyInput = useRef<HTMLInputElement>(null);
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data: mine } = await supabase
        .from("conversation_participants")
        .select("conversation_id,pinned,muted")
        .eq("user_id", user!.id);
      const ids = (mine ?? []).map((p) => p.conversation_id);
      if (!ids.length) return [];
      const [{ data: convos }, { data: members }, { data: lastMessages }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id,is_group,name,last_message_at,request_status,created_by")
          .in("id", ids),
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
      const mineById = new Map((mine ?? []).map((m) => [m.conversation_id, m]));
      const rows = (convos ?? []).map((c) => {
        const others = (members ?? [])
          .filter((m) => m.conversation_id === c.id && m.user_id !== user!.id)
          .map((m) => (people ?? []).find((p) => p.id === m.user_id))
          .filter(Boolean) as Person[];
        const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
        const preview =
          last?.kind === "voice"
            ? `🎙️ ${t("voiceMessage")}`
            : last?.kind === "image"
              ? `🖼️ ${t("photo")}`
              : (last?.content ?? "");
        return {
          id: c.id,
          is_group: c.is_group,
          name: c.name,
          others,
          preview,
          request_status: c.request_status,
          created_by: c.created_by,
          pinned: mineById.get(c.id)?.pinned ?? false,
          muted: mineById.get(c.id)?.muted ?? false,
          last_message_at: c.last_message_at,
        };
      });
      return rows.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
  });

  async function respondToRequest(conversationId: string, accept: boolean) {
    await supabase
      .from("conversations")
      .update({ request_status: accept ? "accepted" : "declined" })
      .eq("id", conversationId);
    void conversations.refetch();
  }

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
          username: p?.username ?? "player",
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
          .select("id,kind,body,read,created_at,actor_id")
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

  const latestFollower = useQuery({
    queryKey: ["latest-follower", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id,created_at")
        .eq("following_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.follower_id)
        .maybeSingle();
      return { username: p?.username ?? "?", created_at: data.created_at };
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
      toast.success(t("storyPublished"));
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

  async function quickSendPhoto(conversationId: string, file: File) {
    if (!user) return;
    try {
      const path = await uploadFile(
        "profile-photos",
        user.id,
        file,
        file.name.split(".").pop() ?? "jpg",
      );
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        kind: "image",
        media_url: path,
      });
      if (error) throw error;
      void conversations.refetch();
    } catch {
      toast.error(t("errorGeneric"));
    }
  }

  const peopleStories = (stories.data ?? []).filter(
    (story, index, all) => all.findIndex((x) => x.user_id === story.user_id) === index,
  );
  const pendingReceived = (conversations.data ?? []).filter(
    (c) => c.request_status === "pending" && c.created_by !== user?.id,
  );
  const visible = (conversations.data ?? []).filter(
    (c) =>
      c.request_status === "accepted" || (c.request_status === "pending" && c.created_by === user?.id),
  );
  const filtered = visible.filter((c) =>
    (c.is_group ? c.name : c.others[0]?.username)?.toLowerCase().includes(search.toLowerCase()),
  );
  const activity = (notifications.data ?? []).filter((n) => n.kind !== "system" || n.body !== "safety_alert");
  const latestActivity = activity[0];
  const systemNotif = (notifications.data ?? []).find((n) => n.kind === "system");
  const unreadCount = activity.filter((n) => !n.read).length;

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => setNewGroup(true)}
          aria-label={t("newGroup")}
          className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <UserPlus className="h-5 w-5" />
        </button>
        <h1 className="flex items-center gap-1.5 text-xl font-black">
          {t("messages")}
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </h1>
        <button
          onClick={() => setShowSearch((v) => !v)}
          aria-label={t("search")}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2",
            showSearch ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Search className="h-5 w-5" />
        </button>
      </header>

      <section className="no-scrollbar -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2">
        <button onClick={() => storyInput.current?.click()} className="w-16 shrink-0 text-center">
          <span className="relative mx-auto block h-16 w-16 rounded-full border-2 border-dashed border-primary bg-primary/10 p-1">
            <span className="grid h-full w-full place-items-center rounded-full bg-surface">
              <Plus className="h-6 w-6 text-primary" />
            </span>
          </span>
          <span className="mt-1 block truncate text-[11px] font-semibold">{t("yourStory")}</span>
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
          <button key={s.id} onClick={() => void openStory(s)} className="w-16 shrink-0 text-center">
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

      {showSearch ? (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button onClick={() => setShowSearch(false)} aria-label={t("cancel")}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </label>
      ) : null}

      {pendingReceived.length > 0 ? (
        <button
          onClick={() => setShowRequests(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-primary/10 p-3 text-left ring-1 ring-primary/20"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white">
            <Inbox className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-primary">{t("messageRequests")}</span>
            <span className="block truncate text-xs text-muted-foreground">{pendingReceived.length}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-primary" />
        </button>
      ) : null}

      <div className="mt-3 space-y-1">
        {/* New followers */}
        {latestFollower.data ? (
          <Link
            to="/notifications"
            className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-surface-2"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-500 text-white">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t("followers")}</p>
              <p className="truncate text-sm text-muted-foreground">
                {t("newFollowerBody", { username: latestFollower.data.username })}
              </p>
            </div>
          </Link>
        ) : null}

        {/* Activity */}
        {latestActivity ? (
          <button
            onClick={() => setShowNotifications(true)}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-surface-2"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white">
              {ICONS[latestActivity.kind] ?? "🔔"}
              {unreadCount ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t("recentActivity")}</p>
              <p className="truncate text-sm text-muted-foreground">{latestActivity.body}</p>
            </div>
          </button>
        ) : null}

        {!filtered.length ? (
          <p className="py-14 text-center text-sm text-muted-foreground">{t("noConversations")}</p>
        ) : null}

        {filtered.map((c, i) => {
          const name = c.is_group ? c.name : c.others[0]?.username;
          const person = c.others[0];
          return (
            <div key={c.id} className="group relative flex items-center gap-3 rounded-2xl p-3 transition hover:bg-surface-2">
              <Link
                to="/messages/$id"
                params={{ id: c.id }}
                className="flex min-w-0 flex-1 items-center gap-3 active:scale-[.99]"
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
                    {c.pinned ? <Pin className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.request_status === "pending" ? (
                      <span className="font-semibold text-primary">{t("requestSent")}</span>
                    ) : (
                      c.preview || t("startChat")
                    )}
                  </p>
                </div>
              </Link>
              {!c.is_group && c.request_status === "accepted" ? (
                <button
                  onClick={() => cameraInputs.current[c.id]?.click()}
                  aria-label={t("photo")}
                  className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-surface hover:text-primary"
                >
                  <Camera className="h-4.5 w-4.5" />
                </button>
              ) : null}
              <input
                ref={(el) => {
                  cameraInputs.current[c.id] = el;
                }}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void quickSendPhoto(c.id, file);
                  e.target.value = "";
                }}
              />
              {i === 0 && systemNotif ? null : null}
            </div>
          );
        })}

        {/* System notifications, pinned at the end like a fixed system row */}
        {systemNotif ? (
          <button
            onClick={() => setShowNotifications(true)}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-surface-2"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800 text-white">
              <Newspaper className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-bold">
                {t("systemNotifications")}
                <Pin className="h-3 w-3 text-muted-foreground" />
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {systemNotif.body === "safety_alert" ? t("safetyAlertNotif") : systemNotif.body}
              </p>
            </div>
          </button>
        ) : null}
      </div>

      <Sheet open={newGroup} onClose={() => setNewGroup(false)} title={t("newGroup")}>
        <div className="space-y-4">
          <Input
            placeholder={t("groupName")}
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
          />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(matches.data ?? []).map((m) => (
              <label key={m.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={(e) =>
                    setSelected((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))
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

      <Sheet open={showRequests} onClose={() => setShowRequests(false)} title={t("messageRequests")}>
        <div className="space-y-2">
          {pendingReceived.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("noMessageRequests")}</p>
          ) : null}
          {pendingReceived.map((c) => {
            const person = c.others[0];
            const name = person?.username ?? "?";
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl p-2">
                <Link to="/users/$id" params={{ id: person?.id ?? "" }} onClick={() => setShowRequests(false)}>
                  <StoredImage
                    path={person?.avatar_url}
                    alt={name}
                    className="h-12 w-12 rounded-full"
                    fallback={name[0]?.toUpperCase() ?? "?"}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                </div>
                <Button size="sm" onClick={() => void respondToRequest(c.id, true)}>
                  {t("acceptRequest")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void respondToRequest(c.id, false)}>
                  {t("declineRequest")}
                </Button>
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={showNotifications} onClose={() => setShowNotifications(false)} title={t("notifications")}>
        <div className="space-y-2">
          <div className="flex items-center justify-end">
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
                <p className="text-sm">{n.body === "safety_alert" ? t("safetyAlertNotif") : n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {!notifications.data?.length ? (
            <p className="py-14 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
          ) : null}
        </div>
      </Sheet>

      {activeStory ? <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} /> : null}
    </div>
  );
}

function StoryViewer({ story, onClose }: { story: Story; onClose: () => void }) {
  const url = useSignedUrl(story.media_url);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/95 p-3" onClick={onClose}>
      <button
        className="absolute right-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white"
        aria-label="Close"
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
