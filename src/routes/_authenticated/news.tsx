import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Newspaper, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { LogoWordmark } from "@/components/Logo";
import { Sheet } from "@/components/ui-kit";
import { NEWS_CATEGORIES, newsCategoryBadgeClass, newsCategoryLabel } from "@/lib/newsCategories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "Actualités Roblox - Bloxspark" },
      {
        name: "description",
        content: "Toute l'actualité Roblox : mises à jour, jeux, événements, créateurs et sécurité.",
      },
    ],
  }),
  component: NewsHomePage,
});

type ArticleCard = {
  id: string;
  title: string;
  excerpt: string | null;
  slug: string;
  image_url: string | null;
  category: string;
  featured: boolean;
  published_at: string | null;
  created_at: string;
};

function timeAgo(value: string, lang = "fr") {
  const elapsed = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (absolute < 3_600_000) return formatter.format(Math.round(elapsed / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(elapsed / 3_600_000), "hour");
  if (absolute < 604_800_000) return formatter.format(Math.round(elapsed / 86_400_000), "day");
  return new Date(value).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
}

function NewsHomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const [language, setLanguage] = useState<"all" | "fr" | "en">("all");

  const articles = useQuery({
    queryKey: ["news-home", search.trim(), category, period, language],
    queryFn: async (): Promise<ArticleCard[]> => {
      let query = supabase
        .from("news_articles")
        .select("id,title,excerpt,slug,image_url,category,featured,published_at,created_at,status,scheduled_for")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(60);
      if (category !== "all") query = query.eq("category", category);
      if (language !== "all") query = query.eq("language", language);
      if (search.trim()) query = query.or(`title.ilike.%${search.trim()}%,excerpt.ilike.%${search.trim()}%`);
      if (period !== "all") {
        const since =
          period === "today"
            ? new Date(Date.now() - 86_400_000)
            : period === "week"
              ? new Date(Date.now() - 7 * 86_400_000)
              : new Date(Date.now() - 30 * 86_400_000);
        query = query.gte("published_at", since.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      // RLS already filters to published/effectively-scheduled/admin-visible;
      // client just renders what comes back.
      return data ?? [];
    },
  });

  const featured = (articles.data ?? []).filter((a) => a.featured).slice(0, 5);
  const rest = (articles.data ?? []).filter((a) => !featured.some((f) => f.id === a.id));
  const [carouselIndex, setCarouselIndex] = useState(0);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <LogoWordmark className="h-7 w-auto" />
        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Filtrer les actualités"
          className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </header>

      <div className="mt-6 flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Newspaper className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-white">Actualités Roblox</h1>
          <p className="text-sm text-muted-foreground">Toute l'actualité Roblox, en un seul endroit.</p>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Reste informé des nouveautés, mises à jour, événements et tendances de la communauté.
      </p>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une actualité..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategory("all")}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
            category === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
          )}
        >
          Tous
        </button>
        {NEWS_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
              category === c.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {articles.isLoading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-surface-2" />
          ))}
        </div>
      ) : null}

      {!articles.isLoading && !(articles.data ?? []).length ? (
        <div className="mt-14 flex flex-col items-center text-center">
          <Newspaper className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">Aucune actualité trouvée</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nous n'avons trouvé aucune actualité correspondant à votre recherche.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("all");
              setPeriod("all");
              setLanguage("all");
            }}
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : null}

      {featured.length > 0 ? (
        <section className="mt-6">
          <div
            className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollLeft / el.clientWidth);
              setCarouselIndex(idx);
            }}
          >
            {featured.map((a) => (
              <Link
                key={a.id}
                to="/news/$slug"
                params={{ slug: a.slug }}
                className="relative block aspect-[4/5] w-full shrink-0 snap-start overflow-hidden rounded-[2rem] bg-surface-2"
              >
                <StoredImage path={a.image_url} alt="" className="h-full w-full object-cover" fallback="📰" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <span className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                  ✦ À la une
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                  {new Date(a.published_at ?? a.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h2 className="text-2xl font-black leading-tight text-white">{a.title}</h2>
                  {a.excerpt ? <p className="mt-1.5 text-sm text-white/80">{a.excerpt}</p> : null}
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#08090D]">
                    Lire l'article <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {featured.length > 1 ? (
            <div className="mt-3 flex justify-center gap-1.5">
              {featured.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === carouselIndex ? "w-5 bg-primary" : "w-1.5 bg-white/20",
                  )}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Dernières actualités</h2>
            <Link to="/news/all" className="flex items-center gap-1 text-sm font-semibold text-primary">
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {rest.slice(0, 12).map((a) => (
              <Link
                key={a.id}
                to="/news/$slug"
                params={{ slug: a.slug }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 transition hover:border-primary/30"
              >
                <StoredImage
                  path={a.image_url}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  fallback="📰"
                />
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", newsCategoryBadgeClass(a.category))}>
                      ✦ {newsCategoryLabel(a.category)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(a.published_at ?? a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-white">{a.title}</p>
                  {a.excerpt ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{a.excerpt}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrer les actualités">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Période</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Toutes"],
                  ["today", "Aujourd'hui"],
                  ["week", "Cette semaine"],
                  ["month", "Ce mois-ci"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPeriod(id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                    period === id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Langue</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Toutes"],
                  ["fr", "Français"],
                  ["en", "English"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setLanguage(id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                    language === id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setPeriod("all");
              setLanguage("all");
              setCategory("all");
            }}
            className="w-full rounded-full border border-border py-3 text-sm font-semibold text-muted-foreground"
          >
            Réinitialiser
          </button>
          <button
            onClick={() => setFiltersOpen(false)}
            className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Appliquer
          </button>
        </div>
      </Sheet>
    </div>
  );
}
