import { useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Music2, Smile, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { uploadFile, captureVideoThumbnail } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui-kit";
import { SoundPicker, type PickedSound } from "@/components/SoundPicker";
import { cn } from "@/lib/utils";

type Overlay = { id: string; type: "text" | "emoji"; content: string; x: number; y: number };

const STORY_EMOJIS = ["🔥", "❤️", "😂", "😎", "🎉", "✨", "😭", "👀", "🎮", "💯"];

/** Full-screen Story creation flow: capture/pick media, then an editor
 * where text and emoji can be dropped and dragged onto the media before
 * publishing. Overlays are stored as positions (metadata.overlays) and
 * composited back on top of the media at view time in StoryViewer, rather
 * than burned into the pixels - much simpler and just as visible. */
export function StoryComposer({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished: () => void }) {
  const { t } = useI18n();
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [addingText, setAddingText] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [sound, setSound] = useState<PickedSound | null>(null);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  function reset() {
    setFile(null);
    setOverlays([]);
    setSound(null);
    setAddingText(false);
    setTextDraft("");
  }

  function choose(selected: File | null) {
    if (!selected) return;
    if (selected.size > 100 * 1024 * 1024) {
      toast.error(t("studioMaxFileSize"));
      return;
    }
    setFile(selected);
    setMediaType(selected.type.startsWith("video/") ? "video" : "image");
    setOverlays([]);
  }

  function addOverlay(type: "text" | "emoji", content: string) {
    setOverlays((current) => [
      ...current,
      { id: crypto.randomUUID(), type, content, x: 50, y: type === "text" ? 80 : 50 },
    ]);
  }

  function startDrag(id: string) {
    dragId.current = id;
  }

  function onStageMove(clientX: number, clientY: number) {
    if (!dragId.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(95, Math.max(5, ((clientY - rect.top) / rect.height) * 100));
    setOverlays((current) =>
      current.map((o) => (o.id === dragId.current ? { ...o, x, y } : o)),
    );
  }

  async function publish() {
    if (!user || !file) return;
    setPublishing(true);
    try {
      const ext = file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
      const path = await uploadFile("stories", user.id, file, ext);
      let thumbnailPath: string | null = null;
      if (mediaType === "video") {
        const thumb = await captureVideoThumbnail(file);
        if (thumb) thumbnailPath = await uploadFile("thumbnails", user.id, thumb, "jpg");
      }
      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: path,
        media_type: mediaType,
        thumbnail_path: thumbnailPath,
        sound_id: sound?.id ?? null,
        visibility: "followers",
        metadata: { overlays },
      });
      if (error) throw error;
      toast.success(t("storyPublished"));
      reset();
      onPublished();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setPublishing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black text-white">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          choose(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {!file ? (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between p-4">
            <button onClick={onClose} aria-label={t("cancel")}>
              <X className="h-6 w-6" />
            </button>
            <b>{t("addStory")}</b>
            <span className="w-6" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-white/30 bg-white/5 py-10"
            >
              <Camera className="h-9 w-9" />
              <b>{t("storyUseCamera")}</b>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-white/30 bg-white/5 py-10"
            >
              <ImageIcon className="h-9 w-9" />
              <b>{t("storyUseGallery")}</b>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setFile(null)} aria-label={t("cancel")}>
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => void publish()}
              disabled={publishing}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground"
            >
              {publishing ? "…" : t("storyShareButton")}
            </button>
          </div>

          <div
            ref={stageRef}
            className="relative mx-auto w-full max-w-sm flex-1 overflow-hidden bg-neutral-900"
            onMouseMove={(e) => onStageMove(e.clientX, e.clientY)}
            onMouseUp={() => (dragId.current = null)}
            onMouseLeave={() => (dragId.current = null)}
            onTouchMove={(e) => {
              const t0 = e.touches[0];
              if (t0) onStageMove(t0.clientX, t0.clientY);
            }}
            onTouchEnd={() => (dragId.current = null)}
          >
            {preview ? (
              mediaType === "video" ? (
                <video src={preview} autoPlay muted loop playsInline className="h-full w-full object-contain" />
              ) : (
                <img src={preview} alt="" className="h-full w-full object-contain" />
              )
            ) : null}

            {overlays.map((o) => (
              <div
                key={o.id}
                onMouseDown={() => startDrag(o.id)}
                onTouchStart={() => startDrag(o.id)}
                style={{ left: `${o.x}%`, top: `${o.y}%` }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 cursor-grab select-none active:cursor-grabbing",
                  o.type === "text"
                    ? "rounded-xl bg-black/40 px-3 py-1.5 text-lg font-bold"
                    : "text-4xl",
                )}
              >
                {o.content}
                <button
                  onClick={() => setOverlays((current) => current.filter((x) => x.id !== o.id))}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-black/70"
                  aria-label={t("delete")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {addingText ? (
            <div className="flex items-center gap-2 border-t border-white/10 p-3">
              <input
                autoFocus
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder={t("storyTextPlaceholder")}
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white outline-none placeholder:text-white/50"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (textDraft.trim()) addOverlay("text", textDraft.trim());
                  setTextDraft("");
                  setAddingText(false);
                }}
              >
                {t("studioAdd")}
              </Button>
            </div>
          ) : null}

          {emojiPickerOpen ? (
            <div className="grid grid-cols-5 gap-2 border-t border-white/10 p-3 text-3xl">
              {STORY_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    addOverlay("emoji", e);
                    setEmojiPickerOpen(false);
                  }}
                  className="rounded-xl p-1 hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-6 p-4">
            <button
              onClick={() => {
                setAddingText(true);
                setEmojiPickerOpen(false);
              }}
              className="flex flex-col items-center gap-1 text-xs font-bold"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                <Type className="h-5 w-5" />
              </span>
              {t("storyTextTool")}
            </button>
            <button
              onClick={() => {
                setEmojiPickerOpen((v) => !v);
                setAddingText(false);
              }}
              className="flex flex-col items-center gap-1 text-xs font-bold"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                <Smile className="h-5 w-5" />
              </span>
              {t("storyStickerTool")}
            </button>
            <button
              onClick={() => setSoundPickerOpen(true)}
              className="flex flex-col items-center gap-1 text-xs font-bold"
            >
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full",
                  sound ? "bg-primary text-primary-foreground" : "bg-white/10",
                )}
              >
                <Music2 className="h-5 w-5" />
              </span>
              {sound ? sound.title.slice(0, 10) : t("storyMusicTool")}
            </button>
            {overlays.length > 0 ? (
              <button
                onClick={() => setOverlays([])}
                className="flex flex-col items-center gap-1 text-xs font-bold"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                  <Trash2 className="h-5 w-5" />
                </span>
                {t("delete")}
              </button>
            ) : null}
          </div>
        </div>
      )}

      <SoundPicker
        open={soundPickerOpen}
        onClose={() => setSoundPickerOpen(false)}
        onPick={(s) => {
          setSound(s);
          setSoundPickerOpen(false);
        }}
      />
    </div>
  );
}
