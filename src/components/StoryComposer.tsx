import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Image as ImageIcon,
  Music2,
  Smile,
  Trash2,
  Type,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { uploadFile, captureVideoThumbnail } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui-kit";
import { SoundPicker, type PickedSound } from "@/components/SoundPicker";
import { CloseFriendsSheet } from "@/components/CloseFriendsSheet";
import { cn } from "@/lib/utils";

type TextFont = "sans" | "serif" | "mono" | "display";
type Overlay = {
  id: string;
  type: "text" | "emoji";
  content: string;
  x: number;
  y: number;
  color?: string;
  font?: TextFont;
  scale?: number;
  rotation?: number;
};

const STORY_EMOJIS = ["🔥", "❤️", "😂", "😎", "🎉", "✨", "😭", "👀", "🎮", "💯"];
const TEXT_COLORS = ["#ffffff", "#facc15", "#f472b6", "#22d3ee", "#a855f7", "#000000"];
const TEXT_FONTS: { id: TextFont; label: string; className: string }[] = [
  { id: "sans", label: "Aa", className: "font-sans" },
  { id: "serif", label: "Aa", className: "font-serif" },
  { id: "mono", label: "Aa", className: "font-mono" },
  { id: "display", label: "Aa", className: "font-black italic" },
];
const SNAP_THRESHOLD = 4;

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
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]!);
  const [textFont, setTextFont] = useState<TextFont>("sans");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [sound, setSound] = useState<PickedSound | null>(null);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [audience, setAudience] = useState<"followers" | "close_friends">("followers");
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [closeFriendsSheetOpen, setCloseFriendsSheetOpen] = useState(false);
  const [guide, setGuide] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const resizeId = useRef<string | null>(null);
  const resizeStart = useRef<{
    centerX: number;
    centerY: number;
    startDist: number;
    startAngle: number;
    baseScale: number;
    baseRotation: number;
  } | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Locks the page behind this full-screen composer so a drag gesture on
  // the media (moving/resizing text) can never rubber-band-scroll the page
  // underneath and reveal space below the screen.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);

  function reset() {
    setFile(null);
    setOverlays([]);
    setSound(null);
    setAddingText(false);
    setTextDraft("");
    setAudience("followers");
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
      {
        id: crypto.randomUUID(),
        type,
        content,
        x: 50,
        y: type === "text" ? 80 : 50,
        ...(type === "text" ? { color: textColor, font: textFont } : {}),
      },
    ]);
  }

  function startDrag(id: string) {
    dragId.current = id;
  }

  function startResize(id: string, clientX: number, clientY: number) {
    if (!stageRef.current) return;
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;
    const rect = stageRef.current.getBoundingClientRect();
    const centerX = rect.left + (overlay.x / 100) * rect.width;
    const centerY = rect.top + (overlay.y / 100) * rect.height;
    resizeId.current = id;
    resizeStart.current = {
      centerX,
      centerY,
      startDist: Math.hypot(clientX - centerX, clientY - centerY),
      startAngle: Math.atan2(clientY - centerY, clientX - centerX),
      baseScale: overlay.scale ?? 1,
      baseRotation: overlay.rotation ?? 0,
    };
  }

  function onStageMove(clientX: number, clientY: number) {
    if (resizeId.current && resizeStart.current) {
      const { centerX, centerY, startDist, startAngle, baseScale, baseRotation } =
        resizeStart.current;
      const dist = Math.hypot(clientX - centerX, clientY - centerY);
      const angle = Math.atan2(clientY - centerY, clientX - centerX);
      const scale = Math.min(4, Math.max(0.4, baseScale * (dist / Math.max(startDist, 1))));
      const rotation = baseRotation + ((angle - startAngle) * 180) / Math.PI;
      setOverlays((current) =>
        current.map((o) => (o.id === resizeId.current ? { ...o, scale, rotation } : o)),
      );
      return;
    }
    if (!dragId.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    let x = Math.min(95, Math.max(5, ((clientX - rect.left) / rect.width) * 100));
    let y = Math.min(95, Math.max(5, ((clientY - rect.top) / rect.height) * 100));
    const snapX = Math.abs(x - 50) <= SNAP_THRESHOLD;
    const snapY = Math.abs(y - 50) <= SNAP_THRESHOLD;
    if (snapX) x = 50;
    if (snapY) y = 50;
    setGuide({ x: snapX, y: snapY });
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
        visibility: audience,
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
    <div className="fixed inset-0 z-[95] flex flex-col overflow-hidden overscroll-contain bg-black text-white">
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
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 p-3">
            <button onClick={() => setFile(null)} aria-label={t("cancel")}>
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => setAudienceOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"
            >
              <Users className="h-3.5 w-3.5" />
              {audience === "followers" ? t("storyAudienceFollowers") : t("storyAudienceCloseFriends")}
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
            className="relative mx-auto min-h-0 w-full max-w-sm flex-1 overflow-hidden bg-neutral-900"
            onMouseMove={(e) => onStageMove(e.clientX, e.clientY)}
            onMouseUp={() => {
              dragId.current = null;
              resizeId.current = null;
              setGuide({ x: false, y: false });
            }}
            onMouseLeave={() => {
              dragId.current = null;
              resizeId.current = null;
              setGuide({ x: false, y: false });
            }}
            onTouchMove={(e) => {
              const t0 = e.touches[0];
              if (t0) {
                if (dragId.current || resizeId.current) e.preventDefault();
                onStageMove(t0.clientX, t0.clientY);
              }
            }}
            onTouchEnd={() => {
              dragId.current = null;
              resizeId.current = null;
              setGuide({ x: false, y: false });
            }}
          >
            {preview ? (
              mediaType === "video" ? (
                <video src={preview} autoPlay muted loop playsInline className="h-full w-full object-contain" />
              ) : (
                <img src={preview} alt="" className="h-full w-full object-contain" />
              )
            ) : null}

            {guide.x ? (
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary/70" />
            ) : null}
            {guide.y ? (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary/70" />
            ) : null}

            {overlays.map((o) => (
              <div
                key={o.id}
                onMouseDown={() => startDrag(o.id)}
                onTouchStart={() => startDrag(o.id)}
                style={{
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  color: o.color,
                  transform: `translate(-50%, -50%) scale(${o.scale ?? 1}) rotate(${o.rotation ?? 0}deg)`,
                }}
                className={cn(
                  "absolute cursor-grab select-none active:cursor-grabbing",
                  o.type === "text"
                    ? cn(
                        "rounded-xl bg-black/40 px-3 py-1.5 text-lg font-bold",
                        TEXT_FONTS.find((f) => f.id === o.font)?.className ?? "font-sans",
                      )
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
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startResize(o.id, e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const t0 = e.touches[0];
                    if (t0) startResize(o.id, t0.clientX, t0.clientY);
                  }}
                  className="absolute -bottom-2 -right-2 grid h-5 w-5 cursor-nwse-resize place-items-center rounded-full bg-primary"
                  aria-label={t("storyResizeHandle")}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </button>
              </div>
            ))}
          </div>

          {addingText ? (
            <div className="shrink-0 space-y-2.5 border-t border-white/10 p-3">
              <div className="flex gap-2">
                {TEXT_FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTextFont(f.id)}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full text-sm",
                      f.className,
                      textFont === f.id ? "bg-primary text-primary-foreground" : "bg-white/10",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTextColor(c)}
                    style={{ backgroundColor: c }}
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-full border-2",
                      textColor === c ? "border-primary" : "border-white/30",
                    )}
                    aria-label={c}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  placeholder={t("storyTextPlaceholder")}
                  style={{ color: textColor }}
                  className={cn(
                    "min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-white/50",
                    TEXT_FONTS.find((f) => f.id === textFont)?.className,
                  )}
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
            </div>
          ) : null}

          {emojiPickerOpen ? (
            <div className="shrink-0 grid grid-cols-5 gap-2 border-t border-white/10 p-3 text-3xl">
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

          <div className="no-scrollbar flex shrink-0 items-center justify-center gap-4 overflow-x-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

      {audienceOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
          onClick={() => setAudienceOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl bg-neutral-900 p-5 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-lg font-black">{t("storyAudienceTitle")}</p>
            <div className="space-y-2">
            {(
              [
                ["followers", t("storyAudienceFollowers")],
                ["close_friends", t("storyAudienceCloseFriends")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setAudience(value);
                  setAudienceOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 p-3.5 text-left"
              >
                <span className="font-semibold">{label}</span>
                {audience === value ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ))}
            </div>
            <button
              onClick={() => {
                setAudienceOpen(false);
                setCloseFriendsSheetOpen(true);
              }}
              className="mt-3 w-full text-center text-xs font-bold text-primary"
            >
              {t("closeFriendsManage")}
            </button>
          </div>
        </div>
      ) : null}

      <CloseFriendsSheet
        open={closeFriendsSheetOpen}
        onClose={() => setCloseFriendsSheetOpen(false)}
      />
    </div>
  );
}
