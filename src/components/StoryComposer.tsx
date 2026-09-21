import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crop,
  Eraser,
  Image as ImageIcon,
  Music2,
  Pencil,
  Redo2,
  Smile,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { uploadFile, captureVideoThumbnail } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { Button, Sheet } from "@/components/ui-kit";
import { SoundPicker, type PickedSound } from "@/components/SoundPicker";
import { CloseFriendsSheet } from "@/components/CloseFriendsSheet";
import { cn } from "@/lib/utils";

type Audience = "everyone" | "followers" | "close_friends";
type FilterId = "normal" | "vintage" | "warm" | "cool" | "bw" | "glow" | "blur";
const FILTERS: { id: FilterId; label: string; css: string }[] = [
  { id: "normal", label: "Normal", css: "none" },
  { id: "vintage", label: "Vintage", css: "sepia(0.35) contrast(1.1) saturate(1.3)" },
  { id: "warm", label: "Warm", css: "saturate(1.3) hue-rotate(-8deg) brightness(1.05)" },
  { id: "cool", label: "Cool", css: "saturate(1.15) hue-rotate(12deg) brightness(1.02)" },
  { id: "bw", label: "B&W", css: "grayscale(1) contrast(1.1)" },
  { id: "glow", label: "Glow", css: "brightness(1.15) contrast(0.95) saturate(1.2)" },
  { id: "blur", label: "Blur", css: "blur(2px) brightness(1.05)" },
];

export type StoryDraft = {
  id: string;
  media_url: string;
  media_type: string;
  thumbnail_path: string | null;
  sound_id: string | null;
  visibility: string;
  created_at?: string;
  metadata: {
    overlays?: Overlay[];
    filter?: FilterId;
    fitMode?: "cover" | "contain";
  } | null;
};

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

type DrawStroke = { color: string; size: number; erase: boolean; points: { x: number; y: number }[] };

const STORY_EMOJIS = ["🔥", "❤️", "😂", "😎", "🎉", "✨", "😭", "👀", "🎮", "💯"];
const DRAW_COLORS = ["#ffffff", "#000000", "#ef4444", "#facc15", "#22d3ee", "#a855f7"];
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
export function StoryComposer({
  open,
  onClose,
  onPublished,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
  draft?: StoryDraft;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [resolvingDraftMedia, setResolvingDraftMedia] = useState(false);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [overlays, setOverlays] = useState<Overlay[]>(draft?.metadata?.overlays ?? []);
  const [addingText, setAddingText] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]!);
  const [textFont, setTextFont] = useState<TextFont>("sans");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [sound, setSound] = useState<PickedSound | null>(
    draft?.sound_id ? { id: draft.sound_id, title: "", storagePath: "" } : null,
  );
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [audience, setAudience] = useState<Audience>(
    draft?.visibility === "everyone" || draft?.visibility === "close_friends"
      ? draft.visibility
      : "followers",
  );
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [closeFriendsSheetOpen, setCloseFriendsSheetOpen] = useState(false);
  const [guide, setGuide] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [drawingMode, setDrawingMode] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [redoStack, setRedoStack] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]!);
  const [drawSize, setDrawSize] = useState(6);
  const [erasing, setErasing] = useState(false);
  const [filter, setFilter] = useState<FilterId>(draft?.metadata?.filter ?? "normal");
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [fitMode, setFitMode] = useState<"cover" | "contain">(
    draft?.metadata?.fitMode ?? "contain",
  );
  const [draggingOverlay, setDraggingOverlay] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draft?.id ?? null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<DrawStroke | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trashZoneRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);
  const resizeId = useRef<string | null>(null);
  const pinch = useRef<{
    id: string;
    startDist: number;
    startAngle: number;
    baseScale: number;
    baseRotation: number;
  } | null>(null);
  const resizeStart = useRef<{
    centerX: number;
    centerY: number;
    startDist: number;
    startAngle: number;
    baseScale: number;
    baseRotation: number;
  } | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Resuming a draft: the media was already uploaded, so fetch it back down
  // into a real File so editing/publishing can proceed exactly like a fresh
  // pick - a signed URL alone can't be dragged onto a canvas or re-uploaded.
  useEffect(() => {
    if (!draft) return;
    setResolvingDraftMedia(true);
    void (async () => {
      try {
        const { data } = await supabase.storage
          .from(draft.media_url.split("/")[0]!)
          .createSignedUrl(draft.media_url.split("/").slice(1).join("/"), 3600);
        if (!data) throw new Error("missing");
        const res = await fetch(data.signedUrl);
        const blob = await res.blob();
        const ext = draft.media_type === "video" ? "mp4" : "jpg";
        setMediaType(draft.media_type === "video" ? "video" : "image");
        setFile(new File([blob], `draft.${ext}`, { type: blob.type }));
      } catch {
        toast.error(t("errorGeneric"));
      } finally {
        setResolvingDraftMedia(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

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
    setDrawingMode(false);
    setStrokes([]);
    setRedoStack([]);
    setFilter("normal");
    setFitMode("contain");
    setCurrentDraftId(null);
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
    setStrokes([]);
    setRedoStack([]);
    setDrawingMode(false);
    setFilter("normal");
    setFitMode("contain");
  }

  function requestClose() {
    if (file) setExitPromptOpen(true);
    else onClose();
  }

  function discardAndClose() {
    setExitPromptOpen(false);
    reset();
    onClose();
  }

  async function saveDraft() {
    if (!user || !file) return;
    setSavingDraft(true);
    try {
      const ext = file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
      const path = await uploadFile("stories", user.id, file, ext);
      let thumbnailPath: string | null = null;
      if (mediaType === "video") {
        const thumb = await captureVideoThumbnail(file);
        if (thumb) thumbnailPath = await uploadFile("thumbnails", user.id, thumb, "jpg");
      }
      const values = {
        user_id: user.id,
        media_url: path,
        media_type: mediaType,
        thumbnail_path: thumbnailPath,
        sound_id: sound?.id ?? null,
        visibility: audience,
        status: "draft" as const,
        metadata: { overlays, filter, fitMode },
      };
      if (currentDraftId) {
        await supabase.from("stories").update(values).eq("id", currentDraftId);
      } else {
        await supabase.from("stories").insert(values);
      }
      toast.success(t("studioDraftSaved"));
      setExitPromptOpen(false);
      reset();
      onClose();
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setSavingDraft(false);
    }
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
    setDraggingOverlay(true);
  }

  /** True multi-touch pinch/rotate on an overlay - alongside the single-
   * finger corner handle, so a two-finger gesture works the way it does in
   * every other photo editor. */
  function startPinch(id: string, touches: React.TouchList) {
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay || touches.length < 2) return;
    const [a, b] = [touches[0]!, touches[1]!];
    pinch.current = {
      id,
      startDist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
      startAngle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
      baseScale: overlay.scale ?? 1,
      baseRotation: overlay.rotation ?? 0,
    };
  }

  function continuePinch(touches: React.TouchList) {
    if (!pinch.current || touches.length < 2) return;
    const { id, startDist, startAngle, baseScale, baseRotation } = pinch.current;
    const [a, b] = [touches[0]!, touches[1]!];
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const angle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
    const scale = Math.min(4, Math.max(0.4, baseScale * (dist / Math.max(startDist, 1))));
    const rotation = baseRotation + ((angle - startAngle) * 180) / Math.PI;
    setOverlays((current) => current.map((o) => (o.id === id ? { ...o, scale, rotation } : o)));
  }

  function redrawCanvas() {
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = (stroke.size / 100) * canvas.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        const x = (p.x / 100) * canvas.width;
        const y = (p.y / 100) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  // Canvas pixel size has to match the stage's rendered size for strokes to
  // land where the finger actually is - sized once the stage is on screen
  // and again whenever the drawing tool opens (covers the file just having
  // changed the stage's aspect ratio).
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    canvas.width = stage.clientWidth;
    canvas.height = stage.clientHeight;
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingMode, preview]);

  function stagePointToPercent(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  }

  function startDrawStroke(clientX: number, clientY: number) {
    if (!drawingMode) return;
    activeStroke.current = {
      color: drawColor,
      size: erasing ? drawSize * 2.5 : drawSize,
      erase: erasing,
      points: [stagePointToPercent(clientX, clientY)],
    };
    setRedoStack([]);
  }

  function continueDrawStroke(clientX: number, clientY: number) {
    if (!activeStroke.current) return;
    activeStroke.current.points.push(stagePointToPercent(clientX, clientY));
    redrawActiveStroke();
  }

  function redrawActiveStroke() {
    redrawCanvas();
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const stroke = activeStroke.current;
    if (!canvas || !ctx || !stroke) return;
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = (stroke.size / 100) * canvas.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    stroke.points.forEach((p, i) => {
      const x = (p.x / 100) * canvas.width;
      const y = (p.y / 100) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function endDrawStroke() {
    if (!activeStroke.current) return;
    if (activeStroke.current.points.length > 1) {
      setStrokes((current) => [...current, activeStroke.current!]);
    }
    activeStroke.current = null;
  }

  function undoStroke() {
    setStrokes((current) => {
      if (!current.length) return current;
      const next = current.slice(0, -1);
      setRedoStack((r) => [...r, current[current.length - 1]!]);
      return next;
    });
  }

  function redoStroke() {
    setRedoStack((current) => {
      if (!current.length) return current;
      const stroke = current[current.length - 1]!;
      setStrokes((s) => [...s, stroke]);
      return current.slice(0, -1);
    });
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
    const trashRect = trashZoneRef.current?.getBoundingClientRect();
    const overTrashNow = !!(
      trashRect &&
      clientX >= trashRect.left &&
      clientX <= trashRect.right &&
      clientY >= trashRect.top &&
      clientY <= trashRect.bottom
    );
    setOverTrash(overTrashNow);
    if (overTrashNow) return; // hovering the trash - freeze position, don't snap/reposition
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

  function endDrag() {
    if (dragId.current && overTrash) {
      setOverlays((current) => current.filter((o) => o.id !== dragId.current));
    }
    dragId.current = null;
    setDraggingOverlay(false);
    setOverTrash(false);
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
      let drawingPath: string | null = null;
      if (strokes.length > 0 && drawingCanvasRef.current) {
        const blob = await new Promise<Blob | null>((resolve) =>
          drawingCanvasRef.current!.toBlob((b) => resolve(b), "image/png"),
        );
        if (blob) drawingPath = await uploadFile("stories", user.id, blob, "png");
      }
      const values = {
        user_id: user.id,
        media_url: path,
        media_type: mediaType,
        thumbnail_path: thumbnailPath,
        sound_id: sound?.id ?? null,
        visibility: audience,
        status: "published" as const,
        // Fresh 24h window from the moment it's actually shared, not from
        // whenever the media first got uploaded (e.g. resuming an old draft).
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: { overlays, drawing_path: drawingPath, filter, fitMode },
      };
      const { error } = currentDraftId
        ? await supabase.from("stories").update(values).eq("id", currentDraftId)
        : await supabase.from("stories").insert(values);
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
    <div className="fixed inset-0 z-[95] flex flex-col overflow-y-auto overscroll-contain bg-black text-white">
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
          {resolvingDraftMedia ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="text-sm text-white/70">{t("loading")}</p>
            </div>
          ) : (
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
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 p-3">
            <button onClick={requestClose} aria-label={t("cancel")}>
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => setAudienceOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"
            >
              <Users className="h-3.5 w-3.5" />
              {audience === "everyone"
                ? t("storyAudienceEveryone")
                : audience === "followers"
                  ? t("storyAudienceFollowers")
                  : t("storyAudienceCloseFriends")}
            </button>
            <button
              onClick={() => void publish()}
              disabled={publishing || resolvingDraftMedia}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {publishing ? "…" : t("storyShareButton")}
            </button>
          </div>

          <div
            ref={stageRef}
            className="relative mx-auto min-h-0 w-full max-w-sm flex-1 overflow-hidden bg-neutral-900"
            onMouseDown={(e) => drawingMode && startDrawStroke(e.clientX, e.clientY)}
            onMouseMove={(e) => {
              if (drawingMode) continueDrawStroke(e.clientX, e.clientY);
              else onStageMove(e.clientX, e.clientY);
            }}
            onMouseUp={() => {
              endDrawStroke();
              endDrag();
              resizeId.current = null;
              setGuide({ x: false, y: false });
            }}
            onMouseLeave={() => {
              endDrawStroke();
              endDrag();
              resizeId.current = null;
              setGuide({ x: false, y: false });
            }}
            onTouchStart={(e) => {
              const t0 = e.touches[0];
              if (t0 && drawingMode) startDrawStroke(t0.clientX, t0.clientY);
            }}
            onTouchMove={(e) => {
              if (pinch.current && e.touches.length >= 2) {
                e.preventDefault();
                continuePinch(e.touches);
                return;
              }
              const t0 = e.touches[0];
              if (t0) {
                if (drawingMode || dragId.current || resizeId.current) e.preventDefault();
                if (drawingMode) continueDrawStroke(t0.clientX, t0.clientY);
                else onStageMove(t0.clientX, t0.clientY);
              }
            }}
            onTouchEnd={() => {
              endDrawStroke();
              endDrag();
              resizeId.current = null;
              pinch.current = null;
              setGuide({ x: false, y: false });
            }}
          >
            {preview ? (
              mediaType === "video" ? (
                <video
                  src={preview}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ filter: FILTERS.find((f) => f.id === filter)?.css }}
                  className={cn("h-full w-full", fitMode === "cover" ? "object-cover" : "object-contain")}
                />
              ) : (
                <img
                  src={preview}
                  alt=""
                  style={{ filter: FILTERS.find((f) => f.id === filter)?.css }}
                  className={cn("h-full w-full", fitMode === "cover" ? "object-cover" : "object-contain")}
                />
              )
            ) : null}

            <canvas
              ref={drawingCanvasRef}
              className={cn(
                "absolute inset-0 h-full w-full",
                drawingMode ? "cursor-crosshair" : "pointer-events-none",
              )}
            />

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
                onTouchStart={(e) => {
                  if (e.touches.length >= 2) startPinch(o.id, e.touches);
                  else startDrag(o.id);
                }}
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

            {draggingOverlay ? (
              <div
                ref={trashZoneRef}
                className={cn(
                  "pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl px-4 py-2.5 text-xs font-bold transition-colors",
                  overTrash ? "bg-destructive text-white" : "bg-black/60 text-white/80",
                )}
              >
                <Trash2 className="h-5 w-5" />
                {t("storyDropToDelete")}
              </div>
            ) : null}

            <div className="absolute right-3 top-3 z-20 flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  setAddingText(true);
                  setEmojiPickerOpen(false);
                  setDrawingMode(false);
                  setFilterPickerOpen(false);
                }}
                aria-label={t("storyTextTool")}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur"
              >
                <Type className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setEmojiPickerOpen((v) => !v);
                  setAddingText(false);
                  setDrawingMode(false);
                  setFilterPickerOpen(false);
                }}
                aria-label={t("storyStickerTool")}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur"
              >
                <Smile className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setDrawingMode((v) => !v);
                  setAddingText(false);
                  setEmojiPickerOpen(false);
                  setFilterPickerOpen(false);
                }}
                aria-label={t("montageDrawTool")}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full backdrop-blur",
                  drawingMode ? "bg-primary text-primary-foreground" : "bg-black/40",
                )}
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setFilterPickerOpen((v) => !v);
                  setAddingText(false);
                  setEmojiPickerOpen(false);
                  setDrawingMode(false);
                }}
                aria-label={t("storyFilterTool")}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full backdrop-blur",
                  filter !== "normal" ? "bg-primary text-primary-foreground" : "bg-black/40",
                )}
              >
                <Sparkles className="h-5 w-5" />
              </button>
              <button
                onClick={() => setFitMode((m) => (m === "cover" ? "contain" : "cover"))}
                aria-label={fitMode === "cover" ? t("storyFitFill") : t("storyFitFit")}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur"
              >
                <Crop className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSoundPickerOpen(true)}
                aria-label={sound ? sound.title : t("storyMusicTool")}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full backdrop-blur",
                  sound ? "bg-primary text-primary-foreground" : "bg-black/40",
                )}
              >
                <Music2 className="h-5 w-5" />
              </button>
              {overlays.length > 0 || strokes.length > 0 ? (
                <button
                  onClick={() => {
                    setOverlays([]);
                    setStrokes([]);
                    setRedoStack([]);
                  }}
                  aria-label={t("delete")}
                  className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              ) : null}
            </div>
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

          {drawingMode ? (
            <div className="shrink-0 space-y-2.5 border-t border-white/10 p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setErasing(false)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full",
                    !erasing ? "bg-primary text-primary-foreground" : "bg-white/10",
                  )}
                  aria-label={t("montageDrawPen")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setErasing(true)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full",
                    erasing ? "bg-primary text-primary-foreground" : "bg-white/10",
                  )}
                  aria-label={t("montageDrawEraser")}
                >
                  <Eraser className="h-4 w-4" />
                </button>
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDrawColor(c)}
                    style={{ backgroundColor: c }}
                    className={cn(
                      "h-7 w-7 shrink-0 rounded-full border-2",
                      drawColor === c ? "border-primary" : "border-white/30",
                    )}
                    aria-label={c}
                  />
                ))}
                <button
                  onClick={undoStroke}
                  disabled={!strokes.length}
                  className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 disabled:opacity-30"
                  aria-label={t("montageDrawUndo")}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={redoStroke}
                  disabled={!redoStack.length}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 disabled:opacity-30"
                  aria-label={t("montageDrawRedo")}
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              <input
                type="range"
                min={2}
                max={20}
                value={drawSize}
                onChange={(e) => setDrawSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          ) : null}

          {filterPickerOpen ? (
            <div className="no-scrollbar shrink-0 overflow-x-auto border-t border-white/10 p-3">
              <div className="flex gap-3">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "h-14 w-14 overflow-hidden rounded-2xl border-2 bg-neutral-700",
                        filter === f.id ? "border-primary" : "border-transparent",
                      )}
                    >
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          style={{ filter: f.css }}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="text-[11px] font-bold">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
                ["everyone", t("storyAudienceEveryone")],
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

      {exitPromptOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-neutral-900 p-5 text-center text-white">
            <p className="text-lg font-black">{t("storyExitTitle")}</p>
            <p className="mt-1 text-sm text-white/70">{t("storyExitBody")}</p>
            <div className="mt-4 space-y-2">
              <Button className="w-full" variant="outline" onClick={() => setExitPromptOpen(false)}>
                {t("storyKeepEditing")}
              </Button>
              <Button
                className="w-full"
                disabled={savingDraft}
                onClick={() => void saveDraft()}
              >
                {savingDraft ? "…" : t("studioSaveDraft")}
              </Button>
              <button
                onClick={discardAndClose}
                className="w-full py-2 text-sm font-bold text-destructive"
              >
                {t("storyDiscardAndExit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
