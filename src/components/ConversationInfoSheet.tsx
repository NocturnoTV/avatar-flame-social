import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  BellOff,
  ChevronRight,
  Flag,
  Pin,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

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
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 text-[#050505] sm:rounded-3xl"
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
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#F5F5F5] text-3xl">👥</div>
          )}
          <p className="mt-2 text-lg font-bold">{title}</p>
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
            <div className="flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-3 py-2">
              <Search className="h-4 w-4 text-[#929292]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                placeholder={t("search")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {results.map((r) => (
                <p key={r.id} className="truncate rounded-xl bg-[#F5F5F5] px-3 py-2 text-sm">
                  {r.content}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-1 border-t border-black/5 pt-3">
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
          <div className="mt-3 space-y-2 rounded-2xl bg-[#F5F5F5] p-3">
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
                className="block w-full rounded-xl bg-white px-3 py-2 text-left text-sm hover:bg-black/5"
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
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#F5F5F5] text-[#050505]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="truncate text-xs font-medium text-[#050505]">{label}</span>
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
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left hover:bg-black/5"
    >
      <Icon className="h-5 w-5 text-[#050505]" />
      <span className="flex-1 font-semibold text-[#050505]">{label}</span>
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
