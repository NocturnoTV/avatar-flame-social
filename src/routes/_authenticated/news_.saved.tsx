import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { newsCategoryBadgeClass, newsCategoryLabel } from "@/lib/newsCategories";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/news_/saved")({
  head: () => ({
    meta: [
      { title: "Actualités enregistrées - BloxSpark" },
      {
        name: "description",
        content: "Tes articles d'actualité Roblox mis de côté pour plus tard sur BloxSpark.",
      },
    ],
  }),

  component: SavedNewsPage,
});

function SavedNewsPage() {
  const { user } = useSession();

  const saved = useQuery({
    queryKey: ["news-saved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("news_article_saves")
        .select("article_id,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.article_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("news_articles")
        .select("id,title,excerpt,slug,image_url,category,published_at,created_at")
        .in("id", ids);
      const byId = new Map((data ?? []).map((a) => [a.id, a]));
      return ids
        .map((id) => byId.get(id))
        .filter((a): a is NonNullable<typeof a> => a !== undefined);
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-4">
      <header className="flex items-center gap-3">
        <Link
          to="/news"
          aria-label="Retour"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black text-white">Enregistrés</h1>
      </header>

      {!saved.isLoading && !(saved.data ?? []).length ? (
        <div className="mt-14 flex flex-col items-center text-center">
          <Bookmark className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold">Aucun article enregistré</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enregistre des actualités pour les retrouver ici.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {(saved.data ?? []).map((a) => (
          <Link
            key={a.id}
            to="/news/$slug"
            params={{ slug: a.slug }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2"
          >
            <StoredImage
              path={a.image_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
              fallback="📰"
            />
            <div className="min-w-0 flex-1 py-1">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  newsCategoryBadgeClass(a.category),
                )}
              >
                {newsCategoryLabel(a.category)}
              </span>
              <p className="mt-1 truncate text-sm font-bold text-white">{a.title}</p>
              {a.excerpt ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">{a.excerpt}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
