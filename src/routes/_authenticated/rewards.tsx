import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarCheck, Check, Gift, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage } from "@/lib/utils";
import { BloxIcon, BloxBalanceChip, useInvalidateBloxBalance } from "@/components/Blox";
import { useConfetti } from "@/components/Confetti";
import { questDef } from "@/lib/dailyQuests";
import { formatCountdown, localDateStr, msUntilNextLocalMidnight } from "@/lib/localMidnight";
import { WatchAdRewardCard } from "@/components/WatchAdReward";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({
    meta: [
      { title: "Récompenses - Bloxspark" },
      {
        name: "description",
        content: "Défis quotidiens et Blox à gagner chaque jour sur Bloxspark.",
      },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const invalidateBalance = useInvalidateBloxBalance();
  const burst = useConfetti();
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0 });
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimedKeysRef = useRef<Set<string> | null>(null);

  const profile = useQuery({
    queryKey: ["rewards-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const tz = profile.data?.timezone ?? "UTC";
  const today = localDateStr(tz);

  const ensured = useQuery({
    queryKey: ["ensure-daily-quests", user?.id, today],
    enabled: !!user && !!profile.data,
    queryFn: async () => {
      await supabase.rpc("ensure_daily_quests");
      return true;
    },
  });

  const quests = useQuery({
    queryKey: ["daily-quests", user?.id, today],
    enabled: !!user && ensured.data === true,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_daily_quests")
        .select("id,quest_key,target,reward_blox,progress,completed,claimed")
        .eq("user_id", user!.id)
        .eq("quest_date", today)
        .order("created_at");
      return data ?? [];
    },
  });

  const streak = useQuery({
    queryKey: ["quest-streak", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_quest_streaks")
        .select("current_streak,longest_streak")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? { current_streak: 0, longest_streak: 0 };
    },
  });

  // Celebrate the moment a quest is actually claimed (not just completed -
  // the Blox reward and streak only move once the player taps Claim),
  // without re-firing on every 15s poll once it's already been celebrated.
  useEffect(() => {
    if (!quests.data) return;
    const nowClaimed = new Set(quests.data.filter((q) => q.claimed).map((q) => q.quest_key));
    const prev = claimedKeysRef.current;
    if (prev) {
      for (const key of nowClaimed) {
        if (!prev.has(key)) {
          const def = questDef(key);
          const row = quests.data.find((q) => q.quest_key === key);
          void burst();
          toast.success(t("questCompleted", { reward: String(row?.reward_blox ?? 0) }), {
            icon: def?.emoji ?? "🎉",
          });
          invalidateBalance();
          void qc.invalidateQueries({ queryKey: ["quest-streak", user?.id] });
        }
      }
    }
    claimedKeysRef.current = nowClaimed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests.data]);

  async function claimQuest(questId: string) {
    if (claimingId) return;
    setClaimingId(questId);
    const { error } = await supabase.rpc("claim_daily_quest", { _quest_id: questId });
    setClaimingId(null);
    if (error) {
      toast.error(errorMessage(error, t("errorGeneric")));
      return;
    }
    void quests.refetch();
  }

  useEffect(() => {
    function tick() {
      setCountdown(formatCountdown(msUntilNextLocalMidnight(tz)));
    }
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [tz]);

  const rows = quests.data ?? [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/home" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-black">{t("rewards")}</h1>
        {user ? <BloxBalanceChip /> : null}
      </header>

      <section className="mt-5 flex items-center gap-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-2xl">
          <CalendarCheck className="h-7 w-7 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black">
            {streak.data?.current_streak ?? 0} {t("dayStreak")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("bestStreak", { count: String(streak.data?.longest_streak ?? 0) })}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs font-bold text-muted-foreground">
          <p>{t("resetsIn")}</p>
          <p className="text-sm text-foreground">
            {countdown.hours}h {countdown.minutes.toString().padStart(2, "0")}min
          </p>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        {rows.map((row) => {
          const def = questDef(row.quest_key);
          if (!def) return null;
          const pct = Math.min(100, Math.round((row.progress / row.target) * 100));
          return (
            <div
              key={row.id}
              className={cn(
                "rounded-3xl border p-4 transition",
                row.completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{def.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{t(def.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(def.descriptionKey, { count: String(def.target) })}
                  </p>
                </div>
                {!row.completed ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-black text-primary">
                    <BloxIcon className="h-4 w-4" />+{row.reward_blox}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    row.completed ? "bg-emerald-500" : "spark-gradient",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {row.completed ? (
                row.claimed ? (
                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-500/10 py-2.5 text-sm font-black text-emerald-500">
                    <Check className="h-4 w-4" /> {t("rewardClaimed")}
                  </div>
                ) : (
                  <button
                    onClick={() => void claimQuest(row.id)}
                    disabled={claimingId === row.id}
                    className="spark-gradient mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {claimingId === row.id ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" /> {t("claiming")}
                      </>
                    ) : (
                      <>
                        <Gift className="h-4 w-4" /> {t("claimReward")} · +{row.reward_blox}{" "}
                        <BloxIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )
              ) : (
                <p className="mt-1.5 text-right text-[11px] font-bold text-muted-foreground">
                  {Math.min(row.progress, row.target)}/{row.target}
                </p>
              )}
            </div>
          );
        })}
        {quests.isLoading || ensured.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">…</p>
        ) : null}
      </section>

      <div className="mt-6">
        <WatchAdRewardCard />
      </div>

      <Link
        to="/store"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-black hover:border-primary/40"
      >
        <Gift className="h-4 w-4" /> {t("spendYourBlox")}
      </Link>
    </main>
  );
}
