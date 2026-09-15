import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  Calendar,
  Clock,
  Gift,
  Globe2,
  MapPin,
  Plus,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoWordmark } from "@/components/Logo";
import { StoredImage } from "@/components/Media";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "Événements & Giveaways - Bloxspark" },
      {
        name: "description",
        content: "Participe à des événements Roblox, gagne des giveaways et rejoins la communauté.",
      },
    ],
  }),
  component: EventsPage,
});

type EventRow = {
  id: string;
  kind: "event" | "giveaway";
  title: string;
  description: string | null;
  banner_url: string | null;
  prize: string | null;
  organizer_name: string | null;
  location_type: "online" | "in_person";
  location: string | null;
  starts_at: string;
  ends_at: string;
  created_by: string;
};

const FILTERS = ["all", "events", "giveaways", "upcoming", "ended"] as const;
type Filter = (typeof FILTERS)[number];

function statusOf(row: EventRow, now: number): "upcoming" | "ongoing" | "ended" {
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();
  if (now < starts) return "upcoming";
  if (now <= ends) return "ongoing";
  return "ended";
}

function formatCountdown(
  ends: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const ms = new Date(ends).getTime() - Date.now();
  if (ms <= 0) return t("eventsEndedLabel");
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return t("eventsEndsInDaysHours", { days, hours });
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return t("eventsEndsInHoursMinutes", { hours, minutes });
}

function EventsPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const { isStaff } = useRoles();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const myProfile = useQuery({
    queryKey: ["events-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const unread = useQuery({
    queryKey: ["events-unread-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  const events = useQuery({
    queryKey: ["events-list"],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id,kind,title,description,banner_url,prize,organizer_name,location_type,location,starts_at,ends_at,created_by",
        )
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const participants = useQuery({
    queryKey: ["events-participants"],
    queryFn: async () => {
      const { data } = await supabase.from("event_participants").select("event_id,user_id");
      return data ?? [];
    },
  });

  function participantCount(eventId: string) {
    return (participants.data ?? []).filter((p) => p.event_id === eventId).length;
  }
  function hasJoined(eventId: string) {
    return (
      !!user &&
      (participants.data ?? []).some((p) => p.event_id === eventId && p.user_id === user.id)
    );
  }

  async function join(eventId: string) {
    if (!user) return;
    if (hasJoined(eventId)) return;
    const { error } = await supabase
      .from("event_participants")
      .insert({ event_id: eventId, user_id: user.id });
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    toast.success(t("eventsJoined"));
    void participants.refetch();
    void qc.invalidateQueries({ queryKey: ["events-participants"] });
  }

  const now = Date.now();
  const q = search.trim().toLowerCase();
  const searchFiltered = (events.data ?? []).filter(
    (e) =>
      !q || e.title.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q),
  );

  const upcomingEvents = searchFiltered.filter(
    (e) => e.kind === "event" && statusOf(e, now) !== "ended",
  );
  const ongoingGiveaways = searchFiltered.filter(
    (e) => e.kind === "giveaway" && statusOf(e, now) !== "ended",
  );
  const ended = searchFiltered.filter((e) => statusOf(e, now) === "ended");

  const showEvents = filter === "all" || filter === "events" || filter === "upcoming";
  const showGiveaways = filter === "all" || filter === "giveaways" || filter === "upcoming";
  const showEnded = filter === "all" || filter === "ended";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-6 w-auto" />
        <div className="flex items-center gap-2">
          {isStaff ? (
            <Link
              to="/admin"
              aria-label={t("eventsCreate")}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Plus className="h-5 w-5" />
            </Link>
          ) : null}
          <Link
            to="/messages"
            aria-label={t("notifications")}
            className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
          >
            <Bell className="h-5 w-5" />
            {unread.data ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread.data > 9 ? "9+" : unread.data}
              </span>
            ) : null}
          </Link>
          <Link to="/profile" aria-label={t("profile")}>
            <StoredImage
              path={myProfile.data?.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-1 ring-primary/60"
              fallback={myProfile.data?.username?.[0]?.toUpperCase() ?? "?"}
            />
          </Link>
        </div>
      </header>

      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("eventsSearchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="spark-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-[0_0_16px_rgba(168,85,247,.5)]">
            <Calendar className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-black leading-tight">{t("eventsTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("eventsSubtitle")}</p>
          </div>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground",
            )}
          >
            {t(`eventsFilter_${f}`)}
          </button>
        ))}
      </div>

      <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-900 p-6 text-white shadow-[0_25px_70px_-35px_rgba(147,51,234,.9)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.2em] text-purple-200">
            {t("eventsTitle")}
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight">
            {t("eventsHeroLine1")}
            <br />
            {t("eventsHeroLine2")}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-purple-100/80">{t("eventsHeroHint")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-white text-purple-900 hover:bg-white/90"
              onClick={() => setFilter("events")}
            >
              {t("eventsSeeEvents")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10"
              onClick={() => setFilter("giveaways")}
            >
              {t("eventsSeeGiveaways")}
            </Button>
          </div>
        </div>
      </section>

      {showEvents ? (
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Calendar className="h-5 w-5 text-primary" /> {t("eventsUpcoming")}
            </h2>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {t("eventsNoneUpcoming")}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {upcomingEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  lang={lang}
                  t={t}
                  participantCount={participantCount(ev.id)}
                  joined={hasJoined(ev.id)}
                  onJoin={() => void join(ev.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showGiveaways ? (
        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-lg font-black text-amber-500">
            <Gift className="h-5 w-5" /> {t("eventsGiveaways")}
          </h2>
          {ongoingGiveaways.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {t("eventsNoneGiveaways")}
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ongoingGiveaways.map((ev) => (
                <GiveawayCard
                  key={ev.id}
                  event={ev}
                  t={t}
                  participantCount={participantCount(ev.id)}
                  joined={hasJoined(ev.id)}
                  onJoin={() => void join(ev.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {filter === "all" ? (
        <section className="mt-8 rounded-3xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Trophy className="h-5 w-5 text-amber-500" /> {t("eventsHowTitle")}
          </h2>
          <div className="mt-4 space-y-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary">
                  {step}
                </span>
                <div>
                  <p className="font-bold">{t(`eventsStep${step}Title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`eventsStep${step}Text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showEnded ? (
        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-lg font-black text-muted-foreground">
            <Clock className="h-5 w-5" /> {t("eventsEnded")}
          </h2>
          {ended.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {t("eventsNoneEnded")}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {ended.map((ev) => (
                <div
                  key={ev.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="relative aspect-video bg-surface-2">
                    {ev.banner_url ? (
                      <StoredImage
                        path={ev.banner_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white">
                      {t("eventsEndedLabel")}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-bold">{ev.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(ev.starts_at).toLocaleDateString(lang, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function EventCard({
  event,
  lang,
  t,
  participantCount,
  joined,
  onJoin,
}: {
  event: EventRow;
  lang: string;
  t: TFn;
  participantCount: number;
  joined: boolean;
  onJoin: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="relative h-40 bg-surface-2">
        {event.banner_url ? (
          <StoredImage path={event.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">📅</div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-black text-white">
          {new Date(event.starts_at)
            .toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })
            .toUpperCase()}
        </span>
      </div>
      <div className="p-4">
        <p className="font-black">{event.title}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {event.location_type === "online" ? (
            <Globe2 className="h-3.5 w-3.5" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          {event.location_type === "online"
            ? t("eventsOnline")
            : (event.location ?? t("eventsInPerson"))}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {t("eventsParticipants", { count: participantCount })}
        </p>
        {event.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
        ) : null}
        <Button className="mt-3 w-full" variant={joined ? "outline" : "primary"} onClick={onJoin}>
          {joined ? t("eventsJoined") : t("eventsSeeDetails")}
        </Button>
      </div>
    </article>
  );
}

function GiveawayCard({
  event,
  t,
  participantCount,
  joined,
  onJoin,
}: {
  event: EventRow;
  t: TFn;
  participantCount: number;
  joined: boolean;
  onJoin: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-amber-500/25 bg-card">
      <div className="relative h-32 bg-gradient-to-br from-amber-400/20 to-amber-600/10">
        {event.banner_url ? (
          <StoredImage path={event.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">🎁</div>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-amber-500/90 py-1 text-[11px] font-black text-white">
          <Clock className="h-3 w-3" /> {formatCountdown(event.ends_at, t)}
        </span>
      </div>
      <div className="p-3.5">
        <p className="truncate font-black">{event.prize || event.title}</p>
        {event.organizer_name ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("eventsOrganizedBy", { name: event.organizer_name })}
          </p>
        ) : null}
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {t("eventsParticipations", { count: participantCount })}
        </p>
        <Button
          size="sm"
          className="mt-2.5 w-full"
          variant={joined ? "outline" : "primary"}
          onClick={onJoin}
        >
          {joined ? t("eventsJoined") : t("eventsParticipate")}
        </Button>
      </div>
    </article>
  );
}
