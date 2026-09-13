import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Bell, Compass, Flame, LifeBuoy, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { LogoWordmark } from "@/components/Logo";
import { useSignedUrl, StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import heroAsset from "@/assets/onboarding-hero.png.asset.json";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Bloxspark" },
      {
        name: "description",
        content: "Your Bloxspark feed: friends, trending videos and today's Roblox news.",
      },
      { property: "og:title", content: "Home — Bloxspark" },
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
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{emoji}</span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {action ? (
        <Link to={action.to} className="text-sm font-semibold text-primary">
          {action.label}
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

  // Amis / Abonnements — people the user follows.
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
        .select("id,username,avatar_url,verified,last_active_at")
        .in("id", ids)
        .order("last_active_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  // Mes matchs Sparks — mutual matches from the swipe deck.
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
        .order("views_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 lg:pb-12">
      {/* Hero — stays pinned at the top */}
      <header className="bx-rise relative overflow-hidden rounded-[2rem] border border-border">
        <img
          src={heroAsset.url}
          alt="Roblox avatar in action"
          className="h-44 w-full object-cover sm:h-56"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between">
            <LogoWordmark className="h-8 w-auto bx-float" forceVariant="dark" />
            <div className="flex items-center gap-2">
              <Link
                to="/messages"
                aria-label="Notifications"
                className="relative grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition active:scale-90"
              >
                <Bell className="h-5 w-5" />
                {counters.data?.unread ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {counters.data.unread > 9 ? "9+" : counters.data.unread}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80">
              {hello.emoji} {hello.text}
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-black text-white drop-shadow sm:text-3xl">
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
            <p className="text-xs text-white/75">{t("homeToday")}</p>
          </div>
        </div>
      </header>

      <nav
        className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1"
        aria-label={t("quickAccess")}
      >
        {[
          { to: "/discover", label: t("discover"), icon: Compass },
          { to: "/sparks", label: t("sparks"), icon: Flame },
          { to: "/support", label: t("support"), icon: LifeBuoy },
          { to: "/shop", label: t("shop"), icon: ShoppingBag },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bx-pop flex min-w-[112px] flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary transition hover:border-primary/40 hover:bg-primary/15"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* 1. Découvrir — vidéos du moment */}
      <Reveal className="mt-8">
        <section>
          <SectionHeader
            emoji="🧭"
            title={t("discover")}
            action={{ to: "/discover", label: t("seeAll") }}
          />
          {latest.data?.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {latest.data.map((v) => (
                <VideoThumb key={v.id} path={v.storage_path} views={v.views_count} />
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
      </Reveal>

      {/* 2. Amis / Abonnements */}
      <Reveal className="mt-8">
        <section>
          <SectionHeader emoji="👥" title={t("friends")} />
          {following.data?.length ? (
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {following.data.map((f) => {
                const online = f.last_active_at
                  ? Date.now() - new Date(f.last_active_at).getTime() < 5 * 60 * 1000
                  : false;
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
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background",
                          online ? "bg-sky-400" : "bg-muted-foreground/50",
                        )}
                      />
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
      </Reveal>

      {/* 3. Mes matchs Sparks */}
      <Reveal className="mt-8">
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
      </Reveal>

      {/* 4. Actualités Roblox */}
      <Reveal className="mt-8">
        <NewsSection />
      </Reveal>

      {/* 5. CTA — poster du contenu */}
      <Reveal className="mt-8 mb-4">
        <Link
          to="/discover/studio"
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
      </Reveal>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">{t("notAffiliated")}</p>
    </div>
  );
}

function VideoThumb({ path, views }: { path: string; views: number }) {
  const url = useSignedUrl(path);
  return (
    <Link
      to="/discover"
      className="group relative overflow-hidden rounded-2xl bg-black transition hover:-translate-y-0.5"
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
      <span className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow">
        ▶️ {views}
      </span>
    </Link>
  );
}
