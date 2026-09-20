import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { Button, Sheet } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { isSparkPlusActive } from "@/lib/sparkPlus";
import { restoreDeadline, hoursUntil } from "@/lib/streaks";
import { errorMessage } from "@/lib/utils";

const MONTHLY_RESTORE_LIMIT = 3;

export function StreakRestoreSheet({
  open,
  onClose,
  conversationId,
  streakCount,
  brokenAt,
  myAvatarUrl,
  otherAvatarUrl,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  streakCount: number;
  brokenAt: string | null;
  myAvatarUrl: string | null;
  otherAvatarUrl: string | null;
  onRestored: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [restoring, setRestoring] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(0);

  const me = useQuery({
    queryKey: ["streak-restore-me", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spark_plus_active,spark_plus_expires_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const restoresUsed = useQuery({
    queryKey: ["streak-restores-used", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("streak_restores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gte("created_at", monthStart.toISOString());
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!brokenAt) return;
    const tick = () => setHoursLeft(hoursUntil(restoreDeadline(brokenAt)));
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [brokenAt]);

  const hasSparkPlus = isSparkPlusActive(me.data);
  const remaining = Math.max(0, MONTHLY_RESTORE_LIMIT - (restoresUsed.data ?? 0));
  const canRestore = hasSparkPlus && remaining > 0;

  async function restore() {
    setRestoring(true);
    try {
      await supabase.rpc("restore_streak", { _conversation_id: conversationId });
      toast.success(t("streakRestored"));
      onRestored();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="text-center">
        <div className="flex items-center justify-center -space-x-4">
          <StoredImage
            path={myAvatarUrl}
            alt=""
            className="h-16 w-16 rounded-full border-4 border-card object-cover"
            fallback="🎮"
          />
          <span className="z-10 grid h-10 w-10 place-items-center rounded-full bg-card text-xl shadow">
            🔥
          </span>
          <StoredImage
            path={otherAvatarUrl}
            alt=""
            className="h-16 w-16 rounded-full border-4 border-card object-cover"
            fallback="🎮"
          />
        </div>
        <h2 className="mt-4 text-lg font-black">
          {t("restoreStreakTitle", { count: String(streakCount) })}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("streakBrokenBody", { hours: String(hoursLeft) })}
        </p>
        <Link
          to="/wiki"
          onClick={onClose}
          className="mt-1 inline-block text-xs font-bold text-primary"
        >
          {t("learnMore")}
        </Link>

        <div className="mt-4 rounded-2xl bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground">
          {hasSparkPlus
            ? t("streakRestoresRemaining", { count: String(remaining) })
            : t("streakRestoresRequireSparkPlus")}
        </div>

        <div className="mt-5">
          {canRestore ? (
            <Button className="w-full" disabled={restoring} onClick={() => void restore()}>
              <Flame className="h-4 w-4" />
              {restoring ? t("loading") : t("restoreStreakCta")}
            </Button>
          ) : (
            <Link to="/shop" onClick={onClose}>
              <Button className="w-full">{t("getSparkPlus")}</Button>
            </Link>
          )}
        </div>
      </div>
    </Sheet>
  );
}
