import { useState } from "react";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage, cn } from "@/lib/utils";
import { isNativeApp } from "@/lib/native";
import { watchRewardedAd } from "@/lib/ads";
import { useInvalidateBloxBalance } from "@/components/Blox";

/** Small arithmetic challenge shown right after a rewarded ad finishes, before
 * the reward is actually claimed - the 20-minute cooldown (enforced by the
 * claim_ad_reward Postgres function, see supabase/migrations) already stops
 * someone from farming Blox by hand, but it does nothing against a script
 * that just calls prepareRewardVideoAd/showRewardVideoAd in a loop from a
 * modified build. This doesn't stop that either, but it does stop the much
 * more common case of an on-device auto-clicker/macro replaying the same
 * tap sequence, since the correct answer changes every time. */
function generateChallenge() {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  const correct = a + b;
  const [offsetA, offsetB] = [-2, -1, 1, 2, 3].sort(() => Math.random() - 0.5) as [
    number,
    number,
  ];
  const options = [correct, correct + offsetA, correct + offsetB]
    .filter((n) => n > 0)
    .sort(() => Math.random() - 0.5);
  return { a, b, correct, options };
}

export function WatchAdRewardCard() {
  const { t } = useI18n();
  const invalidateBalance = useInvalidateBloxBalance();
  const [watching, setWatching] = useState(false);
  const [challenge, setChallenge] = useState<ReturnType<typeof generateChallenge> | null>(null);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);

  if (!isNativeApp()) return null;

  async function startAd() {
    if (watching) return;
    setWatching(true);
    try {
      const earned = await watchRewardedAd();
      if (earned !== null) {
        setChallenge(generateChallenge());
      }
    } finally {
      setWatching(false);
    }
  }

  async function pick(option: number) {
    if (!challenge || claiming) return;
    if (option !== challenge.correct) {
      setWrongPick(option);
      window.setTimeout(() => setWrongPick(null), 600);
      return;
    }
    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("claim_ad_reward");
      if (error) throw error;
      invalidateBalance();
      toast.success(t("adRewardEarned", { balance: String(data) }));
      setChallenge(null);
    } catch (err) {
      const message = errorMessage(err, t("errorGeneric"));
      toast.error(message.includes("ad_reward_cooldown") ? t("adRewardCooldown") : message);
      setChallenge(null);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <button
        onClick={() => void startAd()}
        disabled={watching}
        className="flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <PlayCircle className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">{t("adRewardTitle")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("adRewardSubtitle")}
          </span>
        </span>
      </button>

      {challenge ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-bold">{t("adRewardCaptchaTitle")}</p>
            <p className="mt-3 text-3xl font-black">
              {challenge.a} + {challenge.b} = ?
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {challenge.options.map((option) => (
                <button
                  key={option}
                  disabled={claiming}
                  onClick={() => void pick(option)}
                  className={cn(
                    "rounded-2xl border border-border bg-background py-3 text-lg font-black transition disabled:opacity-60",
                    wrongPick === option
                      ? "animate-[shake_0.3s] border-destructive text-destructive"
                      : "hover:border-primary/40",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
