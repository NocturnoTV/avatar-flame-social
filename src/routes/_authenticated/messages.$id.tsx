import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Bookmark,
  Camera,
  ChevronRight,
  Copy,
  Crown,
  ExternalLink,
  Flag,
  Forward,
  Gift,
  Heart,
  ImagePlus,
  Mail,
  MessageCircle,
  Mic,
  MoreVertical,
  Pause,
  Phone,
  Play,
  Repeat2,
  Reply,
  Send,
  ShieldCheck,
  Smile,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { BloxIcon } from "@/components/Blox";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { PresenceDot, presenceStatus } from "@/components/PresenceDot";
import { ConversationInfoSheet } from "@/components/ConversationInfoSheet";
import { useCall } from "@/components/CallProvider";
import {
  BUBBLE_THEMES,
  WALLPAPERS,
  getBubbleTheme,
  getWallpaper,
  resolveWallpaperCss,
} from "@/lib/chatTheme";
import { isSparkPlusActive } from "@/lib/sparkPlus";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { ACTIVITY_NOTIFICATION_KINDS, localizeActivityAction } from "@/lib/activityNotifications";
import { UNREAD_CONVERSATIONS_KEY } from "@/lib/unreadConversations";
import { cn, errorMessage } from "@/lib/utils";

const EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😎",
  "😭",
  "🔥",
  "✨",
  "💖",
  "👀",
  "🎮",
  "🧱",
  "🚀",
  "👍",
  "🙏",
  "💀",
  "🤝",
];
const REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "🔥"];

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({
    meta: [
      { title: "Chat - Bloxspark" },
      { name: "description", content: "Private Bloxspark chat with voice messages and photos." },
      { property: "og:title", content: "Chat - Bloxspark" },
      { property: "og:description", content: "Text, photo and voice messages." },
    ],
  }),
  component: ConversationPage,
});

type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  kind: "text" | "image" | "voice" | "system" | "gift";
  media_url: string | null;
  created_at: string;
};

type ReactionRow = { message_id: string; user_id: string; emoji: string };

const REPORT_REASONS = [
  { id: "harassment", labelKey: "reportHarassment" },
  { id: "spam", labelKey: "reportSpam" },
  { id: "inappropriate_content", labelKey: "reportInappropriate" },
  { id: "impersonation", labelKey: "reportImpersonation" },
] as const;

const QUICK_REPLIES = [
  "😂",
  "👍 Ok",
  "On se capte quand ?",
  "Trop bien !",
  "😍",
  "Envoie une photo",
];

function formatLastSeen(value: string, lang: string) {
  const elapsed = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (absolute < 60_000) return formatter.format(Math.round(elapsed / 1000), "second");
  if (absolute < 3_600_000) return formatter.format(Math.round(elapsed / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(elapsed / 3_600_000), "hour");
  if (absolute < 604_800_000) return formatter.format(Math.round(elapsed / 86_400_000), "day");
  return new Date(value).toLocaleDateString(lang, { day: "numeric", month: "short" });
}

function ConversationPage() {
  const { id } = Route.useParams();
  if (id === "team-spark") return <TeamSparkConversation />;
  if (id === "activities") return <ActivitiesConversation />;
  return <Conversation />;
}

function Conversation() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useSession();
  const { theme } = useTheme();
  const { startCall } = useCall();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [recording, setRecording] = useState(false);
  const [info, setInfo] = useState(false);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<Message | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [wallpaperChoice, setWallpaperLocal] = useState(() => getWallpaper(id));
  const [bubbleChoice, setBubbleLocal] = useState(() => getBubbleTheme(id));
  const myPlus = useQuery({
    queryKey: ["my-spark-plus", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spark_plus_active,spark_plus_expires_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const hasPlus = isSparkPlusActive(myPlus.data);
  // Custom wallpaper/bubble is a Spark Plus perk - a non-Plus viewer (or one
  // whose Plus lapsed) always sees the classic default, even if a custom
  // choice is still saved locally from before.
  const wallpaper = hasPlus ? wallpaperChoice : WALLPAPERS[0]!;
  const bubble = hasPlus ? bubbleChoice : BUBBLE_THEMES[0]!;
  const wallpaperCss = resolveWallpaperCss(wallpaper, theme);
  const bubbleGradient = `linear-gradient(90deg, ${bubble.from} 0%, ${bubble.to} 100%)`;
  const [otherTyping, setOtherTyping] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const header = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data: convo } = await supabase
        .from("conversations")
        .select("id,is_group,name,request_status,created_by,streak_count")
        .eq("id", id)
        .maybeSingle();
      const { data: members } = await supabase
        .from("conversation_participants")
        .select("user_id,last_read_at,pinned,muted")
        .eq("conversation_id", id);
      const otherIds = (members ?? []).map((m) => m.user_id).filter((uid) => uid !== user?.id);
      const allIds = [
        ...new Set([...(members ?? []).map((m) => m.user_id), user?.id].filter(Boolean)),
      ] as string[];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,last_active_at,show_online_status,dnd")
        .in("id", allIds.length > 0 ? allIds : ["00000000-0000-0000-0000-000000000000"]);
      const byId: Record<
        string,
        {
          username: string;
          avatar_url: string | null;
          last_active_at: string | null;
          show_online_status: boolean | null;
          dnd: boolean | null;
        }
      > = {};
      for (const p of (people ?? []) as {
        id: string;
        username: string;
        avatar_url: string | null;
        last_active_at: string | null;
        show_online_status: boolean | null;
        dnd: boolean | null;
      }[]) {
        byId[p.id] = {
          username: p.username,
          avatar_url: p.avatar_url,
          last_active_at: p.last_active_at,
          show_online_status: p.show_online_status,
          dnd: p.dnd,
        };
      }
      const others = otherIds.map((uid) => byId[uid]?.username ?? "?");
      const otherId = otherIds[0] ?? null;
      const otherRead = (members ?? []).find((m) => m.user_id === otherId)?.last_read_at ?? null;
      const otherPresence = otherId ? byId[otherId] : null;
      const online = otherPresence ? presenceStatus(otherPresence) === "online" : false;
      const mine = (members ?? []).find((m) => m.user_id === user?.id);
      const nickname =
        otherId && user
          ? ((
              await supabase
                .from("contact_nicknames")
                .select("nickname")
                .eq("owner_id", user.id)
                .eq("contact_id", otherId)
                .maybeSingle()
            ).data?.nickname ?? null)
          : null;

      return {
        title: convo?.is_group ? convo.name : (nickname ?? others[0] ?? "?"),
        realUsername: others[0] ?? "?",
        isGroup: !!convo?.is_group,
        members: others.length + 1,
        people: byId,
        otherId,
        online,
        otherPresence,
        lastActiveAt: otherId ? (byId[otherId]?.last_active_at ?? null) : null,
        otherReadAt: otherRead,
        requestStatus: convo?.request_status ?? "accepted",
        isRequester: convo?.created_by === user?.id,
        pinned: mine?.pinned ?? false,
        muted: mine?.muted ?? false,
        streakCount: convo?.streak_count ?? 0,
      };
    },
  });

  async function respondToRequest(accept: boolean) {
    await supabase
      .from("conversations")
      .update({ request_status: accept ? "accepted" : "declined" })
      .eq("id", id);
    void header.refetch();
    if (!accept) await navigate({ to: "/messages" });
  }

  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,sender_id,content,kind,media_url,created_at")
        .eq("conversation_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // A banned-word hit flags a "safety_alert" notification for the person who
  // received the message - shown small, right here in the conversation, and
  // never in the global notification feed (only the victim ever sees it).
  const safetyAlert = useQuery({
    queryKey: ["safety-alert", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("conversation_id", id)
        .eq("user_id", user!.id)
        .eq("body", "safety_alert")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  async function dismissSafetyAlert() {
    if (!safetyAlert.data) return;
    await supabase.from("notifications").update({ read: true }).eq("id", safetyAlert.data.id);
    void safetyAlert.refetch();
  }

  const messageIds = (messages.data ?? []).map((m) => m.id);
  const reactions = useQuery({
    queryKey: ["message-reactions", id, messageIds.join(",")],
    enabled: messageIds.length > 0,
    queryFn: async (): Promise<ReactionRow[]> => {
      const { data } = await supabase
        .from("message_reactions")
        .select("message_id,user_id,emoji")
        .in("message_id", messageIds);
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`message-reactions-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => void reactions.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live read receipts - as soon as the other person's last_read_at moves,
  // refresh so "Vu" appears under my messages without needing to reopen.
  useEffect(() => {
    const channel = supabase
      .channel(`read-receipts-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${id}`,
        },
        () => void header.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reactTo(message: Message, emoji: string) {
    if (!user) return;
    const mine = (reactions.data ?? []).find(
      (r) => r.message_id === message.id && r.user_id === user.id,
    );
    if (mine?.emoji === emoji) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", message.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("message_reactions")
        .upsert(
          { message_id: message.id, user_id: user.id, emoji },
          { onConflict: "message_id,user_id" },
        );
    }
    setActiveMessage(null);
    void reactions.refetch();
  }

  function reactionsFor(messageId: string) {
    const rows = (reactions.data ?? []).filter((r) => r.message_id === messageId);
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const r of rows) {
      const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.user_id === user?.id) entry.mine = true;
      byEmoji.set(r.emoji, entry);
    }
    return [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v }));
  }

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => {
          setOtherTyping(false);
          void messages.refetch();
          void header.refetch();
          void safetyAlert.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, messages, header, safetyAlert]);

  // "typing…" indicator - a lightweight realtime broadcast, no table needed.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`typing-${id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        setOtherTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [id, user]);

  function notifyTyping() {
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    void typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, otherTyping]);

  useEffect(() => {
    if (!user) return;
    // Uses the database's own clock (see mark_conversation_read) rather
    // than the client's, so a slightly-behind device clock can't leave
    // last_read_at stuck earlier than a message that arrived moments ago.
    void supabase.rpc("mark_conversation_read", { _conversation: id }).then(() => {
      // Keep the conversations list's unread badge in sync - otherwise it
      // stays stale until something else happens to refetch it.
      void qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      void qc.invalidateQueries({ queryKey: [UNREAD_CONVERSATIONS_KEY, user.id] });
    });
  }, [id, user, messages.data, qc]);

  async function send(kind: "text" | "image" | "voice", payload?: string) {
    if (!user) return;
    if (kind === "text" && !text.trim()) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      kind,
      content: kind === "text" ? text.trim() : null,
      media_url: payload ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (kind === "text") setText("");
    setShowQuickReplies(false);
    void messages.refetch();
  }

  async function pickImage(file: File) {
    if (!user) return;
    try {
      const path = await uploadFile(
        "profile-photos",
        user.id,
        file,
        file.name.split(".").pop() ?? "jpg",
      );
      await send("image", path);
    } catch {
      toast.error(t("errorGeneric"));
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (!user) return;
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        const path = await uploadFile("voice-messages", user.id, file, "webm");
        await send("voice", path);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error(t("micDenied"));
    }
  }

  async function deleteMessage(m: Message) {
    await supabase.from("messages").delete().eq("id", m.id);
    setActiveMessage(null);
    void messages.refetch();
  }

  async function copyMessage(m: Message) {
    if (m.content) await navigator.clipboard.writeText(m.content);
    setActiveMessage(null);
    toast.success(t("saved"));
  }

  const myUsername = user ? (header.data?.people?.[user.id]?.username ?? "?") : "?";

  async function reportMessage(reasonId: string) {
    if (!user || !reportingMessage) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_user_id: reportingMessage.sender_id,
      message_id: reportingMessage.id,
      reason: reasonId,
    });
    setReportingMessage(null);
    setActiveMessage(null);
    toast.success(t("saved"));
  }

  async function forwardMessageTo(friendId: string) {
    if (!user || !forwardingMessage) return;
    try {
      const { data: destConversationId, error } = await supabase.rpc("start_direct_message", {
        _target: friendId,
      });
      if (error) throw error;
      await supabase.from("messages").insert({
        conversation_id: destConversationId as string,
        sender_id: user.id,
        kind: forwardingMessage.kind === "system" ? "text" : forwardingMessage.kind,
        content: forwardingMessage.content,
        media_url: forwardingMessage.media_url,
      });
      await supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user.id,
        kind: "system",
        content: `sys:forwarded:${myUsername}`,
      });
      toast.success(t("saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setForwardingMessage(null);
      setActiveMessage(null);
      void messages.refetch();
    }
  }

  // Best-effort screenshot notice: browsers give web pages no real API to
  // detect a screenshot. This catches the PrintScreen key on desktop while
  // the tab is focused - there is no equivalent signal on mobile web at all.
  useEffect(() => {
    if (!user) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "PrintScreen") return;
      void supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user!.id,
        kind: "system",
        content: `sys:screenshot:${myUsername}`,
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [id, user, myUsername]);

  const list = messages.data ?? [];

  return (
    <div className="app-background mx-auto flex h-[100dvh] w-full max-w-md flex-col text-foreground lg:h-screen">
      {/* En-tête fixe */}
      <header className="flex h-[74px] shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link to="/messages" aria-label={t("back")} className="text-[#050505] dark:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {header.data?.isGroup || !header.data?.otherId ? (
          <div className="spark-gradient flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white">
            👥
          </div>
        ) : (
          <Link
            to="/users/$id"
            params={{
              id:
                header.data.realUsername && header.data.realUsername !== "?"
                  ? header.data.realUsername
                  : header.data.otherId,
            }}
            className="relative shrink-0"
          >
            <StoredImage
              path={header.data.people[header.data.otherId]?.avatar_url}
              alt={header.data.title ?? ""}
              className="h-11 w-11 rounded-full object-cover"
              fallback={header.data.title?.[0]?.toUpperCase() ?? "?"}
            />
            {header.data.otherPresence ? (
              <PresenceDot
                profile={header.data.otherPresence}
                className="absolute bottom-0 right-0 h-3 w-3"
              />
            ) : null}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-bold leading-tight text-[#050505] dark:text-white">
            <span className="truncate">{header.data?.title}</span>
            {!header.data?.isGroup && header.data?.streakCount ? (
              <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-orange-500">
                🔥{header.data.streakCount}
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-[#929292]">
            {otherTyping ? (
              <span className="font-semibold text-primary">{t("typing")}</span>
            ) : header.data?.isGroup ? (
              `${header.data.members} ${t("members")}`
            ) : header.data?.online ? (
              t("onlineNow")
            ) : header.data?.lastActiveAt ? (
              t("lastSeen", {
                time: formatLastSeen(header.data.lastActiveAt, lang),
              })
            ) : (
              t("offline")
            )}
          </p>
        </div>
        {!header.data?.isGroup && header.data?.otherId ? (
          <button
            onClick={() => {
              const otherId = header.data?.otherId;
              if (!otherId) return;
              const other = header.data?.people[otherId];
              void startCall(id, {
                id: otherId,
                username: header.data?.realUsername ?? other?.username ?? "?",
                avatarUrl: other?.avatar_url ?? null,
              });
            }}
            aria-label={t("call")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#050505] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
          >
            <Phone className="h-5 w-5" />
          </button>
        ) : null}
        <button
          onClick={() => setInfo(true)}
          aria-label={t("more")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#050505] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      {safetyAlert.data ? (
        <div className="flex items-center justify-between gap-2 bg-amber-500/10 px-4 py-2">
          <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-300">
            {t("safetyAlertNotif")}
          </p>
          <button
            onClick={() => void dismissSafetyAlert()}
            aria-label={t("cancel")}
            className="shrink-0 text-amber-600 dark:text-amber-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {header.data?.requestStatus === "pending" ? (
        header.data.isRequester ? (
          <p className="bg-primary/10 px-4 py-2.5 text-center text-xs font-semibold text-primary">
            {t("requestSent")}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2 bg-primary/10 px-4 py-2.5">
            <p className="text-xs font-semibold text-primary">{t("requestPending")}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void respondToRequest(true)}>
                {t("acceptRequest")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void respondToRequest(false)}>
                {t("declineRequest")}
              </Button>
            </div>
          </div>
        )
      ) : null}

      {/* Liste défilante */}
      <div
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        style={{ background: wallpaperCss }}
      >
        {list.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const sender = header.data?.people?.[m.sender_id];
          const prev = list[i - 1];
          const next = list[i + 1];
          const sameAsPrev = prev?.sender_id === m.sender_id;
          const sameAsNext = next?.sender_id === m.sender_id;
          const isLastOfGroup = !sameAsNext;
          const isRead =
            mine && header.data?.otherReadAt
              ? new Date(header.data.otherReadAt).getTime() >= new Date(m.created_at).getTime()
              : false;

          if (m.kind === "system") {
            const [, tag, actor] = m.content?.match(/^sys:(\w+):(.*)$/) ?? [];
            const label =
              tag === "forwarded"
                ? t("systemForwarded", { username: actor ?? "?" })
                : tag === "screenshot"
                  ? t("systemScreenshot", { username: actor ?? "?" })
                  : tag === "call"
                    ? t("systemCallEnded", { duration: actor ?? "0:00" })
                    : tag === "missedcall"
                      ? t("systemMissedCall")
                      : tag === "calldeclined"
                        ? t("systemCallDeclined")
                        : m.content;
            return (
              <div key={m.id} className="my-3 flex justify-center">
                <span className="rounded-full bg-black/5 px-3 py-1.5 text-center text-[11px] font-semibold text-[#929292] dark:bg-white/10">
                  {label}
                </span>
              </div>
            );
          }

          const myReactions = reactionsFor(m.id);

          return (
            <div key={m.id} className={cn("bx-pop", sameAsPrev ? "mt-1" : "mt-4")}>
              <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine ? (
                  <div className="h-7 w-7 shrink-0">
                    {isLastOfGroup ? (
                      <StoredImage
                        path={sender?.avatar_url ?? null}
                        alt={sender?.username ?? ""}
                        className="h-7 w-7 rounded-full object-cover"
                        fallback="🎮"
                      />
                    ) : null}
                  </div>
                ) : null}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (m.kind === "image") setLightbox(m);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveMessage(m);
                  }}
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => setActiveMessage(m), 450);
                    const clear = () => clearTimeout(timer);
                    e.currentTarget.addEventListener("touchend", clear, { once: true });
                    e.currentTarget.addEventListener("touchmove", clear, { once: true });
                  }}
                  className={cn(
                    "max-w-[70%] text-left transition-transform active:scale-[0.98]",
                    mine ? "max-w-[72%]" : "max-w-[68%]",
                  )}
                >
                  {m.kind === "text" ? (
                    <MessageText
                      content={m.content}
                      mine={mine}
                      bubbleGradient={bubbleGradient}
                      onExternalLink={setExternalUrl}
                    />
                  ) : null}

                  {m.kind === "image" ? <ImageBubble path={m.media_url} mine={mine} /> : null}

                  {m.kind === "voice" ? (
                    mine ? (
                      <div
                        className="rounded-[26px] px-4 py-3 shadow-sm"
                        style={{ background: bubbleGradient }}
                      >
                        <VoicePlayer path={m.media_url} light />
                      </div>
                    ) : (
                      <ReceivedBubble padded={false}>
                        <div className="px-4 py-3">
                          <VoicePlayer path={m.media_url} />
                        </div>
                      </ReceivedBubble>
                    )
                  ) : null}

                  {m.kind === "gift" ? <GiftBubble content={m.content} /> : null}

                  {myReactions.length > 0 ? (
                    <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
                      {myReactions.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            void reactTo(m, r.emoji);
                          }}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                            r.mine
                              ? "border-primary bg-primary/10"
                              : "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10",
                          )}
                        >
                          {r.emoji} {r.count > 1 ? r.count : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {mine ? <div className="w-7 shrink-0" /> : null}
              </div>
              {mine && isLastOfGroup ? (
                <p className="mt-0.5 pr-1 text-right text-[10px] text-[#929292]">
                  {isRead ? t("read") : t("sent")}
                </p>
              ) : null}
            </div>
          );
        })}

        {otherTyping ? (
          <div className="bx-pop mt-4 flex items-end justify-start gap-2">
            <div className="h-7 w-7 shrink-0">
              {header.data?.otherId ? (
                <StoredImage
                  path={header.data.people[header.data.otherId]?.avatar_url}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                  fallback="🎮"
                />
              ) : null}
            </div>
            <div className="rounded-[26px] border-2 border-foreground bg-background px-4 py-3">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((n) => (
                  <span
                    key={n}
                    className="h-2 w-2 animate-bounce rounded-full bg-[#050505] dark:bg-white"
                    style={{ animationDelay: `${n * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* Réponses rapides */}
      <div className="border-t border-border bg-background px-3 pt-2">
        {showQuickReplies ? (
          <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setText(q);
                  setShowQuickReplies(false);
                }}
                className="shrink-0 rounded-full bg-[#F5F5F5] px-3.5 py-2 text-sm font-medium text-[#050505] dark:bg-[#1c1c1e] dark:text-white"
              >
                {q}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setShowQuickReplies(true)}
            className="mb-2 flex items-center gap-2 rounded-full bg-[#F5F5F5] px-3.5 py-2 text-sm text-[#929292] dark:bg-[#1c1c1e]"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#A855F7] text-white">
              <Zap className="h-3 w-3 fill-white" />
            </span>
            {t("quickReplies")}
          </button>
        )}

        {showEmoji ? (
          <div className="mb-2 grid grid-cols-8 gap-1 text-2xl">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setText((v) => v + e)}
                className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}

        {/* Barre de composition */}
        <div className="flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => cameraRef.current?.click()}
            aria-label={t("photo")}
            className="grid h-11 w-11 shrink-0 place-items-center text-[#050505] dark:text-white"
          >
            <Camera className="h-6 w-6" />
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickImage(file);
              e.target.value = "";
            }}
          />

          <div className="flex min-h-[64px] flex-1 items-center gap-2 rounded-[32px] bg-[#F5F5F5] px-4 py-2 transition-shadow focus-within:ring-2 focus-within:ring-primary/40 dark:bg-[#1c1c1e]">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                notifyTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send("text");
                }
              }}
              placeholder={t("typeMessage")}
              className="max-h-28 min-w-0 flex-1 resize-none bg-transparent text-[15px] text-[#050505] outline-none placeholder:text-[#929292] dark:text-white"
            />
            <button
              onClick={() => fileRef.current?.click()}
              aria-label={t("addPhoto")}
              className="shrink-0 text-[#050505] dark:text-white"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pickImage(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="emoji"
              className="shrink-0 text-[#050505] dark:text-white"
            >
              <Smile className="h-5 w-5" />
            </button>
          </div>

          {text.trim() ? (
            <Button
              size="icon"
              onClick={() => send("text")}
              aria-label={t("send")}
              className="bx-pop shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <button
              onClick={toggleRecording}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition",
                recording
                  ? "scale-110 bg-destructive text-white"
                  : "text-[#050505] dark:text-white",
              )}
              aria-label={t("recordVoice")}
            >
              {recording ? <Square className="h-5 w-5" /> : <Mic className="h-6 w-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Menu contextuel appui long */}
      {activeMessage ? (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setActiveMessage(null)}
        >
          <div
            className="bx-pop w-full max-w-xs rounded-t-3xl bg-card p-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center gap-3 border-b border-black/5 pb-3 dark:border-white/10">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => void reactTo(activeMessage, r)}
                  className="text-2xl transition active:scale-90"
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              <MenuRow icon={Reply} label={t("reply")} onClick={() => setActiveMessage(null)} />
              {activeMessage.kind === "text" ? (
                <MenuRow
                  icon={Copy}
                  label={t("copy")}
                  onClick={() => void copyMessage(activeMessage)}
                />
              ) : null}
              <MenuRow
                icon={Forward}
                label={t("forward")}
                onClick={() => setForwardingMessage(activeMessage)}
              />
              {activeMessage.sender_id !== user?.id ? (
                <MenuRow
                  icon={Flag}
                  label={t("reportMessage")}
                  destructive
                  onClick={() => setReportingMessage(activeMessage)}
                />
              ) : null}
              {activeMessage.sender_id === user?.id ? (
                <MenuRow
                  icon={Trash2}
                  label={t("delete")}
                  destructive
                  onClick={() => void deleteMessage(activeMessage)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {reportingMessage ? (
        <div
          className="fixed inset-0 z-[76] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setReportingMessage(null)}
        >
          <div
            className="bx-pop w-full max-w-xs rounded-t-3xl bg-card p-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
              {t("reportReason")}
            </p>
            <div className="space-y-1">
              {REPORT_REASONS.map((reason) => (
                <MenuRow
                  key={reason.id}
                  icon={Flag}
                  label={t(reason.labelKey)}
                  onClick={() => void reportMessage(reason.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {forwardingMessage ? (
        <ForwardSheet
          onPick={(friendId) => void forwardMessageTo(friendId)}
          onClose={() => setForwardingMessage(null)}
        />
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/95 p-3"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <LightboxImage path={lightbox.media_url} />
        </div>
      ) : null}

      {externalUrl ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setExternalUrl(null)}
        >
          <section
            className="w-full max-w-sm rounded-[2rem] border border-border bg-background p-6 text-foreground shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
              <ExternalLink className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-xl font-black">{t("externalLink")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("externalLinkWarning")}
            </p>
            <p className="mt-4 break-all rounded-2xl border border-border bg-surface p-3 text-xs font-semibold">
              {externalUrl}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setExternalUrl(null)}>
                {t("back")}
              </Button>
              <Button
                onClick={() => {
                  window.open(externalUrl, "_blank", "noopener,noreferrer");
                  setExternalUrl(null);
                }}
              >
                {t("continueAnyway")}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {info && header.data ? (
        <ConversationInfoSheet
          conversationId={id}
          // otherId is really "the other participant in a 1:1 DM" - the
          // header query sets it to the first other member regardless of
          // group/DM (needed elsewhere for e.g. presence), so it must be
          // normalized to null for a group here, or every group's info
          // sheet would render as if it were a DM with that first member.
          otherId={header.data.isGroup ? null : header.data.otherId}
          title={header.data.realUsername ?? header.data.title ?? "?"}
          avatarUrl={
            !header.data.isGroup && header.data.otherId
              ? (header.data.people[header.data.otherId]?.avatar_url ?? null)
              : null
          }
          pinned={header.data.pinned}
          muted={header.data.muted}
          onClose={() => setInfo(false)}
          onChanged={() => {
            setWallpaperLocal(getWallpaper(id));
            setBubbleLocal(getBubbleTheme(id));
            void header.refetch();
            void qc.invalidateQueries({ queryKey: ["conversations"] });
          }}
        />
      ) : null}
    </div>
  );
}

// Team Spark is reserved for official messages only (the welcome message,
// future announcements) - video activity now lives in ActivitiesConversation
// instead, kept in sync with the same list in messages.index.tsx.
const TEAM_SPARK_NOTIFICATION_KINDS = ["system"] as const;

type TeamSparkNotification = {
  id: string;
  body: string | null;
  read: boolean;
  created_at: string;
  video_id: string | null;
};

/** Team Spark bodies are almost all small markers (not pre-rendered text) so
 * they can be translated live in the viewer's *current* language - same
 * principle as the Activités notifications. Kept as one function since the
 * list keeps growing (purchases, video review, giveaways, moderation...). */
function localizeTeamSparkBody(
  t: (key: string, vars?: Record<string, string | number>) => string,
  body: string | null,
): string {
  if (body === "safety_alert") return t("safetyAlertNotif");
  if (body === "video_pending_review") return t("notifVideoPendingReview");
  if (body === "video_approved") return t("notifVideoApproved");
  if (body === "video_rejected") return t("notifVideoRejected");
  if (body === "dispute_accepted") return t("notifDisputeAccepted");
  if (body === "dispute_rejected") return t("notifDisputeRejected");
  if (body?.startsWith("purchase_thanks:")) {
    const [, kind, amount] = body.split(":");
    return kind === "blox"
      ? t("purchaseThanksBloxBody", { amount: Number(amount) || 0 })
      : t("purchaseThanksSparkPlusBody");
  }
  if (body?.startsWith("giveaway_won:")) {
    return t("notifGiveawayWon", { title: body.slice("giveaway_won:".length) });
  }
  if (body?.startsWith("moderation_warning:")) {
    return t("notifModerationWarning", {
      reason: decodeURIComponent(body.slice("moderation_warning:".length)),
    });
  }
  return body ?? "";
}

function TeamSparkConversation() {
  const { user } = useSession();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const announcements = useQuery({
    queryKey: ["team-spark-notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TeamSparkNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,body,read,created_at,video_id")
        .eq("user_id", user!.id)
        .in("kind", TEAM_SPARK_NOTIFICATION_KINDS)
        // Safety-alert markers reuse kind "system" but are shown inline in
        // the affected conversation instead, never here.
        .neq("body", "safety_alert")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user || !announcements.data?.some((item) => !item.read)) return;
    void (async () => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .in("kind", TEAM_SPARK_NOTIFICATION_KINDS)
        .neq("body", "safety_alert")
        .eq("read", false);
      await Promise.all([
        announcements.refetch(),
        qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
        qc.invalidateQueries({ queryKey: ["unread-notifications", user.id] }),
      ]);
    })();
  }, [announcements.data, qc, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`team-spark-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => void announcements.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [announcements, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [announcements.data?.length]);

  return (
    <div className="app-background flex h-[100dvh] flex-col text-foreground lg:h-screen">
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-background px-3">
        <button
          onClick={() => void navigate({ to: "/messages" })}
          aria-label={t("back")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-violet-800 p-2 shadow-md shadow-violet-500/25">
          <img src="/team-spark-avatar.png" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[16px] font-black">
            Team Spark <ShieldCheck className="h-4 w-4 fill-primary text-primary-foreground" />
          </p>
          <p className="truncate text-xs text-muted-foreground">{t("systemNotifications")}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-end">
          <div className="mb-6 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-violet-800 p-3 shadow-xl shadow-violet-500/20">
              <img src="/team-spark-avatar.png" alt="" className="h-full w-full object-contain" />
            </div>
            <h1 className="mt-3 text-xl font-black">Team Spark</h1>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {t("systemNotifications")}
            </p>
          </div>

          {announcements.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-20 w-[min(88%,34rem)] animate-pulse rounded-[24px] bg-muted"
                />
              ))}
            </div>
          ) : announcements.data?.length ? (
            <div className="space-y-4">
              {announcements.data.map((announcement) => (
                <article key={announcement.id} className="flex items-end gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-violet-800 p-1.5">
                    <img
                      src="/team-spark-avatar.png"
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="max-w-[82%]">
                    <div className="rounded-[24px] rounded-bl-md bg-gradient-to-br from-violet-600 to-violet-800 px-4 py-3 text-white shadow-sm">
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {localizeTeamSparkBody(t, announcement.body)}
                      </p>
                      {announcement.body?.startsWith("purchase_thanks:") ? (
                        <Link
                          to="/shop/billing"
                          className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
                        >
                          {t("purchaseThanksCta")}
                        </Link>
                      ) : null}
                      {announcement.body === "video_approved" && announcement.video_id ? (
                        <Link
                          to="/discover"
                          search={{ v: announcement.video_id }}
                          className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
                        >
                          {t("videoApprovedCta")}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                      {formatLastSeen(announcement.created_at, lang)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="my-auto rounded-3xl border border-dashed border-violet-500/30 bg-violet-500/5 px-6 py-10 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-violet-500" />
              <p className="mt-3 text-sm font-semibold">{t("noNotifications")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("notificationEmptyHint")}</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>
    </div>
  );
}

type ActivityNotificationRow = {
  id: string;
  kind: string;
  body: string | null;
  read: boolean;
  created_at: string;
  video_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  actor: { username: string | null; avatar_url: string | null } | null;
};

type ActivityTab = "all" | "comments" | "mentions" | "likes" | "other";

const ACTIVITY_TAB_KINDS: Record<ActivityTab, readonly string[] | null> = {
  all: null,
  comments: ["video_comment", "video_comment_reply"],
  mentions: ["video_mention"],
  likes: ["video_like", "video_favorite"],
  other: ["video_repost"],
};

const ACTIVITY_KIND_ICON: Record<string, typeof Heart> = {
  video_like: Heart,
  video_favorite: Bookmark,
  video_repost: Repeat2,
  video_comment: MessageCircle,
  video_comment_reply: MessageCircle,
  video_mention: AtSign,
};

const ACTIVITY_KIND_ICON_CLASS: Record<string, string> = {
  video_like: "bg-red-500 text-white",
  video_favorite: "bg-amber-400 text-white",
  video_repost: "bg-sky-500 text-white",
  video_comment: "bg-primary text-primary-foreground",
  video_comment_reply: "bg-primary text-primary-foreground",
  video_mention: "bg-violet-500 text-white",
};

function ActivitiesConversation() {
  const { user } = useSession();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<ActivityTab>("all");

  const activities = useQuery({
    queryKey: ["activities-notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ActivityNotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,kind,body,read,created_at,actor_id,video_id,comment_id")
        .eq("user_id", user!.id)
        .in("kind", ACTIVITY_NOTIFICATION_KINDS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      const { data: actors } = actorIds.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", actorIds)
        : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };
      const byId = new Map((actors ?? []).map((a) => [a.id, a]));
      return rows.map((r) => ({ ...r, actor: r.actor_id ? (byId.get(r.actor_id) ?? null) : null }));
    },
  });

  const TABS: { id: ActivityTab; label: string }[] = [
    { id: "all", label: t("activitiesTabAll") },
    { id: "comments", label: t("activitiesTabComments") },
    { id: "mentions", label: t("activitiesTabMentions") },
    { id: "likes", label: t("activitiesTabLikes") },
    { id: "other", label: t("activitiesTabOther") },
  ];
  const kindsForTab = ACTIVITY_TAB_KINDS[tab];
  const filtered = (activities.data ?? []).filter(
    (item) => !kindsForTab || kindsForTab.includes(item.kind),
  );

  useEffect(() => {
    if (!user || !activities.data?.some((item) => !item.read)) return;
    void (async () => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .in("kind", ACTIVITY_NOTIFICATION_KINDS)
        .eq("read", false);
      await Promise.all([
        activities.refetch(),
        qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
        qc.invalidateQueries({ queryKey: ["unread-notifications", user.id] }),
      ]);
    })();
  }, [activities.data, qc, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`activities-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => void activities.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activities, user]);

  function openTarget(item: ActivityNotificationRow) {
    if (!item.video_id) return;
    const isCommentKind =
      item.kind === "video_comment" ||
      item.kind === "video_comment_reply" ||
      item.kind === "video_mention";
    void navigate({
      to: "/discover",
      search:
        isCommentKind && item.comment_id
          ? { v: item.video_id, c: item.comment_id }
          : { v: item.video_id },
    });
  }

  return (
    <div className="app-background flex h-[100dvh] flex-col text-foreground lg:h-screen">
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-background px-3">
        <button
          onClick={() => void navigate({ to: "/messages" })}
          aria-label={t("back")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md shadow-blue-500/25">
          <Mail className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black">{t("activitiesTitle")}</p>
          <p className="truncate text-xs text-muted-foreground">{t("activitiesSubtitle")}</p>
        </div>
      </header>

      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background px-3 py-2.5">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              tab === tabItem.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10",
            )}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl">
          {activities.isLoading ? (
            <div className="space-y-1 px-3 py-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="divide-y divide-border px-1">
              {filtered.map((item) => {
                const actorName = item.actor?.username ?? t("someone");
                const ActionIcon = ACTIVITY_KIND_ICON[item.kind] ?? Mail;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openTarget(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openTarget(item);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-black/[.03] dark:hover:bg-white/[.05]"
                  >
                    <Link
                      to="/users/$id"
                      params={{ id: item.actor_id ?? "" }}
                      onClick={(e) => e.stopPropagation()}
                      className="relative shrink-0"
                      aria-label={actorName}
                    >
                      <StoredImage
                        path={item.actor?.avatar_url}
                        alt={actorName}
                        className="h-12 w-12 rounded-full object-cover"
                        fallback={actorName[0]?.toUpperCase() ?? "?"}
                      />
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full ring-2 ring-background",
                          ACTIVITY_KIND_ICON_CLASS[item.kind] ??
                            "bg-primary text-primary-foreground",
                        )}
                      >
                        <ActionIcon className="h-3 w-3" fill="currentColor" />
                      </span>
                      {!item.read ? (
                        <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-background" />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] leading-snug">
                        <Link
                          to="/users/$id"
                          params={{ id: item.actor_id ?? "" }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold hover:underline"
                        >
                          @{actorName}
                        </Link>{" "}
                        <span className="text-foreground/85">
                          {localizeActivityAction(t, item.kind, item.body)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatLastSeen(item.created_at, lang)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mx-3 mt-6 rounded-3xl border border-dashed border-blue-500/30 bg-blue-500/5 px-6 py-10 text-center">
              <Mail className="mx-auto h-8 w-8 text-blue-500" />
              <p className="mt-3 text-sm font-semibold">{t("noNotifications")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("notificationEmptyHint")}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10",
        destructive ? "text-destructive" : "text-[#050505] dark:text-white",
      )}
    >
      <Icon className="h-4.5 w-4.5" /> {label}
    </button>
  );
}

/** Pick a Sparks match to forward a message to. */
function ForwardSheet({
  onPick,
  onClose,
}: {
  onPick: (friendId: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();

  const matches = useQuery({
    queryKey: ["forward-sheet-matches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("matches")
        .select("user_a,user_b")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      const otherIds = (rows ?? []).map((m) => (m.user_a === user!.id ? m.user_b : m.user_a));
      if (!otherIds.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", otherIds);
      return people ?? [];
    },
  });

  return (
    <div
      className="fixed inset-0 z-[77] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="bx-pop w-full max-w-xs rounded-t-3xl bg-card p-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-1 text-sm font-bold">{t("forwardTo")}</p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(matches.data ?? []).length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">{t("noMatchesToShare")}</p>
          ) : (
            (matches.data ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => onPick(m.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <StoredImage
                  path={m.avatar_url}
                  alt={m.username ?? ""}
                  className="h-10 w-10 rounded-full object-cover"
                  fallback={m.username?.[0]?.toUpperCase() ?? "?"}
                />
                <span className="font-semibold">{m.username}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Classic bubble for messages from the other person - plain, purple-tinted. */
function ReceivedBubble({
  children,
  padded = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="rounded-[26px] bg-primary/12 text-foreground dark:bg-primary/20">
      {padded ? (
        <p className="whitespace-pre-wrap break-words px-[22px] py-[16px] text-[15px]">
          {children}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function ImageBubble({ path, mine }: { path: string | null; mine: boolean }) {
  const url = useSignedUrl(path);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px]",
        !mine && "border-2 border-[#050505] dark:border-white",
      )}
    >
      {url ? (
        <img src={url} alt="" className="h-48 w-48 object-cover" />
      ) : (
        <div className="h-48 w-48 animate-pulse bg-black/5 dark:bg-white/10" />
      )}
    </div>
  );
}

/** Renders a "gift" message (Blox sent, or Spark Plus gifted) as its own
 * highlighted card rather than a plain text bubble - content is a small
 * JSON payload: {"type":"blox","amount":500} or {"type":"spark_plus"}. */
function GiftBubble({ content }: { content: string | null }) {
  const { t } = useI18n();
  let gift: { type: string; amount?: number } | null = null;
  try {
    gift = content ? JSON.parse(content) : null;
  } catch {
    gift = null;
  }
  const isSparkPlus = gift?.type === "spark_plus";
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card px-4 py-3 shadow-sm">
      <span className="spark-gradient grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-[0_0_14px_rgba(168,85,247,.45)]">
        {isSparkPlus ? <Crown className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
      </span>
      <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
        {isSparkPlus ? (
          t("giftMessageSparkPlus")
        ) : (
          <>
            {t("giftMessageBlox", { amount: (gift?.amount ?? 0).toLocaleString() })}
            <BloxIcon className="h-4 w-4 shrink-0" />
          </>
        )}
      </p>
    </div>
  );
}

function sharedVideoId(content: string | null) {
  if (!content) return null;
  const marker = content.match(/^video:([0-9a-f-]{36})$/i);
  if (marker?.[1]) return marker[1];
  try {
    const url = content.match(/https?:\/\/[^\s]+/i)?.[0];
    if (!url) return null;
    const parsed = new URL(url);
    return parsed.pathname === "/discover" ? parsed.searchParams.get("v") : null;
  } catch {
    return null;
  }
}

function MessageText({
  content,
  mine,
  bubbleGradient,
  onExternalLink,
}: {
  content: string | null;
  mine: boolean;
  bubbleGradient: string;
  onExternalLink: (url: string) => void;
}) {
  const videoId = sharedVideoId(content);
  if (videoId) return <SharedVideoCard videoId={videoId} mine={mine} />;
  const body = (
    <LinkifiedText content={content ?? ""} mine={mine} onExternalLink={onExternalLink} />
  );
  return mine ? (
    <p
      className="whitespace-pre-wrap break-words rounded-[26px] px-[30px] py-[18px] text-[15px] text-white shadow-sm"
      style={{ background: bubbleGradient }}
    >
      {body}
    </p>
  ) : (
    <ReceivedBubble>{body}</ReceivedBubble>
  );
}

function LinkifiedText({
  content,
  mine,
  onExternalLink,
}: {
  content: string;
  mine: boolean;
  onExternalLink: (url: string) => void;
}) {
  const parts = content.split(/(https?:\/\/[^\s]+)/gi);
  return (
    <>
      {parts.map((part, index) => {
        if (!/^https?:\/\//i.test(part)) return <span key={`${index}-${part}`}>{part}</span>;
        let internal = false;
        try {
          internal = new URL(part).origin === window.location.origin;
        } catch {
          internal = false;
        }
        return internal ? (
          <a
            key={`${index}-${part}`}
            href={part}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "break-all font-bold underline underline-offset-2",
              mine ? "text-white" : "text-primary",
            )}
          >
            {part}
          </a>
        ) : (
          <span
            key={`${index}-${part}`}
            role="link"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onExternalLink(part);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onExternalLink(part);
            }}
            className={cn(
              "cursor-pointer break-all font-bold underline underline-offset-2",
              mine ? "text-white" : "text-primary",
            )}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

function SharedVideoCard({ videoId, mine }: { videoId: string; mine: boolean }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const video = useQuery({
    queryKey: ["shared-video-message", videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id,user_id,storage_path,thumbnail_path,caption,views_count")
        .eq("id", videoId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", data.user_id)
        .maybeSingle();
      return { ...data, profile };
    },
  });
  const videoUrl = useSignedUrl(video.data?.storage_path ?? null);
  const thumbnailUrl = useSignedUrl(video.data?.thumbnail_path ?? null);
  if (video.isLoading) return <div className="h-52 w-60 animate-pulse rounded-3xl bg-surface" />;
  if (!video.data) return <ReceivedBubble>{t("noFeedVideos")}</ReceivedBubble>;
  return (
    <article
      className={cn(
        "w-64 overflow-hidden rounded-3xl border shadow-lg",
        mine ? "border-white/20 bg-[#24113e] text-white" : "border-border bg-card text-foreground",
      )}
    >
      <div className="relative aspect-[4/5] bg-black">
        {playing && videoUrl ? (
          <video
            src={videoUrl}
            poster={thumbnailUrl ?? undefined}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <button
            className="relative h-full w-full"
            onClick={(event) => {
              event.stopPropagation();
              setPlaying(true);
            }}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video
                src={videoUrl ?? undefined}
                preload="metadata"
                muted
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/20">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-black shadow-xl">
                <Play className="ml-1 h-6 w-6 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <StoredImage
            path={video.data.profile?.avatar_url ?? null}
            alt=""
            className="h-7 w-7 rounded-full"
            fallback="?"
          />
          <p className="truncate text-xs font-black">
            @{video.data.profile?.username ?? t("someone")}
          </p>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold">
          {video.data.caption || t("videoFeed")}
        </p>
        <Link
          to="/discover"
          search={{ v: videoId }}
          onClick={(event) => event.stopPropagation()}
          className="mt-2 inline-flex text-xs font-bold text-primary"
        >
          {t("discover")} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function LightboxImage({ path }: { path: string | null }) {
  const url = useSignedUrl(path);
  return url ? (
    <img
      src={url}
      alt=""
      className="max-h-full max-w-full rounded-2xl object-contain"
      onClick={(e) => e.stopPropagation()}
    />
  ) : null;
}

/** Real play/pause with a decorative (non-analyzed) waveform, per the voice-message spec. */
function VoicePlayer({ path, light = false }: { path: string | null; light?: boolean }) {
  const url = useSignedUrl(path);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const bars = [6, 10, 14, 9, 16, 11, 7, 13, 8, 15, 10, 6];

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
  }

  return (
    <div className="flex min-w-[170px] items-center gap-2">
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) =>
            setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))
          }
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          hidden
        />
      ) : null}
      <button
        onClick={toggle}
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90",
          light
            ? "bg-white/25 text-white"
            : "bg-[#E5E5E5] text-[#050505] dark:bg-white/15 dark:text-white",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>
      <div className="flex flex-1 items-center gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full transition-opacity",
              light ? "bg-white/85" : "bg-[#050505] dark:bg-white",
            )}
            style={{
              height: h,
              opacity: progress * bars.length > i ? 1 : light ? 0.45 : 0.35,
            }}
          />
        ))}
      </div>
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          light ? "text-white/90" : "text-[#050505] dark:text-white",
        )}
      >
        {formatDuration(duration)}
      </span>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
