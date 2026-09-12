import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Compass, Flame, MessageCircle, Play, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { Logo } from "@/components/Logo";
import { useSignedUrl } from "@/components/Media";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Accueil — Bloxspark" },
      {
        name: "description",
        content: "Ton fil Bloxspark : nouveaux sparks, messages et vidéos des joueurs Roblox que tu suis.",
      },
      { property: "og:title", content: "Accueil — Bloxspark" },
      { property: "og:description", content: "Retrouve tes sparks, tes messages et tes vidéos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useSession();

  const me = useQuery({
    queryKey: ["me-home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").eq("id", user!.id).maybeSingle();
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

  const latest = useQuery({
    queryKey: ["home-latest-videos"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("id,caption,storage_path,views_count")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 lg:pb-12">
      <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <Logo className="mb-2 h-9 w-auto" />
          <h1 className="truncate text-2xl font-black">
            Salut {me.data?.username ? `@${me.data.username}` : "👋"}
          </h1>
          <p className="text-sm text-muted-foreground">Voici ce qui bouge sur Bloxspark aujourd'hui.</p>
        </div>
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border"
        >
          <Bell className="h-5 w-5" />
          {counters.data?.unread ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {counters.data.unread > 9 ? "9+" : counters.data.unread}
            </span>
          ) : null}
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Matchs", value: counters.data?.matches ?? 0, icon: Sparkles },
          { label: "Abonnés", value: counters.data?.followers ?? 0, icon: Users },
          { label: "Alertes", value: counters.data?.unread ?? 0, icon: Bell },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <s.icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
            <p className="text-xl font-black">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <QuickLink to="/sparks" icon={Flame} title="Sparks" sub="Swipe et trouve ton match" />
        <QuickLink to="/decouvrir" icon={Compass} title="Découvrir" sub="Le feed vidéo Roblox" />
        <QuickLink to="/messages" icon={MessageCircle} title="Messages" sub="Vocaux, groupes et emojis" />
      </div>

      <section>
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
            Pas encore de vidéo. <Link to="/decouvrir" className="font-semibold text-primary">Publie la première !</Link>
          </Card>
        )}
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
      className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 transition hover:border-primary"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl spark-gradient text-white">
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
    <Link to="/decouvrir" className="relative overflow-hidden rounded-xl bg-black">
      {url ? (
        <video src={url} muted playsInline className="aspect-[9/16] w-full object-cover" />
      ) : (
        <div className="aspect-[9/16] w-full animate-pulse bg-surface-2" />
      )}
      <span className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow">
        <Play className="h-3 w-3" /> {views}
      </span>
    </Link>
  );
}
