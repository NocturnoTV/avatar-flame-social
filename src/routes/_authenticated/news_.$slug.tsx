import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Heart,
  Link as LinkIcon,
  MessageCircle,
  Send,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { Sheet } from "@/components/ui-kit";
import { NewsArticleBody, parseArticleContent } from "@/components/NewsArticleBody";
import { newsCategoryBadgeClass, newsCategoryLabel } from "@/lib/newsCategories";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/news_/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("news_articles")
      .select("title,excerpt,published_at,created_at,source")
      .eq("slug", params.slug)
      .maybeSingle();
    return { article: data };
  },
  head: ({ params, loaderData }) => {
    const article = loaderData?.article;
    const title = article?.title ?? "Actualité Roblox";
    const description =
      article?.excerpt ?? "Toute l'actualité Roblox décryptée par la rédaction BloxSpark.";
    const url = `https://bloxspark.app/news/${params.slug}`;
    return {
      meta: [
        { title: `${title} - BloxSpark` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: article
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                headline: article.title,
                description: article.excerpt ?? undefined,
                datePublished: article.published_at ?? article.created_at,
                dateModified: article.published_at ?? article.created_at,
                mainEntityOfPage: url,
                author: { "@type": "Organization", name: article.source || "BloxSpark" },
                publisher: { "@type": "Organization", name: "BloxSpark" },
              }),
            },
          ]
        : [],
    };
  },
  component: ArticlePage,
});


function ArticlePage() {
  const { slug } = Route.useParams();
  const { user } = useSession();
  const [shareOpen, setShareOpen] = useState(false);
  const [comment, setComment] = useState("");

  const article = useQuery({
    queryKey: ["news-article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const articleId = article.data?.id;

  const author = useQuery({
    queryKey: ["news-article-author", article.data?.author_id],
    enabled: !!article.data?.author_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", article.data!.author_id!)
        .maybeSingle();
      return data;
    },
  });

  const myLike = useQuery({
    queryKey: ["news-article-my-like", articleId, user?.id],
    enabled: !!articleId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("news_article_likes")
        .select("article_id")
        .eq("article_id", articleId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const mySave = useQuery({
    queryKey: ["news-article-my-save", articleId, user?.id],
    enabled: !!articleId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("news_article_saves")
        .select("article_id")
        .eq("article_id", articleId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const comments = useQuery({
    queryKey: ["news-article-comments", articleId],
    enabled: !!articleId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("news_article_comments")
        .select("id,user_id,content,created_at")
        .eq("article_id", articleId!)
        .order("created_at");
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username,avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, author: byId.get(r.user_id) }));
    },
  });

  const related = useQuery({
    queryKey: ["news-article-related", article.data?.category, articleId],
    enabled: !!article.data,
    queryFn: async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("id,title,slug,image_url")
        .eq("category", article.data!.category)
        .neq("id", articleId!)
        .order("published_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  async function toggleLike() {
    if (!user || !articleId) return;
    if (myLike.data) {
      await supabase
        .from("news_article_likes")
        .delete()
        .eq("article_id", articleId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("news_article_likes").insert({ article_id: articleId, user_id: user.id });
    }
    void myLike.refetch();
    void article.refetch();
  }

  async function toggleSave() {
    if (!user || !articleId) return;
    if (mySave.data) {
      await supabase
        .from("news_article_saves")
        .delete()
        .eq("article_id", articleId)
        .eq("user_id", user.id);
      toast.message("Retiré des enregistrés.");
    } else {
      await supabase.from("news_article_saves").insert({ article_id: articleId, user_id: user.id });
      toast.success("Ajouté à Enregistrés.");
    }
    void mySave.refetch();
  }

  async function sendComment() {
    if (!user || !articleId || !comment.trim()) return;
    const { error } = await supabase.from("news_article_comments").insert({
      article_id: articleId,
      user_id: user.id,
      content: comment.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setComment("");
    void comments.refetch();
    void article.refetch();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Lien copié.");
    } catch {
      toast.error("Impossible de copier le lien.");
    }
    setShareOpen(false);
  }

  async function shareViaSystem() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.data?.title ?? "BloxSpark",
          url: window.location.href,
        });
      } catch {
        // Cancelled - nothing to do.
      }
    } else {
      await copyLink();
    }
    setShareOpen(false);
  }

  const a = article.data;
  if (article.isLoading) return null;
  if (!a) {
    return (
      <div className="mx-auto max-w-xl px-5 pt-10 text-center text-sm text-muted-foreground">
        Cette actualité n'existe pas ou plus.
      </div>
    );
  }

  const headings = parseArticleContent(a.content).filter((b) => b.type === "heading");
  const isExternalSource = a.source.toLowerCase() !== "bloxspark";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <Link
          to="/news"
          aria-label="Retour"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="text-sm font-bold text-muted-foreground">Actualité</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void toggleSave()}
            aria-label="Enregistrer"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
          >
            <Bookmark className="h-5 w-5" fill={mySave.data ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="Partager"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mt-4 aspect-video w-full overflow-hidden rounded-3xl bg-surface-2">
        <StoredImage
          path={a.image_url}
          alt=""
          className="h-full w-full object-cover"
          fallback="📰"
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${newsCategoryBadgeClass(a.category)}`}
        >
          ✦ {newsCategoryLabel(a.category)}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(a.published_at ?? a.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-black leading-tight text-white">{a.title}</h1>
      {a.excerpt ? (
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{a.excerpt}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-2.5">
        <StoredImage
          path={author.data?.avatar_url}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
          fallback="B"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-bold text-white">
            {author.data?.username ?? "Équipe Bloxspark"}
            <Verified className="h-3.5 w-3.5" />
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(a.published_at ?? a.created_at).toLocaleDateString("fr-FR")} ·{" "}
            {a.reading_time_minutes} min de lecture
          </p>
        </div>
      </div>

      {isExternalSource ? (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          Source externe : <span className="font-semibold text-white">{a.source}</span>
          {a.source_url ? (
            <a
              href={a.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-1 font-semibold text-primary"
            >
              Lire la source originale →
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Source : {a.source}</p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => void toggleLike()}
          className={`flex items-center gap-1.5 rounded-full bg-[#151722] px-4 py-2 text-sm font-bold ${myLike.data ? "text-primary" : "text-white"}`}
        >
          <Heart className="h-4 w-4" fill={myLike.data ? "currentColor" : "none"} /> {a.likes_count}
        </button>
        <button
          onClick={() => void toggleSave()}
          className={`flex items-center gap-1.5 rounded-full bg-[#151722] px-4 py-2 text-sm font-bold ${mySave.data ? "text-primary" : "text-white"}`}
        >
          <Bookmark className="h-4 w-4" fill={mySave.data ? "currentColor" : "none"} /> Enregistrer
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#151722] px-4 py-2 text-sm font-bold text-white"
        >
          <Share2 className="h-4 w-4" /> Partager
        </button>
      </div>

      {headings.length > 1 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase text-muted-foreground">Dans cet article</p>
          <div className="mt-2 space-y-1.5">
            {headings.map((h) => (
              <a key={h.id} href={`#${h.id}`} className="block text-sm font-semibold text-primary">
                {h.text}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <NewsArticleBody content={a.content} />
      </div>

      {a.key_points.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <p className="font-black text-white">Principales nouveautés</p>
          <div className="mt-3 space-y-2.5">
            {a.key_points.map((point, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <p className="text-sm text-white/85">{point}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(related.data ?? []).length > 0 ? (
        <div className="mt-8 border-t border-border pt-6">
          <p className="font-black text-white">À lire ensuite</p>
          <div className="mt-3 space-y-2">
            {(related.data ?? []).map((r) => (
              <Link
                key={r.id}
                to="/news/$slug"
                params={{ slug: r.slug }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2"
              >
                <StoredImage
                  path={r.image_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  fallback="📰"
                />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {r.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 border-t border-border pt-6">
        <p className="font-black text-white">
          <MessageCircle className="mr-1.5 inline h-4 w-4" />
          {a.comments_count} commentaire{a.comments_count > 1 ? "s" : ""}
        </p>
        {user ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Ajouter un commentaire..."
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none"
            />
            <button
              onClick={() => void sendComment()}
              disabled={!comment.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full spark-gradient text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {(comments.data ?? []).map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <StoredImage
                path={c.author?.avatar_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
                fallback="?"
              />
              <div className="min-w-0 flex-1 rounded-2xl bg-surface px-3 py-2">
                <p className="text-xs font-bold text-white">{c.author?.username ?? "?"}</p>
                <p className="mt-0.5 text-sm text-white/85">{c.content}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Partager">
        <div className="space-y-2">
          <button
            onClick={() => void copyLink()}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left text-sm font-semibold"
          >
            <LinkIcon className="h-4 w-4 text-primary" /> Copier le lien
          </button>
          <button
            onClick={() => void shareViaSystem()}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left text-sm font-semibold"
          >
            <Share2 className="h-4 w-4 text-primary" /> Partager via le système du téléphone
          </button>
        </div>
      </Sheet>
    </div>
  );
}
