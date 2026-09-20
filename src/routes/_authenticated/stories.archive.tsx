import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { VideoThumb } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { Button, Input, Sheet } from "@/components/ui-kit";
import { StoryViewerFull, type StoryRow } from "@/components/StoryViewerFull";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/stories/archive")({
  head: () => ({ meta: [{ title: "Story archive - Bloxspark" }] }),
  component: StoryArchivePage,
});

function StoryArchivePage() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [highlightSheetOpen, setHighlightSheetOpen] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const archive = useQuery({
    queryKey: ["story-archive", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<StoryRow[]> => {
      const { data } = await supabase
        .from("stories")
        .select("id,user_id,media_url,media_type,thumbnail_path,caption,created_at,sound_id,metadata")
        .eq("user_id", user!.id)
        .lt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      return (data ?? []).map((s) => ({ ...s, metadata: s.metadata as StoryRow["metadata"] }));
    },
  });

  const profile = useQuery({
    queryKey: ["story-archive-profile", user?.id],
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

  const groups = archive.data?.length
    ? [
        {
          userId: user!.id,
          username: profile.data?.username ?? "moi",
          avatarUrl: profile.data?.avatar_url ?? null,
          stories: archive.data,
        },
      ]
    : [];

  const byMonth = new Map<string, StoryRow[]>();
  for (const s of archive.data ?? []) {
    const key = new Date(s.created_at).toLocaleDateString(lang, { month: "long", year: "numeric" });
    byMonth.set(key, [...(byMonth.get(key) ?? []), s]);
  }

  function toggleSelect(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function createHighlight() {
    if (!user || !highlightTitle.trim() || !selected.length) return;
    setSaving(true);
    try {
      const { data: highlight, error } = await supabase
        .from("story_highlights")
        .insert({ user_id: user.id, title: highlightTitle.trim() })
        .select("id")
        .single();
      if (error) throw error;
      const { error: itemsError } = await supabase.from("story_highlight_items").insert(
        selected.map((storyId, index) => ({
          highlight_id: highlight.id,
          story_id: storyId,
          position: index,
        })),
      );
      if (itemsError) throw itemsError;
      toast.success(t("highlightCreated"));
      setHighlightSheetOpen(false);
      setSelecting(false);
      setSelected([]);
      setHighlightTitle("");
      void qc.invalidateQueries({ queryKey: ["profile-highlights", user.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <Link to="/profile" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-bold">{t("storyArchiveTitle")}</h1>
        {(archive.data ?? []).length > 0 ? (
          <button
            onClick={() => {
              setSelecting((v) => !v);
              setSelected([]);
            }}
            className="text-sm font-bold text-primary"
          >
            {selecting ? t("cancel") : t("storyCreateHighlight")}
          </button>
        ) : null}
      </header>

      {selecting && selected.length > 0 ? (
        <Button className="mt-4 w-full" onClick={() => setHighlightSheetOpen(true)}>
          <Sparkles className="h-4 w-4" />
          {t("storyCreateHighlightWithCount", { count: selected.length })}
        </Button>
      ) : null}

      {!(archive.data ?? []).length ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t("storyArchiveEmpty")}</p>
      ) : (
        [...byMonth.entries()].map(([month, items]) => (
          <div key={month} className="mt-6">
            <p className="mb-2 text-sm font-bold capitalize text-muted-foreground">{month}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((s) => {
                const globalIndex = (archive.data ?? []).findIndex((x) => x.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => (selecting ? toggleSelect(s.id) : setViewerIndex(globalIndex))}
                    className="relative"
                  >
                    <VideoThumb
                      storagePath={s.media_url}
                      thumbnailPath={s.thumbnail_path}
                      className="aspect-[9/16] w-full rounded-xl"
                    />
                    {selecting ? (
                      <span
                        className={cn(
                          "absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white",
                          selected.includes(s.id) ? "bg-primary" : "bg-black/40",
                        )}
                      >
                        {selected.includes(s.id) ? <Check className="h-3 w-3 text-white" /> : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Sheet
        open={highlightSheetOpen}
        onClose={() => setHighlightSheetOpen(false)}
        title={t("storyCreateHighlight")}
      >
        <Input
          value={highlightTitle}
          onChange={(e) => setHighlightTitle(e.target.value)}
          placeholder={t("storyHighlightTitlePlaceholder")}
          maxLength={30}
        />
        <Button
          className="mt-4 w-full"
          disabled={!highlightTitle.trim() || saving}
          onClick={() => void createHighlight()}
        >
          {saving ? "…" : t("save")}
        </Button>
      </Sheet>

      {viewerIndex !== null && groups.length ? (
        <StoryViewerFull
          groups={groups}
          startGroupIndex={0}
          startStoryIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChanged={() => void archive.refetch()}
        />
      ) : null}
    </div>
  );
}
