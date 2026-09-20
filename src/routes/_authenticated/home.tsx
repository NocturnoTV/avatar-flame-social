import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Bell, Compass, Flame, LifeBuoy, ShoppingBag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { LogoWordmark } from "@/components/Logo";
import { useSignedUrl, StoredImage } from "@/components/Media";
import { PresenceDot } from "@/components/PresenceDot";
import { Verified } from "@/components/Verified";
import { BloxIcon, useBloxBalance } from "@/components/Blox";
import { ThreeBackground } from "@/components/landing/ThreeBackground";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import heroAsset from "@/assets/onboarding-hero.png.asset.json";

// `/_authenticated` is `ssr: false`, so importing GSAP at module scope
// wouldn't crash SSR here the way it did on `/` — but we still load it
// dynamically, client-side only, from inside an effect below, for the same
// reason as the landing page: it code-splits gsap + ScrollTrigger out of the
// initial bundle for a route every signed-in user hits constantly.

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home - Bloxspark" },
      {
        name: "description",
        content: "Your Bloxspark feed: friends, trending videos and today's Roblox news.",
      },
      { property: "og:title", content: "Home - Bloxspark" },
      { property: "og:description", content: "Friends, trending videos and Roblox news." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

/** Small emoji chip + title used to open every feed section, per design spec. */
function SectionHeader({
  emoji,
  title,
  action,
}: {
  emoji: string;
  title: string;
  action?: { to: "/discover" | "/sparks" | "/messages"; label: string };
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-base leading-none">
          {emoji}
        </span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {action ? (
        <Link
          to={action.to}
          className="flex items-center gap-0.5 text-sm font-bold text-primary transition hover:gap-1"
        >
          {action.label} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

type NewsItem = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  url: string | null;
  tone: string;
};

function NewsSection() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<
    Record<string, { title: string; subtitle: string | null; body: string | null }>
  >({});
  const [translating, setTranslating] = useState<string | null>(null);
  const { t, lang } = useI18n();
  const news = useQuery({
    queryKey: ["home-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news")
        .select("id,title,subtitle,body,url,tone")
        .eq("published", true)
        .order("position")
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as NewsItem[];
    },
  });

  const items = news.data ?? [];
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeader emoji="📰" title={t("newsTitle")} />
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((n, i) => {
          const open = openId === n.id;
          return (
            <article
              key={n.id}
              className={cn(
                "bx-rise group relative overflow-hidden rounded-3xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary",
                `bx-delay-${(i % 4) + 1}`,
                open && "sm:col-span-3",
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", n.tone)} />
              <button
                onClick={() => setOpenId(open ? null : n.id)}
                className="block w-full text-left"
              >
                <p className="pr-6 font-bold leading-snug">
                  {translations[n.id]?.title ?? n.title}
                </p>
                {n.subtitle ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {translations[n.id]?.subtitle ?? n.subtitle}
                  </p>
                ) : null}
              </button>
              {open && n.body ? (
                <p className="bx-rise mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {translations[n.id]?.body ?? n.body}
                </p>
              ) : null}
              {open && lang !== "en" ? (
                <button
                  disabled={translating === n.id}
                  onClick={() => void translateArticle(n)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50"
                >
                  <span className="text-sm leading-none">✨</span>
                  {translations[n.id] ? t("showOriginal") : t("translateWithAi")}
                </button>
              ) : null}
              {open && n.url ? (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  {t("source")} <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              <ArrowUpRight
                className={cn(
                  "pointer-events-none absolute right-3 top-4 h-4 w-4 text-muted-foreground transition group-hover:text-primary",
                  open && "rotate-90",
                )}
              />
            </article>
          );
        })}
      </div>
    </section>
  );

  async function translateArticle(article: NewsItem) {
    if (translations[article.id]) {
      setTranslations((current) => {
        const next = { ...current };
        delete next[article.id];
        return next;
      });
      return;
    }
    setTranslating(article.id);
    try {
      const api = (
        globalThis as unknown as {
          Translator?: {
            create: (options: {
              sourceLanguage: string;
              targetLanguage: string;
            }) => Promise<{ translate: (text: string) => Promise<string> }>;
          };
        }
      ).Translator;
      if (!api) throw new Error("AI translation is not supported by this browser yet.");
      const translator = await api.create({ sourceLanguage: "en", targetLanguage: lang });
      const [title, subtitle, body] = await Promise.all([
        translator.translate(article.title),
        article.subtitle ? translator.translate(article.subtitle) : Promise.resolve(null),
        article.body ? translator.translate(article.body) : Promise.resolve(null),
      ]);
      setTranslations((current) => ({ ...current, [article.id]: { title, subtitle, body } }));
    } catch (error) {
      console.error(error);
      toast.error(t("translationUnavailable"));
    } finally {
      setTranslating(null);
    }
  }
}

function HomePage() {
  const { user } = useSession();
  const { t } = useI18n();
  const hour = new Date().getHours();
  const hello =
    hour >= 5 && hour < 12
      ? { text: t("greetingMorning"), emoji: "🌅" }
      : hour < 18
        ? { text: t("greetingDay"), emoji: "☀️" }
        : hour < 23
          ? { text: t("greetingEvening"), emoji: "🌆" }
          : { text: t("greetingNight"), emoji: "🌙" };

  const me = useQuery({
    queryKey: ["me-home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url,verified,roblox_avatar_url,roblox_username")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const blox = useBloxBalance();

  const counters = useQuery({
    queryKey: ["home-counters", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const [notif, followers, matches] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("read", false),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", user!.id),
        supabase.from("matches").select("conversation_id", { count: "exact", head: true }),
      ]);
      return {
        unread: notif.count ?? 0,
        followers: followers.count ?? 0,
        matches: matches.count ?? 0,
      };
    },
  });

  // Amis / Abonnements - people the user follows.
  const following = useQuery({
    queryKey: ["home-following", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const ids = [...new Set((follows ?? []).map((f) => f.following_id))].filter(
        (id) => id !== user!.id,
      );
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified,last_active_at,show_online_status,dnd")
        .in("id", ids)
        .order("last_active_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  // Mes matchs Sparks - mutual matches from the swipe deck.
  const sparkMatches = useQuery({
    queryKey: ["home-spark-matches", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("matches")
        .select("user_a,user_b,conversation_id,created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      const others = (rows ?? []).map((m) => (m.user_a === user!.id ? m.user_b : m.user_a));
      if (others.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified")
        .in("id", others);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (rows ?? [])
        .map((m) => byId.get(m.user_a === user!.id ? m.user_b : m.user_a))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
    },
  });

  const latest = useQuery({
    queryKey: ["home-latest-videos"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("id,caption,storage_path,views_count,likes_count")
        .eq("visibility", "public")
        .eq("moderation_status", "approved")
        .order("views_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const heroGreetingRef = useRef<HTMLParagraphElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroSubtitleRef = useRef<HTMLParagraphElement>(null);
  const heroBellRef = useRef<HTMLAnchorElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const discoverRef = useRef<HTMLDivElement>(null);
  const friendsRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const gsapRef = useRef<typeof import("gsap").gsap | null>(null);
  const [gsapReady, setGsapReady] = useState(false);

  // Same "wow effect" GSAP + ScrollTrigger treatment as the public landing
  // page (`/`): a staggered hero entrance, then each feed section flying in
  // as it's scrolled into view.
  useEffect(() => {
    let ctx: ReturnType<typeof import("gsap").gsap.context> | undefined;
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      gsapRef.current = gsap;
      setGsapReady(true);

      ctx = gsap.context(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const ease = "power3.out";

        // The quick-access nav (Discover/Sparks/Support/Shop) keeps its
        // original CSS-only bx-pop entrance instead of joining this
        // timeline: a JS-driven `.from()` sets opacity:0 up front and
        // depends on this script running to reveal it again, whereas a CSS
        // keyframe animation always settles at its end state on its own -
        // this is core navigation, so it must never depend on GSAP loading
        // successfully to become visible.
        const tl = gsap.timeline({ defaults: { ease, duration: reduceMotion ? 0.01 : 0.75 } });
        tl.from(heroGreetingRef.current, { y: 16, opacity: 0 })
          .from(heroTitleRef.current, { y: 26, opacity: 0, scale: 0.97 }, "-=0.4")
          .from(heroSubtitleRef.current, { y: 12, opacity: 0 }, "-=0.35")
          .from(heroBellRef.current, { scale: 0, opacity: 0, duration: 0.5 }, "-=0.45");

        if (statsRef.current) {
          gsap.from(statsRef.current, {
            y: 18,
            opacity: 0,
            duration: reduceMotion ? 0.01 : 0.6,
            ease,
            delay: reduceMotion ? 0 : 0.15,
          });
        }

        for (const ref of [discoverRef, friendsRef, sparksRef, newsRef, ctaRef]) {
          if (!ref.current) continue;
          gsap.from(ref.current, {
            y: 50,
            opacity: 0,
            duration: reduceMotion ? 0.01 : 0.75,
            ease,
            scrollTrigger: { trigger: ref.current, start: "top 88%" },
          });
        }
      }, rootRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  // Sections below the hero go from an empty-state card to populated content
  // as their queries resolve, which shifts page layout — nudge ScrollTrigger
  // to recompute trigger positions once that settles.
  useEffect(() => {
    if (!gsapReady) return;
    const raf = requestAnimationFrame(() => {
      void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => ScrollTrigger.refresh());
    });
    return () => cancelAnimationFrame(raf);
  }, [gsapReady, following.data, sparkMatches.data, latest.data]);

  // A gentle ambient pulse on the bell once there's something unread, so the
  // page never looks static — mirrors the CTA glow pulse on the landing page.
  useEffect(() => {
    const gsap = gsapRef.current;
    const bell = heroBellRef.current;
    if (!gsap || !bell || !gsapReady || !counters.data?.unread) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.to(bell, {
      keyframes: [{ scale: 1.12 }, { scale: 1 }],
      duration: 1.6,
      repeat: -1,
      ease: "sine.inOut",
    });
    return () => {
      tween.kill();
      gsap.set(bell, { scale: 1 });
    };
  }, [gsapReady, counters.data?.unread]);

  function magnetize(e: React.MouseEvent<HTMLElement>) {
    const gsap = gsapRef.current;
    if (!gsap) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    gsap.to(el, { x: relX * 0.15, y: relY * 0.3, duration: 0.4, ease: "power2.out" });
  }
  function unmagnetize(e: React.MouseEvent<HTMLElement>) {
    const gsap = gsapRef.current;
    if (!gsap) return;
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" });
  }

  const quickAccess = [
    { to: "/discover" as const, label: t("discover"), icon: Compass, tint: "from-fuchsia-500 to-purple-600" },
    { to: "/sparks" as const, label: t("sparks"), icon: Flame, tint: "from-orange-500 to-rose-500" },
    { to: "/support" as const, label: t("support"), icon: LifeBuoy, tint: "from-sky-500 to-cyan-500" },
    { to: "/shop" as const, label: t("shop"), icon: ShoppingBag, tint: "from-emerald-500 to-teal-500" },
  ];

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl px-4 pb-28 pt-4 lg:pb-12">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[2rem] border border-border">
        <img
          src={heroAsset.url}
          alt="Roblox avatar in action"
          className="h-48 w-full object-cover sm:h-60"
          loading="eager"
        />
        <div className="absolute inset-0 opacity-70">
          <ThreeBackground />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        <div className="absolute inset-0 flex flex-col justify-between p-4 pb-8">
          <div className="flex items-start justify-between gap-2">
            <LogoWordmark className="h-8 w-auto shrink-0 bx-float" forceVariant="dark" />
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/40 p-1.5 backdrop-blur-xl">
              <Link
                ref={heroBellRef}
                to="/messages"
                aria-label="Notifications"
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/10 active:scale-90"
              >
                <Bell className="h-4.5 w-4.5" />
                {counters.data?.unread ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-black/40">
                    {counters.data.unread > 9 ? "9+" : counters.data.unread}
                  </span>
                ) : null}
              </Link>
              <div className="h-5 w-px shrink-0 bg-white/15" />
              <Link
                to="/shop"
                aria-label="Blox"
                className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-black text-white transition hover:bg-white/10 active:scale-95"
              >
                <BloxIcon className="h-4 w-4 shrink-0" />
                {(blox.data ?? 0).toLocaleString()}
              </Link>
            </div>
          </div>
          <div>
            <p
              ref={heroGreetingRef}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85 backdrop-blur"
            >
              {hello.emoji} {hello.text}
            </p>
            <h1
              ref={heroTitleRef}
              className="mt-2.5 flex items-center gap-2 text-2xl font-black text-white drop-shadow sm:text-3xl"
            >
              <span className="truncate">
                {me.data?.username ? `@${me.data.username}` : "player"}
              </span>
              {me.data?.roblox_avatar_url ? (
                <img
                  src={me.data.roblox_avatar_url}
                  alt={me.data.roblox_username ?? "Roblox avatar"}
                  className="h-6 w-6 shrink-0 rounded-full object-cover ring-2 ring-white/50"
                />
              ) : null}
              {me.data?.verified ? <Verified className="h-5 w-5 shrink-0" /> : null}
            </h1>
            <p ref={heroSubtitleRef} className="mt-0.5 text-xs text-white/70">
              {t("homeToday")}
            </p>
          </div>
        </div>
      </header>

      {/* Stats strip - floats up over the hero's bottom edge */}
      <div
        ref={statsRef}
        className="relative z-10 -mt-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[1.5rem] border border-border bg-card/95 shadow-lg shadow-black/5 backdrop-blur-xl"
      >
        <Link
          to="/sparks"
          className="flex flex-col items-center gap-0.5 py-3 transition hover:bg-surface-2"
        >
          <span className="flex items-center gap-1 text-base font-black">
            <Users className="h-3.5 w-3.5 text-primary" /> {counters.data?.followers ?? 0}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("friends")}
          </span>
        </Link>
        <Link
          to="/sparks"
          className="flex flex-col items-center gap-0.5 py-3 transition hover:bg-surface-2"
        >
          <span className="flex items-center gap-1 text-base font-black">
            <Flame className="h-3.5 w-3.5 text-orange-500" /> {counters.data?.matches ?? 0}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("matches")}
          </span>
        </Link>
        <Link
          to="/shop"
          className="flex flex-col items-center gap-0.5 py-3 transition hover:bg-surface-2"
        >
          <span className="flex items-center gap-1 text-base font-black">
            <BloxIcon className="h-3.5 w-3.5" /> {(blox.data ?? 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Blox
          </span>
        </Link>
      </div>

      <nav
        ref={navRef}
        className="mt-6 grid grid-cols-4 gap-2"
        aria-label={t("quickAccess")}
      >
        {quickAccess.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            onMouseMove={magnetize}
            onMouseLeave={unmagnetize}
            className={cn(
              "bx-pop flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-3.5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
              `bx-delay-${i + 1}`,
            )}
          >
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm",
                item.tint,
              )}
            >
              <item.icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* 1. Découvrir - vidéos du moment */}
      <div ref={discoverRef} className="mt-8">
        <section>
          <SectionHeader
            emoji="🧭"
            title={t("discover")}
            action={{ to: "/discover", label: t("seeAll") }}
          />
          {latest.data?.length ? (
            <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
              {latest.data.map((v) => (
                <VideoThumb key={v.id} id={v.id} path={v.storage_path} views={v.views_count} />
              ))}
            </div>
          ) : (
            <Card className="text-center text-sm text-muted-foreground">
              {t("noVideos")}{" "}
              <Link to="/discover" className="font-semibold text-primary">
                {t("publishFirst")}
              </Link>
            </Card>
          )}
        </section>
      </div>

      {/* 2. Amis / Abonnements */}
      <div ref={friendsRef} className="mt-8">
        <section>
          <SectionHeader emoji="👥" title={t("friends")} />
          {following.data?.length ? (
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {following.data.map((f) => {
                return (
                  <Link
                    key={f.id}
                    to="/messages"
                    className="bx-pop flex w-16 shrink-0 flex-col items-center gap-1.5"
                  >
                    <span className="relative">
                      <span className="block h-14 w-14 overflow-hidden rounded-full spark-gradient p-[2px]">
                        <StoredImage
                          path={f.avatar_url}
                          alt={f.username ?? ""}
                          className="h-full w-full rounded-full"
                          fallback="🎮"
                        />
                      </span>
                      <PresenceDot profile={f} className="absolute bottom-0 right-0 h-3.5 w-3.5" />
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-semibold">
                      {f.username ?? "player"}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="text-center text-sm text-muted-foreground">
              {t("noFriendsYet")}{" "}
              <Link to="/sparks" className="font-semibold text-primary">
                {t("findFirstSpark")}
              </Link>
            </Card>
          )}
        </section>
      </div>

      {/* 3. Mes matchs Sparks */}
      <div ref={sparksRef} className="mt-8">
        <section>
          <SectionHeader
            emoji="🔥"
            title={t("matches")}
            action={{ to: "/sparks", label: t("seeAll") }}
          />
          {sparkMatches.data?.length ? (
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {sparkMatches.data.map((m) => (
                <Link
                  key={m.id}
                  to="/messages"
                  className="bx-pop flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span className="block h-14 w-14 overflow-hidden rounded-full spark-gradient p-[2px]">
                    <StoredImage
                      path={m.avatar_url}
                      alt={m.username ?? ""}
                      className="h-full w-full rounded-full"
                      fallback="🔥"
                    />
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-semibold">
                    {m.username ?? "player"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="text-center text-sm text-muted-foreground">
              {t("noSparkMatches")}{" "}
              <Link to="/sparks" className="font-semibold text-primary">
                {t("swipeMatch")}
              </Link>
            </Card>
          )}
        </section>
      </div>

      {/* 4. Actualités Roblox */}
      <div ref={newsRef} className="mt-8">
        <NewsSection />
      </div>

      {/* 5. CTA - poster du contenu */}
      <div ref={ctaRef} className="mt-8 mb-4">
        <Link
          to="/discover/studio"
          onMouseMove={magnetize}
          onMouseLeave={unmagnetize}
          className="spark-gradient bx-glow group relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] p-5 text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl">
            🎬
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black">{t("postCtaTitle")}</span>
            <span className="block text-sm text-white/85">{t("postCtaText")}</span>
          </span>
          <ArrowUpRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">{t("notAffiliated")}</p>
    </div>
  );
}

function VideoThumb({ id, path, views }: { id: string; path: string; views: number }) {
  const url = useSignedUrl(path);
  return (
    <Link
      to="/discover"
      search={{ v: id }}
      className="group relative w-24 shrink-0 overflow-hidden rounded-2xl bg-black shadow-sm transition hover:-translate-y-0.5 sm:w-28"
    >
      {url ? (
        <video
          src={url}
          muted
          playsInline
          className="aspect-[9/16] w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="aspect-[9/16] w-full animate-pulse bg-surface-2" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 to-transparent" />
      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow">
        ▶️ {views}
      </span>
    </Link>
  );
}
