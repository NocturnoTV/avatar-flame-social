import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Newspaper, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { NEWS_CATEGORIES, newsCategoryBadgeClass, newsCategoryLabel } from "@/lib/newsCategories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/news/all")({
  head: () => ({ meta: [{ title: "Toutes les actualités — Bloxspark" }] }),
  component: AllNewsPage,
});

const PAGE_SIZE = 20;

function AllNewsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);

  const articles = useQuery({
    queryKey: ["news-all", search.trim(), category, page],
    queryFn: async () => {
      let query = supabase
        .from("news_articles")
        .select("id,title,excerpt,slug,image_url,category,published_at,created_at", { count: "exact" })
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (category !== "all") query = query.eq("category", category);
      if (search.trim()) query = query.or(`title.ilike.%${search.trim()}%,excerpt.ilike.%${search.trim()}%`);
      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  const hasMore = (articles.data?.total ?? 0) > (page + 1) * PAGE_SIZE;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-4">
      <header className="flex items-center gap-3">
        <Link to="/news" aria-label="Retour" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black text-white">Toutes les actualités</h1>
      </header>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Rechercher..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setCategory("all");
            setPage(0);
          }}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold",
            category === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
          )}
        >
          Tous
        </button>
        {NEWS_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.id);
              setPage(0);
            }}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold",
              category === c.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {!articles.isLoading && !(articles.data?.rows.length ?? 0) ? (
        <div className="mt-14 flex flex-col items-center text-center">
          <Newspaper className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">Aucune actualité trouvée</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {(articles.data?.rows ?? []).map((a) => (
          <Link
            key={a.id}
            to="/news/$slug"
            params={{ slug: a.slug }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 transition hover:border-primary/30"
          >
            <StoredImage path={a.image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" fallback="📰" />
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", newsCategoryBadgeClass(a.category))}>
                  {newsCategoryLabel(a.category)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(a.published_at ?? a.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-bold text-white">{a.title}</p>
              {a.excerpt ? <p className="line-clamp-1 text-xs text-muted-foreground">{a.excerpt}</p> : null}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex justify-center gap-3">
        {page > 0 ? (
          <button
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Précédent
          </button>
        ) : null}
        {hasMore ? (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Suivant
          </button>
        ) : null}
      </div>
    </div>
  );
}
