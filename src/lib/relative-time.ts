type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Formats a timestamp as "Today"/"Yesterday"/"2 hours ago"/"3 months ago"/etc,
 * translated via the app's own i18n dictionary instead of relying on
 * Intl.RelativeTimeFormat's locale wording (which doesn't expose a "today"
 * bucket and reads oddly in narrow style). */
export function formatRelativeTime(value: string, t: Translate): string {
  const then = new Date(value);
  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));

  if (seconds < 60) return t("timeJustNow");
  if (seconds < 3600) return t("timeMinutesAgo", { n: Math.floor(seconds / 60) });

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (dayDiff === 0) {
    if (seconds < 86400) return t("timeHoursAgo", { n: Math.floor(seconds / 3600) });
    return t("timeToday");
  }
  if (dayDiff === 1) return t("timeYesterday");
  if (dayDiff < 30) return t("timeDaysAgo", { n: dayDiff });

  const months = Math.floor(dayDiff / 30);
  if (months < 12) return months === 1 ? t("timeMonthAgo") : t("timeMonthsAgo", { n: months });

  const years = Math.floor(dayDiff / 365);
  return years === 1 ? t("timeYearAgo") : t("timeYearsAgo", { n: years });
}
