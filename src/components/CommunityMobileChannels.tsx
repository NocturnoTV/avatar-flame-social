import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Hash,
  Home,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Reply,
  Search,
  Send,
  Square,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { Button, Input } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { uploadFile } from "@/lib/media";
import { errorMessage, cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type CommunityRow = Database["public"]["Tables"]["communities"]["Row"];

const HOME_ID = "__home__";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

type ChannelRow = {
  id: string;
  category_id: string | null;
  name: string;
  position: number;
  is_default: boolean;
  kind: string;
};

type MessageRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  kind: string;
  media_url: string | null;
  duration_ms: number | null;
  reply_to_id: string | null;
  author?: { username: string | null; avatar_url: string | null } | undefined;
};

/**
 * Full mobile takeover for a community's channels, à la Discord mobile: the
 * channel list lives in a hidden drawer (opened via the top-left button or a
 * left-to-right swipe anywhere on screen) instead of a permanent sidebar, and
 * the active channel fills the whole viewport. Desktop keeps using the plain
 * two-column ChannelsTab layout - this component takes over only below the
 * lg breakpoint, matching how the rest of this app splits mobile/desktop nav.
 */
export function CommunityMobileChannels({
  communityId,
  community,
  isMember,
  canManageChannels,
  onOpenHome,
  onOpenSettings,
}: {
  communityId: string | undefined;
  community: CommunityRow;
  isMember: boolean;
  canManageChannels: boolean;
  onOpenHome: () => void;
  onOpenSettings: () => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string>(HOME_ID);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [gifDraft, setGifDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"text" | "voice">("text");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const categories = useQuery({
    queryKey: ["community-categories", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_channel_categories")
        .select("id,name,position")
        .eq("community_id", communityId!)
        .order("position");
      return data ?? [];
    },
  });

  const channels = useQuery({
    queryKey: ["community-channels", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_channels")
        .select("id,category_id,name,position,is_default,kind")
        .eq("community_id", communityId!)
        .order("position");
      return (data ?? []) as ChannelRow[];
    },
  });

  const isHome = activeChannelId === HOME_ID;
  const activeChannel = (channels.data ?? []).find((c) => c.id === activeChannelId);
  const isVoiceChannel = activeChannel?.kind === "voice";

  // Land straight on a real channel like Discord mobile does, instead of an
  // empty "Accueil" screen - only once, the first time channels load.
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (defaultedRef.current || !channels.data) return;
    defaultedRef.current = true;
    const firstReal = channels.data.find((c) => !c.is_default);
    if (firstReal) setActiveChannelId(firstReal.id);
    else setDrawerOpen(true);
  }, [channels.data]);

  const messages = useQuery({
    queryKey: ["community-channel-messages", activeChannelId],
    enabled: !isHome && !isVoiceChannel,
    refetchInterval: 8000,
    queryFn: async (): Promise<MessageRow[]> => {
      const { data: rows } = await supabase
        .from("community_channel_messages")
        .select("id,user_id,content,created_at,kind,media_url,duration_ms,reply_to_id")
        .eq("channel_id", activeChannelId)
        .order("created_at")
        .limit(200);
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  const reactions = useQuery({
    queryKey: ["community-channel-reactions", activeChannelId, (messages.data ?? []).length],
    enabled: !isHome && !isVoiceChannel && (messages.data?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = (messages.data ?? []).map((m) => m.id);
      const { data } = await supabase
        .from("community_channel_message_reactions")
        .select("message_id,user_id,emoji")
        .in("message_id", ids);
      return data ?? [];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data?.length, activeChannelId]);

  function reactionsFor(messageId: string) {
    const rows = (reactions.data ?? []).filter((r) => r.message_id === messageId);
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const r of rows) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.user_id === user?.id) cur.mine = true;
      byEmoji.set(r.emoji, cur);
    }
    return [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v }));
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return;
    const mine = reactionsFor(messageId).find((r) => r.emoji === emoji)?.mine;
    if (mine) {
      await supabase
        .from("community_channel_message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      await supabase
        .from("community_channel_message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
    }
    void reactions.refetch();
  }

  function openChannel(id: string) {
    setActiveChannelId(id);
    setDrawerOpen(false);
    setReplyTo(null);
  }

  async function send(
    kind: "text" | "gif" | "voice" = "text",
    mediaUrl?: string,
    durationMs?: number,
  ) {
    if (!user || isHome || !communityId) return;
    const content = kind === "text" ? text.trim() : "";
    if (kind === "text" && !content) return;
    const { data: inserted, error } = await supabase
      .from("community_channel_messages")
      .insert({
        channel_id: activeChannelId,
        community_id: communityId,
        user_id: user.id,
        content,
        kind,
        media_url: mediaUrl ?? null,
        duration_ms: durationMs ?? null,
        reply_to_id: replyTo?.id ?? null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    if (inserted) {
      void supabase.rpc("bump_quest_progress", {
        _metric_key: "community",
        _entity_id: inserted.id,
      });
    }
    setText("");
    setReplyTo(null);
    setAttachOpen(false);
    setGifDraft("");
    void messages.refetch();
  }

  async function sendGif() {
    if (!gifDraft.trim()) return;
    await send("gif", gifDraft.trim());
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
      const startedAt = Date.now();
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!user) return;
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        const path = await uploadFile("voice-messages", user.id, file, "webm");
        await send("voice", path, Date.now() - startedAt);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Micro refusé - autorise l'accès au micro pour envoyer un vocal.");
    }
  }

  async function createChannel() {
    if (!communityId || !newChannelName.trim()) return;
    const { error } = await supabase.rpc("community_create_channel", {
      _community: communityId,
      _category: null as unknown as string,
      _name: newChannelName.trim(),
      _kind: newChannelKind,
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setNewChannelName("");
    setNewChannelOpen(false);
    void channels.refetch();
    void qc.invalidateQueries({ queryKey: ["community-channels", communityId] });
  }

  function toggleCategory(id: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Swipe-to-open/close: mostly-horizontal drag past a threshold toggles the
  // drawer, rather than tracking the finger 1:1 - simpler and doesn't fight
  // with vertical message-list scrolling.
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 60) return;
    if (dx > 0 && !drawerOpen) setDrawerOpen(true);
    if (dx < 0 && drawerOpen) setDrawerOpen(false);
  }

  const visibleChannels = (channels.data ?? []).filter((c) => !c.is_default);
  const uncategorized = visibleChannels.filter((c) => !c.category_id);
  const byCategory = (categories.data ?? []).map((cat) => ({
    ...cat,
    channels: visibleChannels.filter((c) => c.category_id === cat.id),
  }));

  const messageById = new Map((messages.data ?? []).map((m) => [m.id, m]));

  const channelRowClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-semibold transition",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
    );

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-hidden bg-background lg:hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Channel list drawer */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 z-10 w-[78%] max-w-xs shrink-0 overflow-y-auto bg-[#0f0f13] text-white shadow-2xl transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <StoredImage
            path={community.icon_url}
            alt={community.name}
            className="h-11 w-11 shrink-0 rounded-2xl object-cover"
            fallback="🎮"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black">{community.name}</p>
            <p className="flex items-center gap-1 text-xs text-white/50">
              <Users className="h-3 w-3" /> {community.member_count.toLocaleString()} membres
            </p>
          </div>
          <button
            onClick={onOpenSettings}
            aria-label="Paramètres"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-3">
          <button
            onClick={() => {
              setActiveChannelId(HOME_ID);
              setDrawerOpen(false);
              onOpenHome();
            }}
            className={channelRowClass(isHome)}
          >
            <Home className="h-4 w-4 shrink-0" />
            Accueil
          </button>

          {uncategorized.length ? (
            <div className="space-y-0.5">
              {uncategorized.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => openChannel(ch.id)}
                  className={channelRowClass(activeChannelId === ch.id)}
                >
                  {ch.kind === "voice" ? (
                    <Volume2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <Hash className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          {byCategory.map((cat) => {
            const isCollapsed = collapsed.has(cat.id);
            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white/40"
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  {cat.name}
                </button>
                {!isCollapsed ? (
                  <div className="mt-1 space-y-0.5">
                    {cat.channels.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => openChannel(ch.id)}
                        className={channelRowClass(activeChannelId === ch.id)}
                      >
                        {ch.kind === "voice" ? (
                          <Volume2 className="h-4 w-4 shrink-0" />
                        ) : (
                          <Hash className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{ch.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {canManageChannels ? (
            newChannelOpen ? (
              <div className="space-y-1.5 rounded-xl bg-white/5 p-2">
                <Input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="nom-du-salon"
                  className="h-8 border-white/10 bg-white/10 text-xs text-white placeholder:text-white/40"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setNewChannelKind("text")}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[11px] font-bold",
                      newChannelKind === "text"
                        ? "bg-primary text-white"
                        : "bg-white/10 text-white/60",
                    )}
                  >
                    # Texte
                  </button>
                  <button
                    onClick={() => setNewChannelKind("voice")}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[11px] font-bold",
                      newChannelKind === "voice"
                        ? "bg-primary text-white"
                        : "bg-white/10 text-white/60",
                    )}
                  >
                    🔊 Vocal
                  </button>
                </div>
                <Button size="sm" className="w-full" onClick={() => void createChannel()}>
                  Créer
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setNewChannelOpen(true)}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-white/50 hover:bg-white/5 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Nouveau salon
              </button>
            )
          ) : null}
        </div>
      </div>

      {drawerOpen ? (
        <button
          aria-label="Fermer"
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 z-[5] bg-black/50"
        />
      ) : null}

      {/* Active channel, fullscreen */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Salons"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 font-black">
            {isHome ? (
              <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : activeChannel?.kind === "voice" ? (
              <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{isHome ? "Accueil" : (activeChannel?.name ?? "…")}</span>
          </div>
          <button
            aria-label="Rechercher"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <Search className="h-4 w-4" />
          </button>
        </header>

        {isHome ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <StoredImage
                path={community.icon_url}
                alt=""
                className="h-16 w-16 rounded-2xl object-cover"
                fallback="🎮"
              />
              <p className="text-sm">
                Fais glisser depuis le bord gauche ou touche{" "}
                <ArrowLeft className="inline h-3.5 w-3.5" /> pour voir les salons.
              </p>
            </div>
          </div>
        ) : isVoiceChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
              <Volume2 className="h-7 w-7" />
            </span>
            <p className="font-black">{activeChannel?.name}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Le vocal en direct arrive bientôt sur BloxSpark - ce salon est prêt, mais on ne peut
              pas encore s'y connecter en audio.
            </p>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {(messages.data ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun message dans ce salon pour l'instant.
                </p>
              ) : (
                (messages.data ?? []).map((m) => {
                  const repliedTo = m.reply_to_id ? messageById.get(m.reply_to_id) : null;
                  const rx = reactionsFor(m.id);
                  return (
                    <div key={m.id} className="flex items-start gap-2.5">
                      <Link to="/users/$id" params={{ id: m.user_id }} className="shrink-0">
                        <StoredImage
                          path={m.author?.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
                          fallback="🎮"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        {repliedTo ? (
                          <p className="mb-0.5 flex items-center gap-1 truncate pl-1 text-[11px] text-muted-foreground">
                            <Reply className="h-3 w-3 shrink-0 -scale-x-100" />@
                            {repliedTo.author?.username ?? "?"} : {repliedTo.content.slice(0, 40)}
                          </p>
                        ) : null}
                        <div className="rounded-2xl rounded-tl-sm bg-surface-2 px-3 py-2">
                          <p className="flex items-baseline gap-1.5">
                            <Link
                              to="/users/$id"
                              params={{ id: m.user_id }}
                              className="text-xs font-black hover:underline"
                            >
                              {m.author?.username ?? "?"}
                            </Link>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </p>
                          {m.kind === "gif" && m.media_url ? (
                            <img
                              src={m.media_url}
                              alt=""
                              className="mt-1 max-h-52 rounded-xl object-contain"
                            />
                          ) : m.kind === "voice" ? (
                            <CommunityVoiceBubble path={m.media_url} />
                          ) : (
                            <p className="text-sm leading-snug">{m.content}</p>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 pl-1">
                          {rx.map((r) => (
                            <button
                              key={r.emoji}
                              onClick={() => void toggleReaction(m.id, r.emoji)}
                              className={cn(
                                "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                                r.mine
                                  ? "bg-primary/15 text-primary"
                                  : "bg-surface-2 text-muted-foreground",
                              )}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                          <button
                            onClick={() => setReplyTo(m)}
                            className="text-[11px] font-bold text-muted-foreground hover:text-primary"
                          >
                            Répondre
                          </button>
                          <div className="flex gap-0.5">
                            {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => void toggleReaction(m.id, emoji)}
                                className="rounded-full px-1 text-xs opacity-60 hover:opacity-100"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {isMember ? (
              <div className="shrink-0 border-t border-border bg-background p-2.5">
                {replyTo ? (
                  <div className="mb-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-1.5 text-xs">
                    <span className="truncate text-muted-foreground">
                      Réponse à <b>{replyTo.author?.username ?? "?"}</b> :{" "}
                      {replyTo.content.slice(0, 50)}
                    </span>
                    <button onClick={() => setReplyTo(null)} aria-label="Annuler">
                      <X className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </div>
                ) : null}
                {attachOpen ? (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5">
                    <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      value={gifDraft}
                      onChange={(e) => setGifDraft(e.target.value)}
                      placeholder="Coller un lien de GIF…"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                    <button
                      onClick={() => void sendGif()}
                      disabled={!gifDraft.trim()}
                      className="shrink-0 text-xs font-bold text-primary disabled:opacity-40"
                    >
                      Envoyer
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAttachOpen((v) => !v)}
                    aria-label="Ajouter"
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full transition",
                      attachOpen
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-surface-2",
                    )}
                  >
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void send("text");
                    }}
                    placeholder="Écrire un message..."
                    className="min-w-0 flex-1 rounded-full bg-surface px-3.5 py-2 text-sm outline-none ring-1 ring-transparent transition focus:ring-primary/25"
                  />
                  <button
                    onClick={() => void toggleRecording()}
                    aria-label={recording ? "Arrêter" : "Message vocal"}
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full transition",
                      recording
                        ? "animate-pulse bg-destructive text-white"
                        : "text-muted-foreground hover:bg-surface-2",
                    )}
                  >
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => void send("text")}
                    disabled={!text.trim()}
                    aria-label="Envoyer"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full spark-gradient text-white transition active:scale-90 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function CommunityVoiceBubble({ path }: { path: string | null }) {
  const url = useSignedUrl(path);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  if (!url) return <span className="text-xs text-muted-foreground">…</span>;
  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Lire"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Mic className="h-3 w-3" /> Message vocal
      </span>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
