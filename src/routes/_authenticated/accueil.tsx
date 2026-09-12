import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Bell, Compass, Flame, MessageCircle, Play, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { Logo } from "@/components/Logo";
import { useSignedUrl, StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { cn } from "@/lib/utils";
import heroAsset from "@/assets/onboarding-hero.png.asset.json";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Accueil — Bloxspark" },
      {
        name: "description",
        content: "Ton fil Bloxspark : amis connectés, vidéos du moment et actus Roblox du jour.",
      },
      { property: "og:title", content: "Accueil — Bloxspark" },
      { property: "og:description", content: "Amis connectés, vidéos du moment et actus Roblox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function greeting(h: number) {
  if (h >= 5 && h < 12) return { text: "Bon matin", emoji: "🌅" };
  if (h >= 12 && h < 18) return { text: "Bonjour", emoji: "☀️" };
  if (h >= 18 && h < 23) return { text: "Bonsoir", emoji: "🌆" };
  return { text: "Bonne nuit", emoji: "🌙" };
}

const NEWS = [
  {
    title: "Les nouveautés de la plateforme Roblox",
    sub: "Mises à jour moteur, avatars et créateurs",
    url: "https://blog.roblox.com/",
    tone: "from-blue-500 to-cyan-400",
  },
  {
    title: "Les jeux les plus joués du moment",
    sub: "Le top des expériences Roblox",
    url: "https://www.roblox.com/charts",
    tone: "from-amber-400 to-yellow-300",
  },
  {
    title: "Événements et items limités",
    sub: "Ne rate pas les drops de la semaine",
    url: "https://www.roblox.com/catalog",
    tone: "from-fuchsia-500 to-pink-400",
  },
];

function HomePage() {
  const { user } = useSession();
  const hour = new Date().getHours();
  const hello = greeting(hour);

  const me = useQuery({
    queryKey: ["me-home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url,verified")
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
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user!.id),
        supabase.from("matches").select("conversation_id", { count: "exact", head: true }),
      ]);
      return {
        unread: notif.count ?? 0,
        followers: followers.count ?? 0,
        matches: matches.count ?? 0,
      };
    },
  });

  const friends = useQuery({
    queryKey: ["home-friends", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data: follows } = await supabase.from("follows").select("following_id");
      const { data: matches } = await supabase.from("matches").select("user_a,user_b");
      const ids = new Set<string>();
      for (const f of follows ?? []) ids.add(f.following_id);
      for (const m of matches ?? []) {
        if (m.user_a !== user!.id) ids.add(m.user_a);
        if (m.user_b !== user!.id) ids.add(m.user_b);
      }
      ids.delete(user!.id);
      if (ids.size === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,verified,last_active_at")
        .in("id", [...ids])
        .order("last_active_at", { ascending: false })
        .limit(12);
      return data ?? [];
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
      {/* Hero */}
      <header className="bx-rise relative overflow-hidden rounded-[2rem] border border-border">
        <img
          src={heroAsset.url}
          alt="Avatar Roblox en action"
          className="h-44 w-full object-cover sm:h-56"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between">
            <Logo className="h-8 w-auto bx-float" forceVariant="dark" />
            <Link
              to="/notifications"
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
          <div>
            <p className="text-sm font-semibold text-white/80">
              {hello.emoji} {hello.text}
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-black text-white drop-shadow sm:text-3xl">
              <span className="truncate">{me.data?.username ? `@${me.data.username}` : "joueur"}</span>
              {me.data?.verified ? <Verified className="h-5 w-5" /> : null}
            </h1>
            <p className="text-xs text-white/75">Voici ce qui bouge sur Bloxspark aujourd'hui.</p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Matchs", value: counters.data?.matches ?? 0, icon: Sparkles },
          { label: "Abonnés", value: counters.data?.followers ?? 0, icon: Users },
          { label: "Alertes", value: counters.data?.unread ?? 0, icon: Bell },
        ].map((s, i) => (
          <Card
            key={s.label}
            className={cn("bx-rise p-4 text-center transition hover:-translate-y-0.5", `bx-delay-${i + 1}`)}
          >
            <s.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
            <p className="text-xl font-black">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Amis connectés */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-black">Tes amis</h2>
        {friends.data?.length ? (
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {friends.data.map((f) => {
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
                        online ? "bg-emerald-400" : "bg-muted-foreground/50",
                      )}
                    />
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-semibold">
                    {f.username ?? "joueur"}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="text-center text-sm text-muted-foreground">
            Pas encore d'amis.{" "}
            <Link to="/sparks" className="font-semibold text-primary">
              Trouve ton premier spark !
            </Link>
          </Card>
        )}
      </section>

      {/* Raccourcis */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickLink to="/sparks" icon={Flame} title="Sparks" sub="Swipe et trouve ton match" />
        <QuickLink to="/decouvrir" icon={Compass} title="Découvrir" sub="Le feed vidéo Roblox" />
        <QuickLink to="/messages" icon={MessageCircle} title="Messages" sub="Vocaux, groupes et emojis" />
      </div>

      {/* Vidéos du moment */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Vidéos du moment</h2>
          <Link to="/decouvrir" className="text-sm font-semibold text-primary">
            Tout voir
          </Link>
        </div>
        {latest.data?.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {latest.data.map((v) => (
              <VideoThumb key={v.id} path={v.storage_path} views={v.views_count} />
            ))}
          </div>
        ) : (
          <Card className="text-center text-sm text-muted-foreground">
            Pas encore de vidéo.{" "}
            <Link to="/decouvrir" className="font-semibold text-primary">
              Publie la première !
            </Link>
          </Card>
        )}
      </section>

      {/* Actus Roblox */}
      <section className="mt-7">
        <h2 className="mb-3 text-lg font-black">Actus Roblox</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {NEWS.map((n, i) => (
            <a
              key={n.title}
              href={n.url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "bx-rise group relative overflow-hidden rounded-3xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary",
                `bx-delay-${i + 1}`,
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", n.tone)} />
              <p className="pr-6 font-bold leading-snug">{n.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.sub}</p>
              <ArrowUpRight className="absolute right-3 top-4 h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
            </a>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        Bloxspark n'est ni affilié, ni approuvé, ni sponsorisé par Roblox Corporation.
      </p>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  sub,
}: {
  to: "/sparks" | "/decouvrir" | "/messages";
  icon: typeof Flame;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary"
    >
      <span className="spark-gradient grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </Link>
  );
}

function VideoThumb({ path, views }: { path: string; views: number }) {
  const url = useSignedUrl(path);
  return (
    <Link
      to="/decouvrir"
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
        <Play className="h-3 w-3" /> {views}
      </span>
    </Link>
  );
}
