import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Copy,
  Flag,
  Forward,
  ImagePlus,
  Mic,
  MoreVertical,
  Pause,
  Phone,
  Play,
  Reply,
  Send,
  Smile,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui-kit";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { PresenceDot, presenceStatus } from "@/components/PresenceDot";
import { ConversationInfoSheet } from "@/components/ConversationInfoSheet";
import { getBubbleTheme, getWallpaper, resolveWallpaperCss } from "@/lib/chatTheme";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
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
      { title: "Chat — Bloxspark" },
      { name: "description", content: "Private Bloxspark chat with voice messages and photos." },
      { property: "og:title", content: "Chat — Bloxspark" },
      { property: "og:description", content: "Text, photo and voice messages." },
    ],
  }),
  component: Conversation,
});

type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  kind: "text" | "image" | "voice" | "system";
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

function Conversation() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useSession();
  const { theme } = useTheme();
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
  const [wallpaper, setWallpaperLocal] = useState(() => getWallpaper(id));
  const [bubble, setBubbleLocal] = useState(() => getBubbleTheme(id));
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
        .select("id,is_group,name,request_status,created_by")
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
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, messages]);

  // "typing…" indicator — a lightweight realtime broadcast, no table needed.
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
    void supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id);
  }, [id, user, messages.data]);

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
  // the tab is focused — there is no equivalent signal on mobile web at all.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, myUsername]);

  const list = messages.data ?? [];

  return (
    <div className="app-background mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-md flex-col text-foreground lg:h-screen">
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
              <PresenceDot profile={header.data.otherPresence} className="absolute bottom-0 right-0 h-3 w-3" />
            ) : null}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight text-[#050505] dark:text-white">
            {header.data?.title}
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
        <button
          onClick={() => toast.message(t("callUnavailable"))}
          aria-label={t("call")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#050505] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          onClick={() => setInfo(true)}
          aria-label={t("more")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#050505] hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

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

                <button
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
                    mine ? (
                      <p
                        className="whitespace-pre-wrap break-words rounded-[26px] px-[30px] py-[18px] text-[15px] text-white shadow-sm"
                        style={{ background: bubbleGradient }}
                      >
                        {m.content}
                      </p>
                    ) : (
                      <ReceivedBubble>{m.content}</ReceivedBubble>
                    )
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
                </button>

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
        <div className="flex items-center gap-2 pb-3">
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

      {info && header.data ? (
        <ConversationInfoSheet
          conversationId={id}
          otherId={header.data.otherId}
          title={header.data.realUsername ?? header.data.title ?? "?"}
          avatarUrl={
            header.data.otherId
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

/** Original hand-drawn "note" bubble — thin outline, doodle face + hands at the corners. */
function ReceivedBubble({
  children,
  padded = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="relative text-[#050505] dark:text-white">
      <div className="rounded-[26px] border-2 border-current bg-background">
        {padded ? (
          <p className="whitespace-pre-wrap break-words px-[22px] py-[16px] pr-8 text-[15px]">
            {children}
          </p>
        ) : (
          children
        )}
      </div>
      <DoodleFace className="absolute -right-1.5 -top-2.5 h-6 w-9" />
      <DoodleHand className="absolute -bottom-2 -left-1.5 h-5 w-5 -scale-x-100" />
      <DoodleHand className="absolute -bottom-2 -right-1.5 h-5 w-5" />
    </div>
  );
}

function DoodleFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 26" className={className} fill="none" aria-hidden="true">
      <ellipse cx="10" cy="12" rx="3.4" ry="5" fill="currentColor" transform="rotate(-12 10 12)" />
      <ellipse cx="21" cy="10" rx="3.4" ry="5" fill="currentColor" transform="rotate(-6 21 10)" />
      <path
        d="M14 20c3-3 9-3 14-1"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function DoodleHand({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 20c0-5 1-8 2-10M8 20c0-6 .5-9 1.5-11M12 20c0-6 0-10 1-12M16 20c0-5-.5-8 .5-10c1-2 3-1.5 3 .5c0 4-1 8-3 11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
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
