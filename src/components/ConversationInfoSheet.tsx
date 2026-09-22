import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  BellOff,
  Camera,
  ChevronRight,
  Contact,
  Crown,
  Flag,
  Gift,
  Images,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Paintbrush,
  Pencil,
  Pin,
  Play,
  Search,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { RobloxIdentity } from "@/components/RobloxIdentity";
import { GiftSheet } from "@/components/GiftSheet";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn, errorMessage } from "@/lib/utils";
import { isSparkPlusActive } from "@/lib/sparkPlus";
import { extinguishDeadline, hoursUntil, restoreDeadline, streakStatus } from "@/lib/streaks";
import { useTheme } from "@/lib/theme";
import { BUBBLE_THEMES, getBubbleTheme, getWallpaper, setBubbleTheme } from "@/lib/chatTheme";
import { WallpaperPickerSheet } from "@/components/WallpaperPicker";

type MediaItem = {
  id: string;
  type: "image" | "video";
  thumbPath: string;
  playPath: string;
  created_at: string;
};

/** Matches the marker a shared Discover video is stored as in a "text"
 * message's content - either the raw `video:<uuid>` marker, or a
 * /discover?v=<uuid> link. Duplicated from messages.$id.tsx's own
 * (unexported) helper of the same name/behaviour. */
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

/**
 * The conversation "..." menu: quick actions (view profile / search / create
 * group) plus a settings list (mute, pin, report/block). All of it is wired
 * to real columns (conversation_participants.muted/pinned, public.reports,
 * public.blocks) rather than being decorative.
 */
export function ConversationInfoSheet({
  conversationId,
  otherId,
  title,
  avatarUrl,
  pinned,
  muted,
  streakCount,
  streakDate,
  streakBrokenAt,
  onClose,
  onChanged,
}: {
  conversationId: string;
  otherId: string | null;
  title: string;
  avatarUrl: string | null;
  pinned: boolean;
  muted: boolean;
  streakCount?: number;
  streakDate?: string | null;
  streakBrokenAt?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; content: string | null }[]>([]);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickingWallpaper, setPickingWallpaper] = useState(false);
  const [pickingBubble, setPickingBubble] = useState(false);
  const [wallpaper, setWallpaperState] = useState(() => getWallpaper(conversationId));
  const [bubble, setBubbleState] = useState(() => getBubbleTheme(conversationId));
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [gifting, setGifting] = useState(false);
  const [mediaLightbox, setMediaLightbox] = useState<MediaItem | null>(null);
  const isGroup = !otherId;
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [transferringTo, setTransferringTo] = useState<string | null>(null);
  const groupAvatarInput = useRef<HTMLInputElement>(null);

  const groupInfo = useQuery({
    queryKey: ["group-info", conversationId],
    enabled: isGroup,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("owner_id,avatar_url,name")
        .eq("id", conversationId)
        .maybeSingle();
      return data;
    },
  });
  const isOwner = isGroup && groupInfo.data?.owner_id === user?.id;

  const members = useQuery({
    queryKey: ["group-members", conversationId],
    enabled: isGroup,
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id,joined_at")
        .eq("conversation_id", conversationId)
        .order("joined_at");
      const ids = (parts ?? []).map((p) => p.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return ids.map((id) => byId.get(id)).filter(Boolean) as {
        id: string;
        username: string | null;
        avatar_url: string | null;
      }[];
    },
  });

  // Sent photos + videos shared from Discover, newest first - photos are
  // their own "image" messages, shared videos are "text" messages whose
  // content is the sharedVideoId() marker, so the actual thumbnail/playback
  // path lives on the referenced videos row instead of the message itself.
  const media = useQuery({
    queryKey: ["conversation-media", conversationId],
    queryFn: async (): Promise<MediaItem[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,kind,content,media_url,created_at")
        .eq("conversation_id", conversationId)
        .in("kind", ["image", "text"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data ?? [];
      const images: MediaItem[] = rows
        .filter((m) => m.kind === "image" && m.media_url)
        .map((m) => ({
          id: m.id,
          type: "image",
          thumbPath: m.media_url as string,
          playPath: m.media_url as string,
          created_at: m.created_at,
        }));
      const videoRefs = rows
        .map((m) =>
          m.kind === "text"
            ? { id: m.id, videoId: sharedVideoId(m.content), created_at: m.created_at }
            : null,
        )
        .filter((r): r is { id: string; videoId: string; created_at: string } => !!r?.videoId);
      let videoItems: MediaItem[] = [];
      if (videoRefs.length) {
        const { data: videos } = await supabase
          .from("videos")
          .select("id,storage_path,thumbnail_path")
          .in("id", [...new Set(videoRefs.map((r) => r.videoId))]);
        const byId = new Map((videos ?? []).map((v) => [v.id, v]));
        videoItems = videoRefs
          .map((ref): MediaItem | null => {
            const v = byId.get(ref.videoId);
            if (!v) return null;
            return {
              id: ref.id,
              type: "video",
              thumbPath: v.thumbnail_path ?? v.storage_path,
              playPath: v.storage_path,
              created_at: ref.created_at,
            };
          })
          .filter((x): x is MediaItem => x !== null);
      }
      return [...images, ...videoItems]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 30);
    },
  });

  async function saveGroupName() {
    const value = groupNameDraft.trim();
    if (!value || savingGroupName) return;
    setSavingGroupName(true);
    const { error } = await supabase.rpc("rename_group", {
      _conversation: conversationId,
      _name: value,
    });
    setSavingGroupName(false);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    setEditingGroupName(false);
    await groupInfo.refetch();
    onChanged();
  }

  async function uploadGroupAvatar(file: File) {
    if (!user || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const path = await uploadFile(
        "profile-photos",
        user.id,
        file,
        file.name.split(".").pop() || "jpg",
      );
      const { error } = await supabase.rpc("set_group_avatar", {
        _conversation: conversationId,
        _avatar_url: path,
      });
      if (error) throw error;
      await groupInfo.refetch();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function transferOwnership(memberId: string) {
    if (transferringTo) return;
    setTransferringTo(memberId);
    const { error } = await supabase.rpc("set_group_owner", {
      _conversation: conversationId,
      _new_owner: memberId,
    });
    setTransferringTo(null);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    toast.success(t("saved"));
    await groupInfo.refetch();
    onChanged();
  }

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

  const contact = useQuery({
    queryKey: ["contact-info", otherId, user?.id],
    enabled: !!otherId && !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: nick }] = await Promise.all([
        supabase
          .from("profiles")
          .select("roblox_user_id,roblox_username,roblox_display_name,roblox_avatar_url")
          .eq("id", otherId!)
          .maybeSingle(),
        supabase
          .from("contact_nicknames")
          .select("nickname")
          .eq("owner_id", user!.id)
          .eq("contact_id", otherId!)
          .maybeSingle(),
      ]);
      return { profile, nickname: nick?.nickname ?? null };
    },
  });

  async function saveNickname() {
    if (!user || !otherId) return;
    const value = nicknameDraft.trim();
    if (value) {
      await supabase
        .from("contact_nicknames")
        .upsert({ owner_id: user.id, contact_id: otherId, nickname: value });
    } else {
      await supabase
        .from("contact_nicknames")
        .delete()
        .eq("owner_id", user.id)
        .eq("contact_id", otherId);
    }
    setEditingNickname(false);
    void contact.refetch();
    onChanged();
  }

  async function toggle(field: "muted" | "pinned", value: boolean) {
    if (!user) return;
    setBusy(true);
    const patch = field === "muted" ? { muted: value } : { pinned: value };
    await supabase
      .from("conversation_participants")
      .update(patch)
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    setBusy(false);
    onChanged();
  }

  async function runSearch() {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("messages")
      .select("id,content")
      .eq("conversation_id", conversationId)
      .ilike("content", `%${query.trim()}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    setResults(data ?? []);
  }

  async function block() {
    if (!user || !otherId) return;
    await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: otherId });
    toast.success(t("blocked"));
    onClose();
    await navigate({ to: "/messages" });
  }

  async function leaveGroup() {
    if (!user) return;
    await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    toast.success(t("leftGroup"));
    onClose();
    await navigate({ to: "/messages" });
  }

  async function report(reason: string) {
    if (!user || !otherId) return;
    await supabase
      .from("reports")
      .insert({ reporter_id: user.id, target_user_id: otherId, reason });
    toast.success(t("saved"));
    setReporting(false);
  }

  const streakInfo = { count: streakCount ?? 0, date: streakDate ?? null, brokenAt: streakBrokenAt ?? null };
  const streakStatusNow = streakStatus(streakInfo);
  const streakStatusLabel =
    streakStatusNow === "broken" && streakBrokenAt
      ? t("streakBrokenRestorable", { hours: hoursUntil(restoreDeadline(streakBrokenAt)) })
      : streakStatusNow === "none" && streakBrokenAt
        ? t("streakGoneForGood")
        : (() => {
            const deadline = extinguishDeadline(streakInfo);
            return deadline ? t("streakExtinguishesIn", { hours: hoursUntil(deadline) }) : "";
          })();

  // Portaled straight to <body> - some Android WebViews mis-render a
  // "fixed" element nested deep in a tall/scrollable ancestor, showing it
  // mid-page or at the very bottom instead of pinned to the screen.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 text-[#050505] dark:bg-black dark:text-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} aria-label={t("cancel")}>
            <X className="h-5 w-5 text-[#929292]" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          {otherId ? (
            <StoredImage
              path={avatarUrl}
              alt={title}
              className="h-20 w-20 rounded-full object-cover"
              fallback={title[0]?.toUpperCase() ?? "?"}
            />
          ) : (
            <div className="relative">
              {groupInfo.data?.avatar_url ? (
                <StoredImage
                  path={groupInfo.data.avatar_url}
                  alt={title}
                  className="h-20 w-20 rounded-full object-cover"
                  fallback="👥"
                />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-[#F5F5F5] text-3xl dark:bg-[#1c1c1e]">
                  👥
                </div>
              )}
              {isOwner ? (
                <>
                  <input
                    ref={groupAvatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadGroupAvatar(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => groupAvatarInput.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label={t("editGroupPhoto")}
                    className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
                  >
                    {uploadingAvatar ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                </>
              ) : null}
            </div>
          )}

          {isGroup ? (
            editingGroupName ? (
              <div className="mt-2 flex w-full items-center gap-2 px-2">
                <input
                  autoFocus
                  value={groupNameDraft}
                  onChange={(e) => setGroupNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void saveGroupName()}
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-full bg-[#F5F5F5] px-3 py-1.5 text-center text-sm text-[#050505] outline-none dark:bg-[#1c1c1e] dark:text-white"
                />
                <button
                  onClick={() => void saveGroupName()}
                  disabled={savingGroupName}
                  className="text-sm font-bold text-primary"
                >
                  {t("save")}
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5">
                <p className="text-lg font-bold">{groupInfo.data?.name || title}</p>
                {isOwner ? (
                  <button
                    onClick={() => {
                      setGroupNameDraft(groupInfo.data?.name || title);
                      setEditingGroupName(true);
                    }}
                    aria-label={t("editGroupName")}
                    className="text-[#929292] hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            )
          ) : (
            <p className="mt-2 text-lg font-bold">{contact.data?.nickname || title}</p>
          )}
          {contact.data?.nickname ? <p className="text-xs text-[#929292]">@{title}</p> : null}
          {!isGroup && streakCount ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[#929292]">
              <span>
                🔥 {streakCount}
              </span>
              {streakStatusLabel}
            </p>
          ) : null}
          {isGroup ? (
            <p className="mt-0.5 text-xs text-[#929292]">
              {t("groupMemberCount", { count: members.data?.length ?? 0 })}
            </p>
          ) : null}

          {otherId ? (
            editingNickname ? (
              <div className="mt-2 flex w-full items-center gap-2 px-2">
                <input
                  autoFocus
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void saveNickname()}
                  placeholder={t("addNickname")}
                  className="min-w-0 flex-1 rounded-full bg-[#F5F5F5] px-3 py-1.5 text-sm text-[#050505] outline-none dark:bg-[#1c1c1e] dark:text-white"
                />
                <button
                  onClick={() => void saveNickname()}
                  className="text-sm font-bold text-primary"
                >
                  {t("save")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNicknameDraft(contact.data?.nickname ?? "");
                  setEditingNickname(true);
                }}
                className="mt-1 text-xs font-semibold text-primary"
              >
                {contact.data?.nickname ? t("editNickname") : t("addNickname")}
              </button>
            )
          ) : null}

          {contact.data?.profile?.roblox_user_id ? (
            <div className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#F5F5F5] p-3 text-left dark:bg-[#1c1c1e]">
              <img
                src={contact.data.profile.roblox_avatar_url ?? undefined}
                alt=""
                className="h-11 w-11 rounded-full bg-white object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs font-bold text-[#929292]">
                  <Contact className="h-3 w-3" /> {t("linkedRobloxAccount")}
                </p>
                <RobloxIdentity
                  displayName={contact.data.profile.roblox_display_name}
                  username={contact.data.profile.roblox_username}
                  className="text-sm font-semibold text-[#050505] dark:text-white"
                />
                <p className="truncate text-[11px] text-[#929292]">
                  ID: {contact.data.profile.roblox_user_id}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {otherId ? (
          <>
            <div className="mt-5 grid grid-cols-4 gap-2 text-center">
              <QuickAction
                icon={UserPlus}
                label={t("newGroup")}
                onClick={() => {
                  onClose();
                  void navigate({ to: "/messages" });
                }}
              />
              <Link to="/users/$id" params={{ id: otherId }} onClick={onClose}>
                <QuickAction icon={UserRound} label={t("viewProfile")} onClick={() => {}} />
              </Link>
              <QuickAction icon={Gift} label={t("gift")} onClick={() => setGifting(true)} />
              <QuickAction
                icon={Search}
                label={t("search")}
                onClick={() => setSearching((v) => !v)}
              />
            </div>

            {searching ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-3 py-2 dark:bg-[#1c1c1e]">
                  <Search className="h-4 w-4 text-[#929292]" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                    placeholder={t("search")}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#050505] outline-none dark:text-white"
                  />
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {results.map((r) => (
                    <p
                      key={r.id}
                      className="truncate rounded-xl bg-[#F5F5F5] px-3 py-2 text-sm dark:bg-[#1c1c1e]"
                    >
                      {r.content}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#929292]">
              <Users className="h-3.5 w-3.5" /> {t("groupMembers")}
            </p>
            <div className="mt-2 max-h-60 space-y-0.5 overflow-y-auto">
              {(members.data ?? []).map((member) => {
                const isMemberOwner = member.id === groupInfo.data?.owner_id;
                const name = member.username ?? t("someone");
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                    <Link
                      to="/users/$id"
                      params={{ id: member.id }}
                      onClick={onClose}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <StoredImage
                        path={member.avatar_url}
                        alt={name}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        fallback={name[0]?.toUpperCase() ?? "?"}
                      />
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                        @{name}
                        {member.id === user?.id ? ` (${t("you")})` : ""}
                      </span>
                    </Link>
                    {isMemberOwner ? (
                      <span
                        className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary"
                        aria-label={t("groupOwner")}
                      >
                        <Crown className="h-3 w-3" /> {t("groupOwner")}
                      </span>
                    ) : isOwner ? (
                      <button
                        onClick={() => void transferOwnership(member.id)}
                        disabled={transferringTo === member.id}
                        className="shrink-0 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"
                      >
                        {t("makeOwner")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 space-y-1 border-t border-black/5 pt-3 dark:border-white/10">
          <Row
            icon={MessageSquare}
            label={t("chatBubble")}
            onClick={() => (hasPlus ? setPickingBubble((v) => !v) : navigate({ to: "/shop" }))}
            right={
              hasPlus ? (
                <span
                  className="h-6 w-6 shrink-0 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${bubble.from}, ${bubble.to})` }}
                />
              ) : (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Plus
                </span>
              )
            }
            chevron
          />
          {pickingBubble && hasPlus ? (
            <div className="flex flex-wrap gap-3 rounded-2xl bg-[#F5F5F5] p-3 dark:bg-[#1c1c1e]">
              {BUBBLE_THEMES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBubbleTheme(conversationId, b.id);
                    setBubbleState(b);
                    onChanged();
                  }}
                  aria-label={b.label}
                  className={cn(
                    "h-9 w-9 rounded-full ring-offset-2",
                    bubble.id === b.id && "ring-2 ring-[#050505] dark:ring-white",
                  )}
                  style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})` }}
                />
              ))}
            </div>
          ) : null}

          <Row
            icon={Paintbrush}
            label={t("chatWallpaper")}
            onClick={() => setPickingWallpaper(true)}
            right={
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-black/10 bg-cover bg-center dark:border-white/20"
                style={{
                  background: wallpaper.image ? `url(${wallpaper.image})` : wallpaper.css,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            }
            chevron
          />
          <WallpaperPickerSheet
            open={pickingWallpaper}
            onClose={() => setPickingWallpaper(false)}
            conversationId={conversationId}
            hasPlus={hasPlus}
            appTheme={theme}
            current={wallpaper}
            onSaved={(w) => {
              setWallpaperState(w);
              onChanged();
            }}
          />

          <Row
            icon={BellOff}
            label={t("muteMessages")}
            right={
              <Toggle checked={muted} onChange={(v) => void toggle("muted", v)} disabled={busy} />
            }
          />
          <Row
            icon={Pin}
            label={t("pinConversation")}
            right={
              <Toggle checked={pinned} onChange={(v) => void toggle("pinned", v)} disabled={busy} />
            }
          />
          {otherId ? (
            <>
              <Row icon={Ban} label={t("block")} onClick={() => void block()} chevron />
              <Row icon={Flag} label={t("report")} onClick={() => setReporting(true)} chevron />
            </>
          ) : (
            <Row icon={LogOut} label={t("leaveGroup")} onClick={() => void leaveGroup()} chevron />
          )}
        </div>

        {reporting ? (
          <div className="mt-3 space-y-2 rounded-2xl bg-[#F5F5F5] p-3 dark:bg-[#1c1c1e]">
            <p className="text-xs font-semibold text-[#929292]">{t("reportReason")}</p>
            {[
              { id: "harassment", label: t("reportHarassment") },
              { id: "spam", label: t("reportSpam") },
              { id: "inappropriate_content", label: t("reportInappropriate") },
              { id: "impersonation", label: t("reportImpersonation") },
            ].map((reason) => (
              <button
                key={reason.id}
                onClick={() => void report(reason.id)}
                className="block w-full rounded-xl bg-white px-3 py-2 text-left text-sm text-[#050505] hover:bg-black/5 dark:bg-black dark:text-white dark:hover:bg-white/10"
              >
                {reason.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 border-t border-[#eee] pt-4 dark:border-white/10">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#929292]">
            <Images className="h-3.5 w-3.5" /> {t("sharedMediaTitle")}
          </p>
          {media.isLoading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          ) : media.data?.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {media.data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMediaLightbox(item)}
                  className="relative aspect-square overflow-hidden rounded-xl bg-surface"
                >
                  <StoredImage
                    path={item.thumbPath}
                    alt=""
                    className="h-full w-full object-cover"
                    fallback="🎬"
                  />
                  {item.type === "video" ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/20">
                      <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-[#929292]">{t("noSharedMedia")}</p>
          )}
        </div>
      </div>

      {mediaLightbox ? (
        <div onClick={(e) => e.stopPropagation()}>
          <MediaLightbox item={mediaLightbox} onClose={() => setMediaLightbox(null)} />
        </div>
      ) : null}

      {gifting && otherId ? (
        // GiftSheet renders its own fixed-position Sheet as a sibling of the
        // menu's content div above, outside its stopPropagation wrapper - a
        // click inside it (the note field, an amount pill, a tab) would
        // otherwise bubble all the way up to this component's own backdrop
        // onClick={onClose} and close the whole "..." menu underneath it.
        <div onClick={(e) => e.stopPropagation()}>
          <GiftSheet
            targetUserId={otherId}
            targetUsername={contact.data?.nickname || title}
            conversationId={conversationId}
            onClose={() => setGifting(false)}
          />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#F5F5F5] text-[#050505] dark:bg-[#1c1c1e] dark:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="truncate text-xs font-medium text-[#050505] dark:text-white">{label}</span>
    </button>
  );
}

function Row({
  icon: Icon,
  label,
  onClick,
  right,
  chevron,
}: {
  icon: typeof Pin;
  label: string;
  onClick?: () => void;
  right?: React.ReactNode;
  chevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick && !right}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
    >
      <Icon className="h-5 w-5 text-[#050505] dark:text-white" />
      <span className="flex-1 font-semibold text-[#050505] dark:text-white">{label}</span>
      {right}
      {chevron ? <ChevronRight className="h-4 w-4 text-[#929292]" /> : null}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative h-6 w-11 rounded-full transition",
        checked ? "bg-[#20D778]" : "bg-[#D9D9D9]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Full-screen viewer for one item from the "Médias & vidéos" grid above -
 * a photo, or a video shared from Discover (played back from its original
 * storage path, not re-uploaded into the conversation). */
function MediaLightbox({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const url = useSignedUrl(item.playPath);
  return createPortal(
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/95 p-4" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="close"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white"
      >
        <X className="h-5 w-5" />
      </button>
      {url ? (
        item.type === "video" ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            src={url}
            alt=""
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        )
      ) : (
        <LoaderCircle className="h-8 w-8 animate-spin text-white/60" />
      )}
    </div>,
    document.body,
  );
}
