import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music2, Pause, Play, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSignedUrl } from "@/components/Media";
import { useI18n } from "@/lib/i18n";
import { Sheet } from "@/components/ui-kit";

export type PickedSound = { id: string; title: string; storagePath: string };

/** Sheet for picking a sound from the community library (or your own) when
 * publishing a video or Story. Doesn't handle publishing a new sound - see
 * AddSoundSheet for that. */
export function SoundPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (sound: PickedSound) => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const [search, setSearch] = useState("");

  const mySounds = useQuery({
    queryKey: ["sound-picker-mine", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sounds")
        .select("id,storage_path,title,description,usage_count")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const communitySounds = useQuery({
    queryKey: ["sound-picker-community", search.trim()],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("sounds")
        .select("id,storage_path,title,description,usage_count,user_id")
        .eq("visibility", "public")
        .order("usage_count", { ascending: false })
        .limit(40);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <Sheet open={open} onClose={onClose} title={t("chooseSoundTitle")}>
      <label className="mb-3 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("chooseSoundSearch")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {search ? (
          <button onClick={() => setSearch("")} aria-label={t("cancel")}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </label>

      <div className="max-h-[55dvh] space-y-4 overflow-y-auto">
        {!search && (mySounds.data ?? []).length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("mySounds")}
            </p>
            <div className="space-y-1.5">
              {mySounds.data!.map((s) => (
                <SoundOption
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  description={s.description}
                  usageCount={s.usage_count}
                  storagePath={s.storage_path}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("communitySounds")}
          </p>
          <div className="space-y-1.5">
            {(communitySounds.data ?? []).map((s) => (
              <SoundOption
                key={s.id}
                id={s.id}
                title={s.title}
                description={s.description}
                usageCount={s.usage_count}
                storagePath={s.storage_path}
                onPick={onPick}
              />
            ))}
            {!communitySounds.data?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noSounds")}</p>
            ) : null}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function SoundOption({
  id,
  title,
  description,
  usageCount,
  storagePath,
  onPick,
}: {
  id: string;
  title: string;
  description: string | null;
  usageCount: number;
  storagePath: string;
  onPick: (sound: PickedSound) => void;
}) {
  const { t } = useI18n();
  const url = useSignedUrl(storagePath);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-2.5">
      <button
        onClick={(e) => {
          e.stopPropagation();
          const audio = audioRef.current;
          if (!audio) return;
          if (playing) audio.pause();
          else void audio.play();
        }}
        disabled={!url}
        aria-label={playing ? t("pause") : t("play")}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
      <button
        onClick={() => onPick({ id, title, storagePath })}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Music2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{title}</span>
          {description ? (
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-[11px] font-bold text-primary">{t("useSoundButton")}</span>
      </button>
    </div>
  );
}
