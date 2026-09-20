import { Flag } from "@/components/Flag";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoWordmark } from "@/components/Logo";
import { Button, Select, Sheet } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { BANNERS, ageFrom } from "@/lib/decorations";
import { COUNTRY_CODES, countryFlagEmoji, countryName } from "@/lib/countries";
import { MAX_SPARK_BADGES, SPARK_BADGES, sparkBadge } from "@/lib/sparkBadges";
import { errorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sparks")({
  head: () => ({
    meta: [
      { title: "Sparks - Bloxspark" },
      { name: "description", content: "Swipe les profils de joueurs Roblox et trouve tes matchs." },
      { property: "og:title", content: "Sparks - Bloxspark" },
      { property: "og:description", content: "Swipe, matche et discute." },
    ],
  }),
  component: SparksPage,
});

type DeckProfile = {
  id: string;
  username: string | null;
  roblox_username: string | null;
  bio: string | null;
  language: string;
  age: number | null;
  banner_style: string;
  avatar_url: string | null;
  verified: boolean | null;
  country: string | null;
  spark_badges: string[] | null;
  last_active_at: string;
};

type DeckGame = { name: string; thumbnail_url: string | null };

type QuickFilter = "all" | "similar" | "language" | "mic";

function isOnline(lastActiveAt: string | null | undefined) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000;
}

function computeCompatibility(
  me: { language: string; country: string | null; age: number | null; gameNames: Set<string> },
  profile: DeckProfile,
  profileGames: string[],
) {
  let score = 35;
  const shared = profileGames.filter((g) => me.gameNames.has(g.toLowerCase())).length;
  score += Math.min(shared, 3) * 12;
  if (me.country && profile.country && me.country === profile.country) score += 15;
  if (me.language && profile.language && me.language === profile.language) score += 10;
  const myAge = me.age;
  const theirAge = profile.age;
  if (myAge && theirAge) {
    const diff = Math.abs(myAge - theirAge);
    score += diff <= 2 ? 8 : diff <= 5 ? 4 : 0;
  }
  return Math.max(35, Math.min(99, Math.round(score)));
}

/** Met à jour en direct les profils affichés (avatar, bannière, pseudo…) sans recharger la page. */
function useLiveProfiles() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("sparks-profiles-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const updated = payload.new as Partial<DeckProfile> & { id?: string };
          if (!updated?.id) return;
          // Mise à jour sur place du deck pour ne pas perdre la position du swipe
          queryClient.setQueriesData<DeckProfile[]>({ queryKey: ["deck"] }, (old) =>
            Array.isArray(old)
              ? old.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
              : old,
          );
          void queryClient.invalidateQueries({ queryKey: ["my-matches"] });
          void queryClient.invalidateQueries({ queryKey: ["deck-photos"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

function SparksPage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const queryClient = useQueryClient();
  useLiveProfiles();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"deck" | "matches" | "profile">("deck");
  const [filters, setFilters] = useState({ lang: "", min: 13, max: 99 });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [match, setMatch] = useState<{ name: string; conversationId: string } | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const myGate = useQuery({
    queryKey: ["sparks-gate", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("sparks_enabled").eq("id", user!.id).maybeSingle(),
        supabase
          .from("favorite_games")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
      ]);
      return { sparksEnabled: profile?.sparks_enabled ?? false, gameCount: count ?? 0 };
    },
  });

  const myProfile = useQuery({
    queryKey: ["sparks-my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: games }] = await Promise.all([
        supabase
          .from("profiles")
          .select("language,country,age,spark_badges")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("favorite_games").select("name").eq("user_id", user!.id),
      ]);
      return {
        language: profile?.language ?? lang,
        country: profile?.country ?? null,
        age: profile?.age ?? null,
        badges: profile?.spark_badges ?? [],
        gameNames: new Set((games ?? []).map((g) => g.name.toLowerCase())),
      };
    },
  });

  async function enableSparks() {
    if (!user) return;
    setEnabling(true);
    const { error } = await supabase
      .from("profiles")
      .update({ sparks_enabled: true })
      .eq("id", user.id);
    setEnabling(false);
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["sparks-gate", user.id] });
  }

  const { data: deck = [], refetch } = useQuery({
    queryKey: ["deck", filters],
    enabled: myGate.data?.sparksEnabled === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("spark_deck", {
        _limit: 30,
        _min_age: filters.min,
        _max_age: filters.max,
        ...(filters.lang ? { _lang: filters.lang } : {}),
      });
      if (error) throw error;
      setIndex(0);
      return (data ?? []) as unknown as DeckProfile[];
    },
  });

  const { data: photos = {} } = useQuery({
    queryKey: ["deck-photos", deck.map((d) => d.id).join(",")],
    enabled: deck.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_photos")
        .select("user_id,url,position")
        .in(
          "user_id",
          deck.map((d) => d.id),
        )
        .order("position");
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        (map[row.user_id] ??= []).push(row.url);
      }
      return map;
    },
  });

  const { data: deckGames = {} } = useQuery({
    queryKey: ["deck-games", deck.map((d) => d.id).join(",")],
    enabled: deck.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorite_games")
        .select("user_id,name,thumbnail_url,position")
        .in(
          "user_id",
          deck.map((d) => d.id),
        )
        .order("position");
      const map: Record<string, DeckGame[]> = {};
      for (const row of data ?? []) (map[row.user_id] ??= []).push({ name: row.name, thumbnail_url: row.thumbnail_url });
      return map;
    },
  });

  const visibleDeck = useMemo(() => {
    if (quickFilter === "mic") return deck.filter((p) => (p.spark_badges ?? []).includes("mic"));
    if (quickFilter === "similar") {
      const mine = myProfile.data?.gameNames ?? new Set<string>();
      if (mine.size === 0) return deck;
      return deck.filter((p) => (deckGames[p.id] ?? []).some((g) => mine.has(g.name.toLowerCase())));
    }
    return deck;
  }, [deck, deckGames, quickFilter, myProfile.data]);

  useEffect(() => {
    setIndex(0);
  }, [quickFilter]);

  function selectQuickFilter(next: QuickFilter) {
    setQuickFilter(next);
    if (next === "language") {
      setFilters((f) => ({ ...f, lang: myProfile.data?.language ?? "" }));
    } else if (quickFilter === "language") {
      setFilters((f) => ({ ...f, lang: "" }));
    }
  }

  const current = visibleDeck[index];
  const next = visibleDeck[index + 1];

  async function swipe(action: "like" | "pass" | "super") {
    if (!current) return;
    const target = current;
    setIndex((i) => i + 1);
    setDrag(0);
    const { data, error } = await supabase.rpc("perform_swipe", {
      _target: target.id,
      _action: action,
    });
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    const result = data as unknown as { match: boolean; conversation_id?: string };
    if (result?.match && result.conversation_id) {
      setMatch({ name: target.username ?? "?", conversationId: result.conversation_id });
    }
  }

  async function messageCurrent() {
    if (!current || messaging) return;
    setMessaging(true);
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: current.id,
      });
      if (error) throw error;
      await navigate({ to: "/messages/$id", params: { id: conversationId as string } });
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setMessaging(false);
    }
  }

  const cardStyle = useMemo(
    () => ({
      transform: `translateX(${drag}px) rotate(${drag / 25}deg)`,
      transition: drag === 0 ? "transform .25s ease" : "none",
    }),
    [drag],
  );

  if (myGate.isLoading) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <LogoWordmark className="h-11" />
      </div>
    );
  }

  if (myGate.data?.sparksEnabled === false) {
    return (
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <LogoWordmark className="mb-6 h-11" />
        <span className="spark-gradient grid h-16 w-16 place-items-center rounded-3xl text-3xl text-white shadow-[0_0_28px_rgba(168,85,247,.55)]">
          ✦
        </span>
        <h1 className="mt-5 text-xl font-black">{t("sparksGateTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("sparksGateBody")}</p>
        {myGate.data && myGate.data.gameCount === 0 ? (
          <>
            <p className="mt-4 text-sm font-semibold text-primary">{t("sparksGateNoGames")}</p>
            <Link to="/profile" className="mt-4 w-full">
              <Button className="w-full">{t("addAGame")}</Button>
            </Link>
          </>
        ) : (
          <Button className="mt-6 w-full" disabled={enabling} onClick={() => void enableSparks()}>
            {enabling ? t("loading") : t("enableSparks")}
          </Button>
        )}
      </div>
    );
  }

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "similar", label: t("filterSimilarGames") },
    { id: "language", label: t("filterSameLanguage") },
    { id: "mic", label: t("filterHasMic") },
  ];

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="spark-gradient grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white shadow-[0_0_18px_rgba(168,85,247,.5)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-black leading-tight">{t("sparks")}</h1>
            <p className="text-xs text-muted-foreground">{t("sparksGateTitle")}</p>
          </div>
        </div>
        <button
          onClick={() => setShowFilters(true)}
          aria-label={t("filters")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <SlidersHorizontal className="h-4.5 w-4.5" />
        </button>
      </header>

      <div className="mt-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["deck", t("sparks")],
            ["matches", t("sparkMatchesTab")],
            ["profile", t("sparkProfileTab")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition",
              tab === id
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "deck" ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => selectQuickFilter(f.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
              quickFilter === f.id
                ? "border border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "matches" ? <MatchesTab /> : null}
      {tab === "profile" ? <SparkProfileTab /> : null}

      <div className={cn(tab === "deck" ? "" : "hidden")}>
        <div className="relative mt-4 h-[min(68dvh,640px)] min-h-[420px]">
          {!current ? (
            <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-surface/40 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl">
                🪐
              </span>
              <p className="mt-4 px-8 text-sm text-muted-foreground">{t("noMoreProfiles")}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold transition hover:border-primary/40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t("loading")}
              </button>
            </div>
          ) : (
            <>
              {next ? (
                <SparkCard
                  key={next.id}
                  profile={next}
                  photos={photos[next.id] ?? []}
                  games={deckGames[next.id] ?? []}
                  compatibility={
                    myProfile.data
                      ? computeCompatibility(myProfile.data, next, (deckGames[next.id] ?? []).map((g) => g.name))
                      : 50
                  }
                  className="scale-95 opacity-60"
                />
              ) : null}
              <div
                style={cardStyle}
                onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                onPointerMove={(e) => {
                  if (e.buttons === 1) setDrag((d) => d + e.movementX);
                }}
                onPointerUp={() => {
                  if (drag > 110) void swipe("like");
                  else if (drag < -110) void swipe("pass");
                  else setDrag(0);
                }}
                className="absolute inset-0 touch-none"
              >
                <SparkCard
                  key={current.id}
                  profile={current}
                  photos={photos[current.id] ?? []}
                  games={deckGames[current.id] ?? []}
                  compatibility={
                    myProfile.data
                      ? computeCompatibility(myProfile.data, current, (deckGames[current.id] ?? []).map((g) => g.name))
                      : 50
                  }
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => swipe("pass")}
            disabled={!current}
            className="flex flex-col items-center gap-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-30"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-red-500 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:scale-90">
              <X className="h-6 w-6" strokeWidth={2.5} />
            </span>
            {t("pass")}
          </button>
          <button
            onClick={() => swipe("super")}
            disabled={!current}
            className="flex flex-col items-center gap-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-30"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-sky-500 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-90">
              <Star className="h-5 w-5" />
            </span>
            {t("superLike")}
          </button>
          <button
            onClick={() => swipe("like")}
            disabled={!current}
            className="flex flex-col items-center gap-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-30"
          >
            <span className="spark-gradient flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-10px_rgba(168,85,247,.8)] transition hover:-translate-y-0.5 active:scale-90">
              <Heart className="h-7 w-7" fill="currentColor" />
            </span>
            {t("like")}
          </button>
          <button
            onClick={() => void messageCurrent()}
            disabled={!current || messaging}
            className="flex flex-col items-center gap-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-30"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-90">
              <MessageCircle className="h-5 w-5" />
            </span>
            {t("message")}
          </button>
        </div>
      </div>

      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title={t("filters")}>
        <div className="space-y-4">
          <Select
            value={filters.lang}
            onChange={(e) => {
              setQuickFilter("all");
              setFilters((f) => ({ ...f, lang: e.target.value }));
            }}
          >
            <option value="">{t("allLanguages")}</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </Select>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              {t("ageRange")}: {filters.min} – {filters.max}
            </p>
            <div className="flex gap-3">
              <input
                type="range"
                min={13}
                max={99}
                value={filters.min}
                onChange={(e) => setFilters((f) => ({ ...f, min: Number(e.target.value) }))}
                className="flex-1 accent-primary"
              />
              <input
                type="range"
                min={13}
                max={99}
                value={filters.max}
                onChange={(e) => setFilters((f) => ({ ...f, max: Number(e.target.value) }))}
                className="flex-1 accent-primary"
              />
            </div>
          </div>
          <Button className="w-full" onClick={() => setShowFilters(false)}>
            {t("save")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!match} onClose={() => setMatch(null)}>
        <div className="py-4 text-center">
          <p className="text-5xl">✨</p>
          <h2 className="spark-text mt-3 text-3xl font-bold">{t("itsAMatch")}</h2>
          <p className="mt-1 text-muted-foreground">{match?.name}</p>
          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                if (match) navigate({ to: "/messages/$id", params: { id: match.conversationId } });
              }}
            >
              {t("sendMessage")}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setMatch(null)}>
              {t("keepSwiping")}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function MatchesTab() {
  const { t, lang } = useI18n();
  const { user } = useSession();

  const matches = useQuery({
    queryKey: ["my-matches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("matches")
        .select("id,user_a,user_b,conversation_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const others = (rows ?? []).map((m) => (m.user_a === user?.id ? m.user_b : m.user_a));
      if (others.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified,language")
        .in("id", others);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((m) => ({
        ...m,
        other: byId.get(m.user_a === user?.id ? m.user_b : m.user_a),
      }));
    },
  });

  const likes = useQuery({
    queryKey: ["likes-received", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .in("kind", ["like", "super"]);
      return count ?? 0;
    },
  });

  const list = matches.data ?? [];

  return (
    <div className="mt-4 space-y-4 pb-4">
      <div className="flex items-center gap-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
        </span>
        <div>
          <p className="spark-text text-2xl font-black">{likes.data ?? 0}</p>
          <p className="text-xs font-semibold text-muted-foreground">{t("likesReceived")}</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-[2rem] border border-dashed border-border bg-surface/40 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl">
            💜
          </span>
          <p className="mt-3 px-8 text-sm text-muted-foreground">{t("noSparkMatches")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((m) =>
            m.conversation_id ? (
              <Link
                key={m.id}
                to="/messages/$id"
                params={{ id: m.conversation_id }}
                className="group overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="relative aspect-square w-full bg-surface-2">
                  <StoredImage
                    path={m.other?.avatar_url}
                    alt={m.other?.username ?? ""}
                    className="h-full w-full object-cover"
                    fallback="🎮"
                  />
                  <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
                    <Heart className="h-3.5 w-3.5" fill="currentColor" />
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="flex items-center gap-1 truncate text-sm font-bold">
                    <span className="truncate">{m.other?.username ?? "?"}</span>
                    {m.other?.verified ? <Verified className="h-3.5 w-3.5 shrink-0" /> : null}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t("matchedOn", {
                      date: new Date(m.created_at).toLocaleDateString(lang, {
                        day: "numeric",
                        month: "short",
                      }),
                    })}
                  </p>
                </div>
              </Link>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function SparkProfileTab() {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [ageVisible, setAgeVisible] = useState(true);
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState("");
  const [voicePref, setVoicePref] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const profile = useQuery({
    queryKey: ["spark-profile-editor", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "username,age,country,spark_badges,age_visible,spoken_languages,spark_looking_for,spark_voice_pref,spark_availability",
        )
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile.data && !loaded) {
      setBadges(profile.data.spark_badges ?? []);
      setCountry(profile.data.country ?? "");
      setAgeVisible(profile.data.age_visible ?? true);
      setSpokenLanguages(profile.data.spoken_languages ?? []);
      setLookingFor(profile.data.spark_looking_for ?? "");
      setVoicePref(profile.data.spark_voice_pref ?? []);
      setAvailability(profile.data.spark_availability ?? []);
      setLoaded(true);
    }
  }, [profile.data, loaded]);

  function toggleBadge(id: string) {
    setBadges((current) => {
      if (current.includes(id)) return current.filter((b) => b !== id);
      if (current.length >= MAX_SPARK_BADGES) return current;
      return [...current, id];
    });
  }

  function toggleLanguage(code: string) {
    setSpokenLanguages((current) => {
      if (current.includes(code)) return current.filter((c) => c !== code);
      if (current.length >= 3) {
        toast.error(t("profileMaxLanguagesReached"));
        return current;
      }
      return [...current, code];
    });
  }

  function toggleVoicePref(value: string) {
    setVoicePref((current) => {
      if (current.includes(value)) return current.filter((c) => c !== value);
      if (current.length >= 3) {
        toast.error(t("profileMaxVoicePrefReached"));
        return current;
      }
      return [...current, value];
    });
  }

  function toggleAvailability(value: string) {
    setAvailability((current) =>
      current.includes(value) ? current.filter((c) => c !== value) : [...current, value],
    );
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        spark_badges: badges,
        country: country || null,
        age_visible: ageVisible,
        spoken_languages: spokenLanguages,
        spark_looking_for: lookingFor || null,
        spark_voice_pref: voicePref,
        spark_availability: availability,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    toast.success(t("saved"));
    void qc.invalidateQueries({ queryKey: ["sparks-my-profile", user.id] });
    void qc.invalidateQueries({ queryKey: ["deck"] });
    void qc.invalidateQueries({ queryKey: ["spark-preview", user.id] });
  }

  // Live "how others see you" preview, using the exact same card other
  // members see in their deck - reads straight from the profile row rather
  // than the local draft state, so it only updates once Save actually
  // persists (avoids implying unsaved changes are already visible to others).
  const preview = useQuery({
    queryKey: ["spark-preview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: p }, { data: photoRows }, { data: gameRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,username,roblox_username,bio,language,age,banner_style,avatar_url,verified,country,spark_badges,last_active_at",
          )
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("profile_photos")
          .select("url,position")
          .eq("user_id", user!.id)
          .order("position"),
        supabase
          .from("favorite_games")
          .select("name,thumbnail_url,position")
          .eq("user_id", user!.id)
          .order("position"),
      ]);
      return {
        profile: p as DeckProfile | null,
        photos: (photoRows ?? []).map((r) => r.url),
        games: (gameRows ?? []) as DeckGame[],
      };
    },
  });

  return (
    <div className="mt-4 space-y-5 pb-4">
      <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-bold">{t("profileEditIdentityTitle")}</p>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">{t("profileAgeLabel")}</p>
            <span className="text-sm font-bold">{profile.data?.age ?? "—"}</span>
          </div>
          <button
            type="button"
            onClick={() => setAgeVisible((v) => !v)}
            className={cn(
              "mt-2 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition",
              ageVisible
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {t("profileAgeShowToggle")}
            <span
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition",
                ageVisible ? "bg-primary" : "bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition",
                  ageVisible ? "left-4" : "left-0.5",
                )}
              />
            </span>
          </button>
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground">
            {t("profileSpokenLanguages")} ({spokenLanguages.length}/3)
          </p>
          <p className="mb-2 text-xs text-muted-foreground">{t("profileSpokenLanguagesHint")}</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const active = spokenLanguages.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => toggleLanguage(l.code)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
                  )}
                >
                  {l.flag} {l.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-bold">{t("country")}</p>
        <p className="mb-3 text-xs text-muted-foreground">{t("sparksGateBody")}</p>
        <Select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">{t("chooseCountry")}</option>
          {COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>
              {countryFlagEmoji(code)} {countryName(code, "en")}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-bold">{t("sparkBadgesTitle")}</p>
        <p className="mb-3 text-xs text-muted-foreground">{t("sparkBadgesHint")}</p>
        <div className="flex flex-wrap gap-2">
          {SPARK_BADGES.map((b) => {
            const active = badges.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggleBadge(b.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
                )}
              >
                <span>{b.emoji}</span> {t(b.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-bold">{t("profileLookingForTitle")}</p>
        <Select value={lookingFor} onChange={(e) => setLookingFor(e.target.value)}>
          <option value="">{t("profileLookingForPlaceholder")}</option>
          <option value="duo">{t("lookingForDuo")}</option>
          <option value="friends">{t("lookingForFriends")}</option>
          <option value="creation_partner">{t("lookingForCreationPartner")}</option>
        </Select>
      </div>

      <div className="space-y-2 rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-bold">{t("profileCommunicationTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("profileCommunicationSubtitle")} ({voicePref.length}/3)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["roblox_voice", t("voicePrefRoblox")],
              ["chat_only", t("voicePrefChatOnly")],
              ["discord_voice", t("voicePrefDiscord")],
              ["no_voice", t("voicePrefNoVoice")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleVoicePref(value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition",
                voicePref.includes(value)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-3xl border border-border bg-card p-4">
        <p className="text-sm font-bold">{t("profileAvailabilityTitle")}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["morning", t("availabilityMorning")],
              ["afternoon", t("availabilityAfternoon")],
              ["late_afternoon", t("availabilityLateAfternoon")],
              ["evening", t("availabilityEvening")],
              ["night", t("availabilityNight")],
              ["weekend", t("availabilityWeekend")],
            ] as const
          ).map(([value, label]) => {
            const active = availability.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleAvailability(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <Button className="w-full" disabled={saving} onClick={() => void save()}>
        {saving ? t("loading") : t("save")}
      </Button>

      {preview.data?.profile ? (
        <div>
          <p className="mb-2 text-sm font-bold">{t("profilePreviewTitle")}</p>
          <p className="mb-3 text-xs text-muted-foreground">{t("profilePreviewHint")}</p>
          <div className="relative mx-auto aspect-[3/4.7] w-full max-w-xs overflow-hidden rounded-[2rem] shadow-xl">
            <SparkCard
              profile={preview.data.profile}
              photos={preview.data.photos}
              games={preview.data.games}
              compatibility={100}
              className="pointer-events-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SparkCard({
  profile,
  photos,
  games = [],
  compatibility,
  className,
}: {
  profile: DeckProfile;
  photos: string[];
  games?: DeckGame[];
  compatibility: number;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const age = profile.age;
  const [photoIndex, setPhotoIndex] = useState(0);
  const online = isOnline(profile.last_active_at);
  const badges = (profile.spark_badges ?? []).map(sparkBadge).filter(Boolean);
  const mainPhoto = photos[photoIndex] ?? profile.avatar_url;

  function stop(e: React.PointerEvent) {
    e.stopPropagation();
  }

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl",
        className,
      )}
    >
      <div className="relative h-full">
        {mainPhoto ? (
          <StoredImage
            path={mainPhoto}
            alt={profile.username ?? ""}
            className="h-full w-full"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundImage: BANNERS[profile.banner_style] ?? BANNERS["nebula"] }}
          />
        )}

        {photos.length > 1 ? (
          <>
            <div className="absolute inset-x-3 top-3 flex gap-1">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i === photoIndex ? "bg-white" : "bg-white/30",
                  )}
                />
              ))}
            </div>
            <button
              onPointerDown={stop}
              onClick={() => setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1))}
              aria-label="previous photo"
              className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onPointerDown={stop}
              onClick={() => setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1))}
              aria-label="next photo"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="absolute left-3 top-8 flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 rounded-xl bg-black/50 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
            <span className={cn("h-2 w-2 rounded-full", online ? "bg-[#20D778]" : "bg-white/40")} />
            {online ? t("sparkOnline") : t("lookingForPlayers")}
          </span>
          {online ? (
            <span className="flex items-center gap-1.5 rounded-xl bg-black/50 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
              🎮 {t("lookingForPlayers")}
            </span>
          ) : null}
        </div>

        <div className="absolute right-3 top-8 rounded-xl bg-black/50 px-2.5 py-1.5 text-center backdrop-blur">
          <p className="text-sm font-bold text-white">💜 {compatibility}%</p>
          <p className="text-[10px] text-white/80">{t("compatible")}</p>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 pt-24 text-white">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-2xl font-bold">{profile.username}</h2>
            {profile.verified ? <Verified className="h-5 w-5" /> : null}
            {age ? <span className="text-lg opacity-90">, {age}</span> : null}
            <span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-[#20D778]" : "bg-white/30")} />
          </div>
          {profile.country ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
              <span>{countryFlagEmoji(profile.country)}</span>
              <span>{countryName(profile.country, lang)}</span>
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
              <Flag code={profile.language ?? ""} className="h-4 w-6" />
              🎮 {profile.roblox_username}
            </p>
          )}
          {profile.bio ? <p className="mt-2 line-clamp-2 text-sm italic opacity-90">"{profile.bio}"</p> : null}
          {badges.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b!.id}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur"
                >
                  {b!.emoji} {t(b!.labelKey)}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-end justify-between gap-3">
            {games.length > 0 ? (
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{t("plays")}</p>
                <div className="mt-1.5 flex gap-2">
                  {games.slice(0, 3).map((g) => (
                    <div key={g.name} className="w-11 text-center">
                      <div className="h-11 w-11 overflow-hidden rounded-xl bg-white/15">
                        <StoredImage path={g.thumbnail_url} alt={g.name} className="h-full w-full" fallback="🎮" />
                      </div>
                      <p className="mt-1 truncate text-[10px] leading-tight opacity-85">{g.name}</p>
                    </div>
                  ))}
                  {games.length > 3 ? (
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-xs font-bold">
                      +{games.length - 3}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <span />
            )}
            <Link
              to="/users/$id"
              params={{ id: profile.username || profile.id }}
              onPointerDown={stop}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-black shadow-lg"
            >
              {t("viewProfile")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
