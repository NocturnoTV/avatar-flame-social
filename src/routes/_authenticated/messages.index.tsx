import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  EyeOff,
  Heart,
  Inbox,
  Mail,
  MessageCircle,
  Moon,
  Newspaper,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Sheet } from "@/components/ui-kit";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { PresenceDot } from "@/components/PresenceDot";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { getRobloxFriendSuggestions } from "@/lib/roblox-friends.functions";
import { Verified } from "@/components/Verified";
import {
  isActivityNotificationKind,
  localizeActivityNotification,
} from "@/lib/activityNotifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({ meta: [{ title: "Messages - Bloxspark" }] }),
  component: MessagesPage,
});

type Person = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  verified: boolean | null;
  last_active_at?: string | null;
  show_online_status?: boolean | null;
  dnd?: boolean | null;
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
  unread_count: number;
  streak_count: number;
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
type NotificationRow = {
  id: string;
  kind: string;
  body: string | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  conversation_id: string | null;
  actor: Person | null;
};
type FollowerRow = Person & {
  followed_at: string;
};

const NOTIFICATION_ICONS = {
  match: Sparkles,
  like: Heart,
  super: Sparkles,
  message: MessageCircle,
  system: ShieldCheck,
} as const;

function formatNotificationTime(value: string, lang: string) {
  const elapsed = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (absolute < 60_000) return formatter.format(Math.round(elapsed / 1000), "second");
  if (absolute < 3_600_000) return formatter.format(Math.round(elapsed / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(elapsed / 3_600_000), "hour");
  if (absolute < 604_800_000) return formatter.format(Math.round(elapsed / 86_400_000), "day");
  return new Date(value).toLocaleDateString(lang, { day: "numeric", month: "short" });
}

/** Conversation-list preview text for a "gift" message (Blox sent, or Spark
 * Plus gifted) - content is a small JSON payload, see GiftBubble in
 * messages.$id.tsx for the full rendering. */
function giftPreviewText(
  t: (key: string, vars?: Record<string, string | number>) => string,
  content: string | null,
) {
  try {
    const gift = content ? JSON.parse(content) : null;
    return gift?.type === "spark_plus"
      ? t("giftMessageSparkPlus")
      : t("giftMessageBlox", { amount: (gift?.amount ?? 0).toLocaleString() });
  } catch {
    return t("giftMessageBlox", { amount: 0 });
  }
}

function MessagesPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [groupSheetTab, setGroupSheetTab] = useState<"friends" | "group">("friends");
  const [friendQuery, setFriendQuery] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "unread" | "social" | "system"
  >("all");
  const storyInput = useRef<HTMLInputElement>(null);
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const myPresence = useQuery({
    queryKey: ["my-presence", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("show_online_status,dnd")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  async function setPresenceStatus(status: "online" | "offline" | "dnd") {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        show_online_status: status !== "offline",
        dnd: status === "dnd",
      })
      .eq("id", user.id);
    setShowStatusPicker(false);
    void myPresence.refetch();
  }

  const myStatus: "online" | "offline" | "dnd" = myPresence.data?.dnd
    ? "dnd"
    : myPresence.data?.show_online_status === false
      ? "offline"
      : "online";

  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data: mine } = await supabase
        .from("conversation_participants")
        .select("conversation_id,pinned,muted,last_read_at")
        .eq("user_id", user!.id);
      const ids = (mine ?? []).map((p) => p.conversation_id);
      if (!ids.length) return [];
      const [{ data: convos }, { data: members }, { data: lastMessages }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id,is_group,name,last_message_at,request_status,created_by,streak_count")
          .in("id", ids),
        supabase
          .from("conversation_participants")
          .select("conversation_id,user_id")
          .in("conversation_id", ids),
        supabase
          .from("messages")
          .select("conversation_id,sender_id,content,kind,created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      const personIds = [
        ...new Set((members ?? []).map((m) => m.user_id).filter((id) => id !== user!.id)),
      ];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified,last_active_at,show_online_status,dnd")
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
              : last?.kind === "gift"
                ? `🎁 ${giftPreviewText(t, last.content)}`
                : (last?.content ?? "");
        const lastReadAt = mineById.get(c.id)?.last_read_at;
        const unreadCount = (lastMessages ?? []).filter(
          (m) =>
            m.conversation_id === c.id &&
            m.sender_id !== user!.id &&
            (!lastReadAt || new Date(m.created_at).getTime() > new Date(lastReadAt).getTime()),
        ).length;
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
          unread_count: unreadCount,
          streak_count: c.streak_count ?? 0,
        };
      });
      return rows.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const aUnread = a.unread_count > 0;
        const bUnread = b.unread_count > 0;
        if (aUnread !== bUnread) return aUnread ? -1 : 1;
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
      // Only people you follow or matched with (Sparks) - not every story
      // on Bloxspark.
      const [{ data: follows }, { data: matchRows }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user!.id),
        supabase
          .from("matches")
          .select("user_a,user_b")
          .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`),
      ]);
      const allowedIds = new Set<string>([
        ...(follows ?? []).map((f) => f.following_id),
        ...(matchRows ?? []).map((m) => (m.user_a === user!.id ? m.user_b : m.user_a)),
      ]);
      allowedIds.add(user!.id);
      if (allowedIds.size === 0) return [];

      const { data: rows } = await supabase
        .from("stories")
        .select("id,user_id,media_url,media_type,caption,created_at")
        .gt("expires_at", new Date().toISOString())
        .in("user_id", [...allowedIds])
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
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,kind,body,read,created_at,actor_id,conversation_id")
        // Safety alerts are shown small, inline in the affected conversation
        // (visible only to the person who received the flagged message) -
        // never in this global notification feed.
        .neq("body", "safety_alert")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const actorIds = [
        ...new Set((data ?? []).map((item) => item.actor_id).filter(Boolean)),
      ] as string[];
      const { data: actors } = actorIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,avatar_url,verified")
            .in("id", actorIds)
        : { data: [] as Person[] };
      return (data ?? []).map((item) => ({
        ...item,
        actor: (actors ?? []).find((actor) => actor.id === item.actor_id) ?? null,
      }));
    },
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

  const matchedIds = new Set((matches.data ?? []).map((m) => m.id));

  // "People you may know" - Roblox friends (via the linked account) and
  // people you share a mutual Spark/match with, excluding anyone you
  // already have a conversation with.
  const suggestions = useQuery({
    queryKey: ["message-suggestions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Person[]> => {
      const existingIds = new Set([
        ...matchedIds,
        ...(conversations.data ?? []).flatMap((c) => c.others.map((o) => o.id)),
        user!.id,
      ]);

      const [{ data: myMatchRows }, robloxResult] = await Promise.all([
        supabase
          .from("matches")
          .select("user_a,user_b")
          .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`),
        getRobloxFriendSuggestions().catch(() => ({ robloxUserIds: [] as string[] })),
      ]);
      const myMatchIds = (myMatchRows ?? []).map((m) =>
        m.user_a === user!.id ? m.user_b : m.user_a,
      );

      // Mutual Sparks: people matched with someone I'm matched with.
      const mutualCounts = new Map<string, number>();
      if (myMatchIds.length) {
        const { data: theirMatches } = await supabase
          .from("matches")
          .select("user_a,user_b")
          .or(myMatchIds.map((id) => `user_a.eq.${id},user_b.eq.${id}`).join(","));
        for (const row of theirMatches ?? []) {
          for (const candidate of [row.user_a, row.user_b]) {
            if (existingIds.has(candidate)) continue;
            mutualCounts.set(candidate, (mutualCounts.get(candidate) ?? 0) + 1);
          }
        }
      }

      // Roblox friends who also have a BloxSpark account.
      const robloxIds = robloxResult.robloxUserIds;
      const { data: robloxMatches } = robloxIds.length
        ? await supabase.from("profiles").select("id").in("roblox_user_id", robloxIds)
        : { data: [] };
      for (const row of robloxMatches ?? []) {
        if (existingIds.has(row.id)) continue;
        mutualCounts.set(row.id, (mutualCounts.get(row.id) ?? 0) + 10); // Roblox friends rank first.
      }

      const rankedIds = [...mutualCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);
      if (!rankedIds.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified")
        .in("id", rankedIds);
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return rankedIds
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);
    },
  });

  // Searching now looks across every BloxSpark user, not just existing
  // conversations - split into your Sparks and everyone else.
  const userSearch = useQuery({
    queryKey: ["user-search", search.trim()],
    enabled: !!user && search.trim().length >= 2,
    queryFn: async () => {
      const { data: blocked } = await supabase
        .from("blocks")
        .select("blocked_id,blocker_id")
        .or(`blocker_id.eq.${user!.id},blocked_id.eq.${user!.id}`);
      const excluded = new Set(
        (blocked ?? [])
          .flatMap((b) => [b.blocked_id, b.blocker_id])
          .filter((id) => id !== user!.id),
      );
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified")
        .ilike("username", `%${search.trim()}%`)
        .neq("id", user!.id)
        .limit(40);
      return (data ?? []).filter((p) => !excluded.has(p.id));
    },
  });

  // Separate from the header's search bar (userSearch above) so the "+"
  // sheet's "Add friends" tab has its own query, keyed on its own text.
  const friendSearch = useQuery({
    queryKey: ["friend-search", friendQuery.trim()],
    enabled: !!user && friendQuery.trim().length >= 2,
    queryFn: async () => {
      const { data: blocked } = await supabase
        .from("blocks")
        .select("blocked_id,blocker_id")
        .or(`blocker_id.eq.${user!.id},blocked_id.eq.${user!.id}`);
      const excluded = new Set(
        (blocked ?? [])
          .flatMap((b) => [b.blocked_id, b.blocker_id])
          .filter((id) => id !== user!.id),
      );
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified")
        .ilike("username", `%${friendQuery.trim()}%`)
        .neq("id", user!.id)
        .limit(40);
      return (data ?? []).filter((p) => !excluded.has(p.id));
    },
  });

  async function startConversationWith(targetId: string) {
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: targetId,
      });
      if (error) throw error;
      setShowSearch(false);
      setSearch("");
      await navigate({ to: "/messages/$id", params: { id: conversationId as string } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  const recentFollowers = useQuery({
    queryKey: ["recent-followers", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FollowerRow[]> => {
      const { data, error } = await supabase
        .from("follows")
        .select("follower_id,created_at")
        .eq("following_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = (data ?? []).map((follow) => follow.follower_id);
      if (!ids.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified")
        .in("id", ids);
      const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
      return (data ?? []).flatMap((follow) => {
        const person = peopleById.get(follow.follower_id);
        return person ? [{ ...person, followed_at: follow.created_at }] : [];
      });
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        () => void recentFollowers.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversations, notifications, recentFollowers]);

  async function createGroup() {
    if (!groupTitle.trim() || !selected.length) return;
    const { error } = await supabase.rpc("create_group", {
      _name: groupTitle.trim(),
      _members: selected,
    });
    if (error) {
      toast.error(error.message === "group_full" ? t("groupFull") : error.message);
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
    qc.setQueryData<NotificationRow[]>(["notifications", user.id], (current) =>
      current?.map((notification) => ({ ...notification, read: true })),
    );
    qc.setQueryData(["unread-notifications", user.id], 0);
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    await Promise.all([
      notifications.refetch(),
      qc.invalidateQueries({ queryKey: ["unread-notifications", user.id] }),
      qc.invalidateQueries({ queryKey: ["home-counters", user.id] }),
    ]);
  }

  async function openNotification(notification: NotificationRow) {
    if (!notification.read) {
      qc.setQueryData<NotificationRow[]>(["notifications", user?.id], (current) =>
        current?.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      await supabase.from("notifications").update({ read: true }).eq("id", notification.id);
      if (user) {
        await Promise.all([
          notifications.refetch(),
          qc.invalidateQueries({ queryKey: ["unread-notifications", user.id] }),
          qc.invalidateQueries({ queryKey: ["home-counters", user.id] }),
        ]);
      }
    }
    setShowNotifications(false);
    if (notification.conversation_id) {
      void navigate({ to: "/messages/$id", params: { id: notification.conversation_id } });
    } else if (notification.actor_id) {
      void navigate({ to: "/users/$id", params: { id: notification.actor_id } });
    }
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
      c.request_status === "accepted" ||
      (c.request_status === "pending" && c.created_by === user?.id),
  );
  const filtered = visible.filter((c) =>
    (c.is_group ? c.name : c.others[0]?.username)?.toLowerCase().includes(search.toLowerCase()),
  );
  // Team Spark is reserved for official messages only (the welcome message,
  // future announcements) - kind "system". Video activity (likes, favorites,
  // reposts, comments, replies) gets its own "Activités" thread below, and
  // Sparks' own match/like/super activity stays in "recent activity".
  const TEAM_SPARK_KINDS = ["system"];
  const activity = (notifications.data ?? []).filter(
    (n) =>
      n.kind !== "message" &&
      !TEAM_SPARK_KINDS.includes(n.kind) &&
      !isActivityNotificationKind(n.kind),
  );
  const latestActivity = activity[0];
  const teamSparkNotifs = (notifications.data ?? []).filter((n) =>
    TEAM_SPARK_KINDS.includes(n.kind),
  );
  const systemNotif = teamSparkNotifs[0];
  const unreadSystemCount = teamSparkNotifs.filter((n) => !n.read).length;
  const unreadCount = activity.filter((n) => !n.read).length;

  const videoActivityNotifs = (notifications.data ?? []).filter((n) =>
    isActivityNotificationKind(n.kind),
  );
  const latestVideoActivity = videoActivityNotifs[0];
  const unreadVideoActivityCount = videoActivityNotifs.filter((n) => !n.read).length;
  const latestVideoActivityText = latestVideoActivity
    ? localizeActivityNotification(
        t,
        latestVideoActivity.kind,
        latestVideoActivity.actor?.username ?? t("someone"),
        latestVideoActivity.body,
      )
    : null;

  return (
    <div className="app-background mx-auto min-h-screen w-full max-w-lg px-4 pb-28 pt-5 text-[#050505] dark:text-white">
      <header className="flex h-[52px] items-center justify-between">
        <button
          onClick={() => {
            setGroupSheetTab("friends");
            setNewGroup(true);
          }}
          aria-label={t("addFriends")}
          className="grid h-10 w-10 place-items-center rounded-full text-[#050505] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
        >
          <UserPlus className="h-5 w-5" />
        </button>
        <h1 className="flex items-center gap-1.5 text-[22px] font-black text-[#050505] dark:text-white">
          {t("messages")}
          <button
            onClick={() => setShowStatusPicker(true)}
            aria-label={t("myStatus")}
            className="grid h-5 w-5 place-items-center rounded-md bg-[#F5F5F5] dark:bg-[#1c1c1e]"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                myStatus === "online" && "animate-pulse bg-[#20D778]",
                myStatus === "dnd" && "bg-red-500",
                myStatus === "offline" && "bg-[#929292]",
              )}
            />
          </button>
        </h1>
        <div className="flex items-center">
          <button
            onClick={() => setShowSearch((v) => !v)}
            aria-label={t("search")}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10",
              showSearch ? "text-primary" : "text-[#050505] dark:text-white",
            )}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowRequests(true)}
            aria-label={t("messageRequests")}
            className="relative grid h-10 w-10 place-items-center rounded-full text-[#050505] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
          >
            <Inbox className="h-5 w-5" />
            {pendingReceived.length ? (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {pendingReceived.length > 9 ? "9+" : pendingReceived.length}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <section className="no-scrollbar -mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2">
        <button
          onClick={() => storyInput.current?.click()}
          className="w-[72px] shrink-0 text-center"
        >
          <span className="relative mx-auto block h-[72px] w-[72px] rounded-full border-2 border-dashed border-primary bg-primary/10 p-1">
            <span className="grid h-full w-full place-items-center rounded-full bg-[#F5F5F5] dark:bg-[#1c1c1e]">
              <Plus className="h-6 w-6 text-primary" />
            </span>
          </span>
          <span className="mt-1.5 block truncate text-xs font-semibold text-[#050505] dark:text-white">
            {t("yourStory")}
          </span>
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
            className="w-[72px] shrink-0 text-center"
          >
            <span
              className={cn(
                "mx-auto block h-[72px] w-[72px] rounded-full p-[3px] transition-transform active:scale-95",
                s.unread
                  ? "bg-gradient-to-br from-[#A855F7] to-[#20D778]"
                  : "bg-[#E5E5E5] dark:bg-white/15",
              )}
            >
              <StoredImage
                path={s.avatar_url}
                alt={s.username}
                className="h-full w-full rounded-full border-2 border-white object-cover dark:border-black"
                fallback={s.username[0]?.toUpperCase() ?? "?"}
              />
            </span>
            <span className="mt-1.5 block truncate text-xs font-semibold text-[#050505] dark:text-white">
              {s.username}
            </span>
          </button>
        ))}
      </section>

      {/* Video activity (likes, comments, favorites, reposts, replies) - a
          dedicated thread separate from Team Spark, which is reserved for
          official messages only. */}
      <Link
        to="/messages/$id"
        params={{ id: "activities" }}
        className="bx-pop mt-3 flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.06]"
      >
        <span className="relative h-14 w-14 shrink-0">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md shadow-blue-500/20">
            <Mail className="h-6 w-6" />
          </span>
          {unreadVideoActivityCount ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#F32657] px-1 text-[9px] font-bold text-white ring-2 ring-background">
              {unreadVideoActivityCount > 9 ? "9+" : unreadVideoActivityCount}
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[17px] font-bold text-[#050505] dark:text-white">
            {t("activitiesTitle")}
            <Pin className="h-3.5 w-3.5 text-[#929292]" />
          </p>
          <p className="truncate text-sm text-[#929292]">
            {latestVideoActivityText ?? t("activitiesSubtitle")}
          </p>
        </div>
      </Link>

      {showSearch ? (
        <label className="bx-pop mt-3 flex h-11 items-center gap-2 rounded-2xl bg-[#F5F5F5] px-4 dark:bg-[#1c1c1e]">
          <Search className="h-4 w-4 text-[#929292]" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#050505] outline-none placeholder:text-[#929292] dark:text-white"
          />
          <button onClick={() => setShowSearch(false)} aria-label={t("cancel")}>
            <X className="h-4 w-4 text-[#929292]" />
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
            <span className="block truncate text-xs text-[#929292]">{pendingReceived.length}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-primary" />
        </button>
      ) : null}

      {search.trim().length >= 2 ? (
        <div className="mt-2 space-y-1">
          {(() => {
            const results = userSearch.data ?? [];
            const sparks = results.filter((p) => matchedIds.has(p.id));
            const strangers = results.filter((p) => !matchedIds.has(p.id));
            if (userSearch.isLoading) {
              return <p className="py-10 text-center text-sm text-[#929292]">{t("loading")}</p>;
            }
            if (!results.length) {
              return <p className="py-10 text-center text-sm text-[#929292]">{t("noResults")}</p>;
            }
            const renderPerson = (p: (typeof results)[number]) => (
              <button
                key={p.id}
                onClick={() => void startConversationWith(p.id)}
                className="bx-pop flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.06]"
              >
                <StoredImage
                  path={p.avatar_url}
                  alt={p.username ?? ""}
                  className="h-12 w-12 rounded-full object-cover"
                  fallback={p.username?.[0]?.toUpperCase() ?? "?"}
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate font-bold text-[#050505] dark:text-white">
                    {p.username}
                  </span>
                  {p.verified ? <Verified /> : null}
                </span>
              </button>
            );
            return (
              <>
                {sparks.length ? (
                  <>
                    <p className="px-1 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-[#929292]">
                      {t("yourSparksFriends")}
                    </p>
                    {sparks.map(renderPerson)}
                  </>
                ) : null}
                {sparks.length && strangers.length ? (
                  <div className="my-2 border-t border-dashed border-[#e5e5e5] dark:border-white/15" />
                ) : null}
                {strangers.length ? (
                  <>
                    <p className="px-1 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-[#929292]">
                      {t("strangers")}
                    </p>
                    {strangers.map(renderPerson)}
                  </>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="mt-2">
          {/* New followers */}
          {recentFollowers.data?.length ? (
            <button
              onClick={() => setShowFollowers(true)}
              className="bx-pop flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.06]"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#A855F7] text-white">
                <Users className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-[#050505] dark:text-white">
                  {t("followers")}
                </p>
                <p className="truncate text-sm text-[#929292]">
                  {t("newFollowerBody", {
                    username: recentFollowers.data[0]?.username ?? t("someone"),
                  })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
            </button>
          ) : null}

          {/* Activity */}
          {latestActivity ? (
            <button
              onClick={() => {
                setShowNotifications(true);
                void markAll();
              }}
              className="bx-pop flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.06]"
            >
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#FF3568] text-xl text-white">
                {latestActivity.kind === "match"
                  ? "✨"
                  : latestActivity.kind === "like"
                    ? "💙"
                    : "🔔"}
                {unreadCount ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#F32657] px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-[#050505] dark:text-white">
                  {t("recentActivity")}
                </p>
                <p className="truncate text-sm text-[#929292]">{latestActivity.body}</p>
              </div>
            </button>
          ) : null}

          {/* Team Spark: welcome message + video likes/comments/favorites/reposts,
              shown as a read-only conversation rather than a separate page. */}
          <Link
            to="/messages/$id"
            params={{ id: "team-spark" }}
            className="bx-pop flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.06]"
          >
            <span className="relative h-14 w-14 shrink-0">
              <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-violet-800 p-2.5 shadow-md shadow-violet-500/20">
                <img src="/team-spark-avatar.png" alt="" className="h-full w-full object-contain" />
              </span>
              {unreadSystemCount ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#F32657] px-1 text-[9px] font-bold text-white ring-2 ring-background">
                  {unreadSystemCount > 9 ? "9+" : unreadSystemCount}
                </span>
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[17px] font-bold text-[#050505] dark:text-white">
                {t("teamSparks")}
                <Verified />
                <Pin className="h-3.5 w-3.5 text-[#929292]" />
              </p>
              <p className="truncate text-sm text-[#929292]">
                {systemNotif
                  ? systemNotif.body === "safety_alert"
                    ? t("safetyAlertNotif")
                    : systemNotif.body
                  : t("notificationEmptyHint")}
              </p>
            </div>
          </Link>

          {!filtered.length ? (
            <p className="py-14 text-center text-sm text-[#929292]">{t("noConversations")}</p>
          ) : null}

          {filtered.map((c) => {
            const name = c.is_group ? c.name : c.others[0]?.username;
            const person = c.others[0];
            return (
              <div
                key={c.id}
                className="bx-pop group relative flex items-center gap-3 rounded-2xl px-1 py-3 transition hover:bg-black/[.03] dark:hover:bg-white/[.06]"
              >
                <Link
                  to="/messages/$id"
                  params={{ id: c.id }}
                  className="flex min-w-0 flex-1 items-center gap-3 active:scale-[.99]"
                >
                  <div className="relative shrink-0">
                    <StoredImage
                      path={c.is_group ? null : person?.avatar_url}
                      alt={name ?? ""}
                      className="h-14 w-14 rounded-full object-cover"
                      fallback={c.is_group ? "👥" : (name?.[0]?.toUpperCase() ?? "?")}
                    />
                    {!c.is_group && person ? (
                      <PresenceDot
                        profile={person}
                        className="absolute bottom-0 right-0 h-3.5 w-3.5"
                      />
                    ) : null}
                    {c.unread_count > 0 ? (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                        {c.unread_count > 9 ? "9+" : c.unread_count}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[17px] font-bold text-[#050505] dark:text-white">
                      <span className="truncate">{name || "Discussion"}</span>
                      {!c.is_group && person?.verified ? <Verified /> : null}
                      {!c.is_group && c.streak_count > 0 ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-orange-500">
                          🔥{c.streak_count}
                        </span>
                      ) : null}
                      {c.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[#929292]" /> : null}
                    </p>
                    <p className="truncate text-sm text-[#929292]">
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
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[#929292] transition hover:bg-black/5 hover:text-primary dark:hover:bg-white/10"
                  >
                    <Camera className="h-5 w-5" />
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
              </div>
            );
          })}

          {(suggestions.data ?? []).length > 0 ? (
            <>
              <div className="my-3 border-t border-dashed border-[#e5e5e5] dark:border-white/15" />
              <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-[#929292]">
                {t("peopleYouMayKnow")}
              </p>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {(suggestions.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => void startConversationWith(p.id)}
                    className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <StoredImage
                      path={p.avatar_url}
                      alt={p.username ?? ""}
                      className="h-14 w-14 rounded-full object-cover"
                      fallback={p.username?.[0]?.toUpperCase() ?? "?"}
                    />
                    <span className="flex w-full items-center justify-center gap-1 truncate text-xs font-semibold text-[#050505] dark:text-white">
                      <span className="truncate">{p.username}</span>
                      {p.verified ? <Verified className="h-3 w-3 shrink-0" /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      <Sheet
        open={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        title={t("myStatus")}
      >
        <div className="space-y-2">
          {(
            [
              { id: "online", label: t("onlineNow"), icon: Check, dot: "bg-[#20D778]" },
              { id: "dnd", label: t("doNotDisturb"), icon: Moon, dot: "bg-red-500" },
              { id: "offline", label: t("appearOffline"), icon: EyeOff, dot: "bg-[#929292]" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              onClick={() => void setPresenceStatus(option.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                myStatus === option.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-surface-2",
              )}
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", option.dot)} />
              <span className="flex-1 text-sm font-semibold">{option.label}</span>
              {myStatus === option.id ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={newGroup}
        onClose={() => {
          setNewGroup(false);
          setFriendQuery("");
        }}
        title={groupSheetTab === "friends" ? t("addFriends") : t("newGroup")}
      >
        <div className="space-y-4">
          <div className="flex gap-1.5 rounded-2xl bg-surface-2 p-1">
            <button
              onClick={() => setGroupSheetTab("friends")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition",
                groupSheetTab === "friends"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <UserPlus className="h-4 w-4" /> {t("addFriends")}
            </button>
            <button
              onClick={() => setGroupSheetTab("group")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition",
                groupSheetTab === "group"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <Users className="h-4 w-4" /> {t("newGroup")}
            </button>
          </div>

          {groupSheetTab === "friends" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={friendQuery}
                  onChange={(e) => setFriendQuery(e.target.value)}
                  placeholder={t("searchByUsername")}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {friendQuery.trim().length < 2 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("searchByUsername")}
                  </p>
                ) : friendSearch.isLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>
                ) : !friendSearch.data?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("noResults")}</p>
                ) : (
                  friendSearch.data.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => void startConversationWith(p.id)}
                      className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-surface-2"
                    >
                      <StoredImage
                        path={p.avatar_url}
                        alt={p.username ?? ""}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        fallback={p.username?.[0]?.toUpperCase() ?? "?"}
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate font-semibold">{p.username}</span>
                        {p.verified ? <Verified /> : null}
                      </span>
                      <UserPlus className="h-4 w-4 shrink-0 text-primary" />
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <Input
                placeholder={t("groupName")}
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
              />
              <p className="text-xs font-semibold text-muted-foreground">
                {t("groupMemberCount", { count: selected.length + 1 })}
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {(matches.data ?? []).map((m) => {
                  const checked = selected.includes(m.id);
                  const atLimit = selected.length >= 24 && !checked;
                  return (
                    <label
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl p-2",
                        atLimit ? "opacity-40" : "hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={atLimit}
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
                  );
                })}
              </div>
              {selected.length >= 24 ? (
                <p className="text-xs font-semibold text-amber-500">{t("groupFull")}</p>
              ) : null}
              <Button className="w-full" onClick={() => void createGroup()}>
                {t("create")}
              </Button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet
        open={showRequests}
        onClose={() => setShowRequests(false)}
        title={t("messageRequests")}
      >
        <div className="space-y-2">
          {pendingReceived.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("noMessageRequests")}
            </p>
          ) : null}
          {pendingReceived.map((c) => {
            const person = c.others[0];
            const name = person?.username ?? "?";
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl p-2">
                <Link
                  to="/users/$id"
                  params={{ id: person?.username || person?.id || "" }}
                  onClick={() => setShowRequests(false)}
                >
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void respondToRequest(c.id, false)}
                >
                  {t("declineRequest")}
                </Button>
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet
        open={showFollowers}
        onClose={() => setShowFollowers(false)}
        title={t("recentFollowers")}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("recentFollowersHint")}</p>
          {recentFollowers.isLoading ? (
            <div className="space-y-3" aria-label={t("loading")}>
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
              ))}
            </div>
          ) : null}
          {!recentFollowers.isLoading && !recentFollowers.data?.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("noFollowersYet")}</p>
          ) : null}
          {(recentFollowers.data ?? []).map((follower) => {
            const name = follower.username ?? t("someone");
            return (
              <button
                key={follower.id}
                onClick={() => {
                  setShowFollowers(false);
                  void navigate({ to: "/users/$id", params: { id: follower.id } });
                }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <StoredImage
                  path={follower.avatar_url}
                  alt={name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                  fallback={name[0]?.toUpperCase() ?? "?"}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="truncate">{name}</span>
                    {follower.verified ? <Verified /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t("followedYou")} · {formatNotificationTime(follower.followed_at, lang)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        title={t("notifications")}
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400 p-5 text-white shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black">{t("activityCenter")}</p>
                <p className="mt-1 text-xs text-white/80">{t("notificationSubtitle")}</p>
              </div>
              {unreadCount ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-600">
                  {unreadCount} {t("notifNew")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["all", t("notifAll")],
                ["unread", t("notifUnread")],
                ["social", t("notifSocial")],
                ["system", t("notifSystem")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setNotificationFilter(value)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition",
                  notificationFilter === value
                    ? "bg-primary text-white"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={() => void markAll()}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <CheckCheck className="h-4 w-4" /> {t("markAllRead")}
            </button>
          </div>
          {/* Team Spark (welcome + video likes/comments/favorites/reposts)
              lives in its own pinned thread now, not here - this stays
              scoped to Sparks' own match/like/super activity. */}
          {activity
            .filter((notification) => {
              if (notificationFilter === "unread") return !notification.read;
              if (notificationFilter === "system") return notification.kind === "system";
              if (notificationFilter === "social") return notification.kind !== "system";
              return true;
            })
            .map((notification) => {
              const Icon =
                NOTIFICATION_ICONS[notification.kind as keyof typeof NOTIFICATION_ICONS] ??
                Newspaper;
              const actorName = notification.actor?.username ?? t("someone");
              const title = t(
                notification.kind === "match"
                  ? "notifMatchTitle"
                  : notification.kind === "like"
                    ? "notifLikeTitle"
                    : notification.kind === "super"
                      ? "notifSuperTitle"
                      : notification.kind === "message"
                        ? "notifMessageTitle"
                        : "notifSystemTitle",
              );
              const fallbackBody = t(
                notification.kind === "match"
                  ? "notifMatchBody"
                  : notification.kind === "like"
                    ? "notifLikeBody"
                    : notification.kind === "super"
                      ? "notifSuperBody"
                      : notification.kind === "message"
                        ? "notifMessageBody"
                        : "notifSystemBody",
                { name: actorName },
              );
              return (
                <button
                  key={notification.id}
                  onClick={() => void openNotification(notification)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                    notification.read ? "border-border bg-card" : "border-primary/35 bg-primary/10",
                  )}
                >
                  <div className="relative shrink-0">
                    <StoredImage
                      path={notification.actor?.avatar_url}
                      alt={actorName}
                      className="h-14 w-14 rounded-full object-cover"
                      fallback={
                        notification.kind === "system" ? "B" : (actorName[0]?.toUpperCase() ?? "?")
                      }
                    />
                    <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-white ring-2 ring-card">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black">{title}</p>
                      {!notification.read ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {notification.body === "safety_alert"
                        ? t("safetyAlertNotif")
                        : notification.body || fallbackBody}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-primary">
                      {formatNotificationTime(notification.created_at, lang)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </button>
              );
            })}
          {!notifications.data?.length ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              {t("noNotifications")}
            </p>
          ) : null}
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
