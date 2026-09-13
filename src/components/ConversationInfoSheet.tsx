import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  BellOff,
  ChevronRight,
  Contact,
  Flag,
  MessageSquare,
  Paintbrush,
  Pin,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { RobloxIdentity } from "@/components/RobloxIdentity";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { isSparkPlusActive } from "@/lib/sparkPlus";
import {
  BUBBLE_THEMES,
  WALLPAPERS,
  getBubbleTheme,
  getWallpaper,
  setBubbleTheme,
  setWallpaper,
} from "@/lib/chatTheme";

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
  onClose,
  onChanged,
}: {
  conversationId: string;
  otherId: string | null;
  title: string;
  avatarUrl: string | null;
  pinned: boolean;
  muted: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const navigate = useNavigate();
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
      await supabase.from("contact_nicknames").delete().eq("owner_id", user.id).eq("contact_id", otherId);
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

  async function report(reason: string) {
    if (!user || !otherId) return;
    await supabase.from("reports").insert({ reporter_id: user.id, target_user_id: otherId, reason });
    toast.success(t("saved"));
    setReporting(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
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
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#F5F5F5] text-3xl dark:bg-[#1c1c1e]">👥</div>
          )}
          <p className="mt-2 text-lg font-bold">{contact.data?.nickname || title}</p>
          {contact.data?.nickname ? (
            <p className="text-xs text-[#929292]">@{title}</p>
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
                <button onClick={() => void saveNickname()} className="text-sm font-bold text-primary">
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
                <p className="truncate text-[11px] text-[#929292]">ID: {contact.data.profile.roblox_user_id}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <QuickAction
            icon={UserPlus}
            label={t("newGroup")}
            onClick={() => {
              onClose();
              void navigate({ to: "/messages" });
            }}
          />
          {otherId ? (
            <Link to="/users/$id" params={{ id: otherId }} onClick={onClose}>
              <QuickAction icon={UserRound} label={t("viewProfile")} onClick={() => {}} />
            </Link>
          ) : null}
          <QuickAction icon={Search} label={t("search")} onClick={() => setSearching((v) => !v)} />
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
                <p key={r.id} className="truncate rounded-xl bg-[#F5F5F5] px-3 py-2 text-sm dark:bg-[#1c1c1e]">
                  {r.content}
                </p>
              ))}
            </div>
          </div>
        ) : null}

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
            onClick={() => (hasPlus ? setPickingWallpaper((v) => !v) : navigate({ to: "/shop" }))}
            right={
              hasPlus ? (
                <span
                  className="h-6 w-6 shrink-0 rounded-full border border-black/10 dark:border-white/20"
                  style={{ background: wallpaper.css }}
                />
              ) : (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Plus
                </span>
              )
            }
            chevron
          />
          {pickingWallpaper && hasPlus ? (
            <div className="flex flex-wrap gap-3 rounded-2xl bg-[#F5F5F5] p-3 dark:bg-[#1c1c1e]">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setWallpaper(conversationId, w.id);
                    setWallpaperState(w);
                    onChanged();
                  }}
                  aria-label={w.label}
                  className={cn(
                    "h-9 w-9 rounded-full border border-black/10 ring-offset-2 dark:border-white/20",
                    wallpaper.id === w.id && "ring-2 ring-[#050505] dark:ring-white",
                  )}
                  style={{ background: w.css }}
                />
              ))}
            </div>
          ) : null}

          <Row
            icon={BellOff}
            label={t("muteMessages")}
            right={<Toggle checked={muted} onChange={(v) => void toggle("muted", v)} disabled={busy} />}
          />
          <Row
            icon={Pin}
            label={t("pinConversation")}
            right={<Toggle checked={pinned} onChange={(v) => void toggle("pinned", v)} disabled={busy} />}
          />
          {otherId ? (
            <>
              <Row icon={Ban} label={t("block")} onClick={() => void block()} chevron />
              <Row icon={Flag} label={t("report")} onClick={() => setReporting(true)} chevron />
            </>
          ) : null}
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
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Search; label: string; onClick: () => void }) {
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
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
