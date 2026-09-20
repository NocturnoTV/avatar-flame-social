import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { StoryViewerFull, type StoryRow } from "@/components/StoryViewerFull";

/** "Stories à la une" row shown on a profile - circular collections of
 * archived Stories the owner chose to keep pinned. Read-only for visitors;
 * the owner also gets a link into their archive to create new ones. */
export function StoryHighlightsRow({
  userId,
  username,
  avatarUrl,
  editable,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  editable?: boolean;
}) {
  const { t } = useI18n();
  const [openHighlightId, setOpenHighlightId] = useState<string | null>(null);

  const highlights = useQuery({
    queryKey: ["profile-highlights", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_highlights")
        .select("id,title,cover_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const items = useQuery({
    queryKey: ["highlight-items", openHighlightId],
    enabled: !!openHighlightId,
    queryFn: async (): Promise<StoryRow[]> => {
      const { data: links } = await supabase
        .from("story_highlight_items")
        .select("story_id,position")
        .eq("highlight_id", openHighlightId!)
        .order("position");
      const ids = (links ?? []).map((l) => l.story_id);
      if (!ids.length) return [];
      const { data: stories } = await supabase
        .from("stories")
        .select("id,user_id,media_url,media_type,thumbnail_path,caption,created_at,metadata")
        .in("id", ids);
      return ids
        .map((id) => stories?.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({ ...s, metadata: s.metadata as StoryRow["metadata"] }));
    },
  });

  if (!editable && !highlights.data?.length) return null;

  return (
    <section className="no-scrollbar mt-4 flex gap-4 overflow-x-auto">
      {(highlights.data ?? []).map((h) => (
        <button
          key={h.id}
          onClick={() => setOpenHighlightId(h.id)}
          className="w-[68px] shrink-0 text-center"
        >
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-border bg-surface-2 p-1">
            {h.cover_path ? (
              <StoredImage path={h.cover_path} alt="" className="h-full w-full rounded-full object-cover" fallback="✨" />
            ) : (
              <span className="text-xl">✨</span>
            )}
          </span>
          <span className="mt-1 block truncate text-xs font-semibold">{h.title}</span>
        </button>
      ))}
      {editable ? (
        <Link to="/stories/archive" className="w-[68px] shrink-0 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground">
            +
          </span>
          <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">
            {t("storyArchiveTitle")}
          </span>
        </Link>
      ) : null}

      {openHighlightId && items.data?.length ? (
        <StoryViewerFull
          groups={[{ userId, username, avatarUrl, stories: items.data }]}
          startGroupIndex={0}
          onClose={() => setOpenHighlightId(null)}
          onChanged={() => void items.refetch()}
        />
      ) : null}
    </section>
  );
}
