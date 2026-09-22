import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Music2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl, VideoThumb } from "@/components/Media";
import { StoredImage } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/sounds/$id")({
  head: () => ({ meta: [{ title: "Sound - Bloxspark" }] }),
  component: SoundDetailPage,
});

function SoundDetailPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const sound = useQuery({
    queryKey: ["sound-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sounds")
        .select("id,storage_path,title,description,usage_count,user_id")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      const { data: creator } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", data.user_id)
        .maybeSingle();
      return { ...data, creator };
    },
  });

  const videos = useQuery({
    queryKey: ["sound-videos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("id,storage_path,mux_playback_id,mux_status,thumbnail_path,caption,views_count")
        .eq("sound_id", id)
        .eq("moderation_status", "approved")
        .in("visibility", ["public", "sparks"])
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const url = useSignedUrl(sound.data?.storage_path);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <Link to="/discover" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("soundPageTitle")}</h1>
      </header>

      {sound.data ? (
        <div className="mt-5 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                if (playing) audio.pause();
                else void audio.play();
              }}
              disabled={!url}
              aria-label={playing ? t("pause") : t("play")}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            {url ? (
              <audio
                ref={audioRef}
                src={url}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-lg font-black">
                <Music2 className="h-4 w-4 shrink-0 text-primary" /> {sound.data.title}
              </p>
              {sound.data.creator ? (
                <Link
                  to="/users/$id"
                  params={{ id: sound.data.creator.username || sound.data.user_id }}
                  className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <StoredImage
                    path={sound.data.creator.avatar_url}
                    alt=""
                    className="h-4 w-4 rounded-full"
                    fallback="?"
                  />
                  {t("soundCreatedBy", { username: sound.data.creator.username ?? "player" })}
                </Link>
              ) : null}
            </div>
          </div>
          {sound.data.description ? (
            <p className="mt-3 text-sm text-muted-foreground">{sound.data.description}</p>
          ) : null}
          <p className="mt-3 text-sm font-semibold">
            {t("soundUsedInVideos", { count: sound.data.usage_count })}
          </p>
          <Link
            to="/discover/studio"
            search={{ sound: sound.data.id }}
            className="mt-4 block"
          >
            <Button className="w-full">
              <Music2 className="h-4 w-4" /> {t("useSoundButton")}
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-1.5">
        {(videos.data ?? []).map((v) => (
          <Link key={v.id} to="/discover" search={{ v: v.id }}>
            <VideoThumb
              storagePath={v.storage_path}
              thumbnailPath={v.thumbnail_path}
              muxPlaybackId={v.mux_status === "ready" ? v.mux_playback_id : null}
              className="aspect-[9/16] w-full rounded-xl"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
