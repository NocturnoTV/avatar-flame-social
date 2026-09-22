import { useEffect, useMemo, useRef, useState } from "react";
import { Music2, Plus, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { captureVideoFrame } from "@/lib/media";

/**
 * Client-side video editor: trim a range, overlay text and (optionally) mix
 * in a new sound - built entirely on standard browser APIs (Canvas,
 * MediaRecorder, Web Audio), no server processing or heavy dependencies.
 *
 * How it works: during "Apply", the source video plays once from the trim
 * start to the trim end while every frame is redrawn onto an off-screen
 * canvas (with the text layers burned in on top). canvas.captureStream()
 * supplies the video track; the audio track comes from a
 * MediaStreamAudioDestinationNode fed by the original <video> element's
 * audio and/or a decoded sound file through Web Audio. Both tracks are
 * combined into one MediaStream and recorded with MediaRecorder into a
 * WebM file, which becomes the file that actually gets uploaded.
 *
 * Known limitation: output is WebM (vp9/opus) - there is no way to encode
 * real MP4/H.264 in-browser without a multi-megabyte wasm encoder. WebM
 * plays fine in Chrome/Edge/Firefox/Android but not in Safari/iOS, so a
 * trimmed-or-edited video may not play back for those viewers. Skipping
 * the editor entirely (or making no edits) keeps the original upload
 * untouched in whatever format it was recorded in.
 */

export type TextFont = "sans" | "serif" | "mono" | "display";
export type TextLayer = {
  id: string;
  text: string;
  color: string;
  position: "top" | "center" | "bottom";
  font?: TextFont;
  bubble?: boolean;
};

const TEXT_COLORS = ["#ffffff", "#facc15", "#f472b6", "#22d3ee", "#a855f7", "#000000"];
const TEXT_FONTS: { id: TextFont; className: string; canvasFont: string }[] = [
  { id: "sans", className: "font-sans", canvasFont: "sans-serif" },
  { id: "serif", className: "font-serif", canvasFont: "serif" },
  { id: "mono", className: "font-mono", canvasFont: "monospace" },
  { id: "display", className: "font-black italic", canvasFont: "sans-serif" },
];

function pickSupportedMimeType(): string | null {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** True only when every API this editor depends on is actually available -
 * including actually being able to PLAY BACK the WebM this editor produces,
 * not just record one. Safari/iOS (and some Android WebViews) can often
 * technically encode WebM via MediaRecorder but can never decode it back -
 * and both this editor's own live preview right after editing and the
 * thumbnail picker right after that need to play the freshly-encoded file
 * back immediately, so recording capability alone isn't enough to promise a
 * working montage step. */
export function isMontageSupported() {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function" ||
    typeof (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
    ) === "undefined"
  ) {
    return false;
  }
  const probe = document.createElement("video");
  return (
    probe.canPlayType('video/webm; codecs="vp9,opus"') !== "" ||
    probe.canPlayType('video/webm; codecs="vp8,opus"') !== "" ||
    probe.canPlayType("video/webm") !== ""
  );
}

export function VideoMontageEditor({
  file,
  onDone,
  onSkip,
}: {
  file: File;
  onDone: (edited: Blob) => void;
  onSkip: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrl = useRef(URL.createObjectURL(file));
  const [tab, setTab] = useState<"trim" | "text" | "sound">("trim");
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [soundFile, setSoundFile] = useState<File | null>(null);
  const [mixOriginalAudio, setMixOriginalAudio] = useState(true);
  const [soundDuration, setSoundDuration] = useState(0);
  const [soundStart, setSoundStart] = useState(0);
  const [soundWaveform, setSoundWaveform] = useState<number[] | null>(null);
  const [originalVolume, setOriginalVolume] = useState(1);
  const [soundVolume, setSoundVolume] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filmstrip, setFilmstrip] = useState<string[] | null>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragHandle = useRef<"start" | "end" | null>(null);
  const soundTimelineRef = useRef<HTMLDivElement>(null);
  const draggingSoundStart = useRef(false);

  // Every edit here (even a plain trim) goes through the same canvas ->
  // MediaRecorder -> WebM pipeline, and this screen's own live preview plays
  // that WebM back immediately - so a device that can't play WebM back
  // can't usefully use any part of this editor, not just the fancier
  // text/sound tools. Skip straight past it with one clear toast instead of
  // letting someone trim/add text/pick a sound only to hit a dead end at
  // "Apply" (or worse, an already-broken preview that looks like nothing
  // was saved). The original file still gets published untouched.
  useEffect(() => {
    if (!isMontageSupported()) {
      toast.error(t("montageUnsupported"));
      onSkip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => URL.revokeObjectURL(objectUrl.current), []);
  useEffect(() => () => filmstrip?.forEach((f) => URL.revokeObjectURL(f)), [filmstrip]);

  function onLoadedMetadata() {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    setTrimEnd(d);
    // Otherwise this stays a black rectangle on a lot of Android WebViews
    // until the user manually scrubs it - same decoder quirk as
    // captureVideoFrame, same fix (briefly play, then pause right away so
    // nothing actually plays).
    videoRef.current
      ?.play()
      .then(() => videoRef.current?.pause())
      .catch(() => {});
  }

  // Generates the "real trimmer" filmstrip once duration is known - a row
  // of evenly-spaced frames behind the trim handles, instead of a bare pair
  // of sliders with no visual sense of what's being cut.
  useEffect(() => {
    if (!duration || filmstrip) return;
    const FRAME_COUNT = 10;
    let cancelled = false;
    void (async () => {
      const urls: string[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        if (cancelled) return;
        const at = (duration * (i + 0.5)) / FRAME_COUNT;
        try {
          const blob = await captureVideoFrame(objectUrl.current, at);
          urls.push(URL.createObjectURL(blob));
        } catch {
          break;
        }
      }
      if (!cancelled) setFilmstrip(urls);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  function onTimelinePointer(clientX: number) {
    if (!dragHandle.current || !timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t0 = ratio * duration;
    if (dragHandle.current === "start") {
      const v = Math.min(t0, trimEnd - 0.2);
      setTrimStart(Math.max(0, v));
      if (videoRef.current) videoRef.current.currentTime = Math.max(0, v);
    } else {
      const v = Math.max(t0, trimStart + 0.2);
      setTrimEnd(Math.min(duration, v));
      if (videoRef.current) videoRef.current.currentTime = Math.min(duration, v);
    }
  }

  function addTextLayer() {
    setTextLayers((layers) => [
      ...layers,
      {
        id: crypto.randomUUID(),
        text: "",
        color: TEXT_COLORS[0]!,
        position: "center",
        font: "sans",
        bubble: false,
      },
    ]);
  }
  function updateTextLayer(id: string, patch: Partial<TextLayer>) {
    setTextLayers((layers) => layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removeTextLayer(id: string) {
    setTextLayers((layers) => layers.filter((l) => l.id !== id));
  }

  // Decodes the chosen sound just to draw its waveform and know its
  // duration - the real mix happens later in renderEditedVideo.
  useEffect(() => {
    setSoundWaveform(null);
    setSoundStart(0);
    setSoundDuration(0);
    if (!soundFile) return;
    let cancelled = false;
    void (async () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const arrayBuffer = await soundFile.arrayBuffer();
        const buffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        const raw = buffer.getChannelData(0);
        const BARS = 48;
        const step = Math.floor(raw.length / BARS) || 1;
        const peaks: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let max = 0;
          for (let j = i * step; j < Math.min(raw.length, (i + 1) * step); j++) {
            max = Math.max(max, Math.abs(raw[j]!));
          }
          peaks.push(max);
        }
        setSoundWaveform(peaks);
        setSoundDuration(buffer.duration);
        void audioCtx.close();
      } catch {
        // Waveform is a nice-to-have preview - a decode failure still lets
        // the sound be used, just without the visual.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [soundFile]);

  function onSoundTimelinePointer(clientX: number) {
    if (!draggingSoundStart.current || !soundTimelineRef.current || !soundDuration) return;
    const rect = soundTimelineRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const usedLength = Math.max(0.1, trimEnd - trimStart);
    setSoundStart(Math.min(ratio * soundDuration, Math.max(0, soundDuration - usedLength)));
  }

  const hasEdits =
    trimStart > 0.05 ||
    trimEnd < duration - 0.05 ||
    textLayers.some((l) => l.text.trim()) ||
    !!soundFile;

  async function apply() {
    if (!hasEdits) {
      onSkip();
      return;
    }
    if (!isMontageSupported()) {
      toast.error(t("montageUnsupported"));
      onSkip();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setRendering(true);
    setProgress(0);
    try {
      const blob = await renderEditedVideo({
        video,
        trimStart,
        trimEnd,
        textLayers: textLayers.filter((l) => l.text.trim()),
        soundFile,
        mixOriginalAudio: mixOriginalAudio || !soundFile,
        originalVolume,
        soundVolume,
        soundStart,
        onProgress: setProgress,
      });
      onDone(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
      setRendering(false);
    }
  }

  const activeLayerPreview = textLayers.filter((l) => l.text.trim());

  return (
    <section className="space-y-4">
      <div className="relative mx-auto aspect-[9/16] max-h-[42dvh] overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          src={objectUrl.current}
          muted
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          className="h-full w-full object-contain"
        />
        {activeLayerPreview.map((layer) => (
          <p
            key={layer.id}
            className={cn(
              "pointer-events-none absolute inset-x-2 truncate text-center text-lg font-black",
              TEXT_FONTS.find((f) => f.id === layer.font)?.className,
              layer.bubble
                ? "rounded-xl bg-black/55 px-3 py-1.5"
                : "drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]",
              layer.position === "top" && "top-4",
              layer.position === "center" && "top-1/2 -translate-y-1/2",
              layer.position === "bottom" && "bottom-4",
            )}
            style={{ color: layer.color }}
          >
            {layer.text}
          </p>
        ))}
        {rendering ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 backdrop-blur-sm">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-xs font-bold text-white">{t("montageRendering")}</p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["trim", t("montageTrim")],
            ["text", t("montageText")],
            ["sound", t("montageSound")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-bold transition",
              tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "trim" ? (
        <div className="space-y-3">
          <div className="flex justify-between text-xs font-bold text-muted-foreground">
            <span>{trimStart.toFixed(1)}s</span>
            <span>{t("montageFinalDuration", { seconds: (trimEnd - trimStart).toFixed(1) })}</span>
            <span>{trimEnd.toFixed(1)}s</span>
          </div>
          <div
            ref={timelineRef}
            className="relative h-16 overflow-hidden rounded-2xl bg-black"
            onMouseMove={(e) => onTimelinePointer(e.clientX)}
            onMouseUp={() => (dragHandle.current = null)}
            onMouseLeave={() => (dragHandle.current = null)}
            onTouchMove={(e) => {
              const t0 = e.touches[0];
              if (t0) {
                if (dragHandle.current) e.preventDefault();
                onTimelinePointer(t0.clientX);
              }
            }}
            onTouchEnd={() => (dragHandle.current = null)}
          >
            {filmstrip ? (
              <div className="flex h-full">
                {filmstrip.map((f, i) => (
                  <img key={i} src={f} alt="" className="h-full flex-1 object-cover" />
                ))}
              </div>
            ) : (
              <div className="h-full w-full animate-pulse bg-surface-2" />
            )}
            {duration > 0 ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-black/65"
                  style={{ width: `${(trimStart / duration) * 100}%` }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-black/65"
                  style={{ width: `${100 - (trimEnd / duration) * 100}%` }}
                />
                {/* The visible pill is deliberately slim, but a finger needs a much
                    bigger target than that to grab reliably - each handle sits inside
                    a much wider invisible touch area, centered on the same position. */}
                <div
                  onMouseDown={() => (dragHandle.current = "start")}
                  onTouchStart={() => (dragHandle.current = "start")}
                  style={{ left: `${(trimStart / duration) * 100}%` }}
                  className="absolute inset-y-0 z-10 flex w-11 -translate-x-1/2 touch-none items-center justify-center cursor-ew-resize"
                >
                  <div className="h-full w-3 rounded-full bg-primary shadow-[0_0_0_2px_white]" />
                </div>
                <div
                  onMouseDown={() => (dragHandle.current = "end")}
                  onTouchStart={() => (dragHandle.current = "end")}
                  style={{ left: `${(trimEnd / duration) * 100}%` }}
                  className="absolute inset-y-0 z-10 flex w-11 -translate-x-1/2 touch-none items-center justify-center cursor-ew-resize"
                >
                  <div className="h-full w-3 rounded-full bg-primary shadow-[0_0_0_2px_white]" />
                </div>
              </>
            ) : null}
          </div>
          <p className="text-center text-xs text-muted-foreground">{t("montageTrimHint")}</p>
        </div>
      ) : null}

      {tab === "text" ? (
        <div className="space-y-3">
          {textLayers.map((layer) => (
            <div key={layer.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 shrink-0 text-primary" />
                <input
                  value={layer.text}
                  onChange={(e) => updateTextLayer(layer.id, { text: e.target.value })}
                  placeholder={t("montageTextPlaceholder")}
                  maxLength={60}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() => removeTextLayer(layer.id)}
                  aria-label={t("delete")}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateTextLayer(layer.id, { color })}
                      aria-label={color}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition",
                        layer.color === color ? "border-primary scale-110" : "border-transparent",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-1 rounded-full bg-surface-2 p-0.5">
                  {(["top", "center", "bottom"] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => updateTextLayer(layer.id, { position: pos })}
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-bold transition",
                        layer.position === pos
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      {pos === "top"
                        ? t("montagePositionTop")
                        : pos === "center"
                          ? t("montagePositionCenter")
                          : t("montagePositionBottom")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {TEXT_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => updateTextLayer(layer.id, { font: f.id })}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-lg text-xs",
                        f.className,
                        (layer.font ?? "sans") === f.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-foreground",
                      )}
                    >
                      Aa
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  {t("montageTextBubble")}
                  <input
                    type="checkbox"
                    checked={!!layer.bubble}
                    onChange={(e) => updateTextLayer(layer.id, { bubble: e.target.checked })}
                    className="accent-primary"
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            onClick={addTextLayer}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 py-3 text-sm font-bold text-primary"
          >
            <Plus className="h-4 w-4" /> {t("montageAddText")}
          </button>
        </div>
      ) : null}

      {tab === "sound" ? (
        <div className="space-y-3">
          <input
            ref={soundInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => setSoundFile(e.target.files?.[0] ?? null)}
          />
          {soundFile ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Music2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {soundFile.name}
              </span>
              <button
                onClick={() => setSoundFile(null)}
                aria-label={t("montageRemoveSound")}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => soundInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 py-6 text-sm font-bold text-primary"
            >
              <Music2 className="h-4 w-4" /> {t("montageUploadSound")}
            </button>
          )}
          {soundFile && soundWaveform ? (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground">
                {t("montageSoundStart", { seconds: soundStart.toFixed(1) })}
              </p>
              <div
                ref={soundTimelineRef}
                className="relative flex h-14 items-end gap-0.5 overflow-hidden rounded-2xl bg-surface-2 px-2 py-2"
                onMouseDown={() => (draggingSoundStart.current = true)}
                onMouseMove={(e) => onSoundTimelinePointer(e.clientX)}
                onMouseUp={() => (draggingSoundStart.current = false)}
                onMouseLeave={() => (draggingSoundStart.current = false)}
                onTouchStart={() => (draggingSoundStart.current = true)}
                onTouchMove={(e) => {
                  const t0 = e.touches[0];
                  if (t0) {
                    e.preventDefault();
                    onSoundTimelinePointer(t0.clientX);
                  }
                }}
                onTouchEnd={() => (draggingSoundStart.current = false)}
              >
                {soundWaveform.map((v, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-full bg-primary/50"
                    style={{ height: `${Math.max(8, v * 100)}%` }}
                  />
                ))}
                {soundDuration > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
                    style={{ left: `${(soundStart / soundDuration) * 100}%` }}
                  />
                ) : null}
              </div>
              <p className="text-center text-xs text-muted-foreground">{t("montageSoundDragHint")}</p>
            </div>
          ) : null}
          {soundFile ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <label className="flex items-center justify-between text-sm font-semibold">
                {t("montageMixAudio")}
                <input
                  type="checkbox"
                  checked={mixOriginalAudio}
                  onChange={(e) => setMixOriginalAudio(e.target.checked)}
                  className="accent-primary"
                />
              </label>
              {mixOriginalAudio ? (
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground">
                    {t("montageOriginalVolume", { percent: Math.round(originalVolume * 100) })}
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={originalVolume}
                    onChange={(e) => setOriginalVolume(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              ) : null}
              <div>
                <p className="mb-1 text-xs font-bold text-muted-foreground">
                  {t("montageSoundVolume", { percent: Math.round(soundVolume * 100) })}
                </p>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {t("montageKeepOriginalAudio")}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSkip}
          disabled={rendering}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground disabled:opacity-50"
        >
          {t("montageSkip")}
        </button>
        <button
          onClick={() => void apply()}
          disabled={rendering}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {t("montageApply")}
        </button>
      </div>
    </section>
  );
}

async function renderEditedVideo({
  video,
  trimStart,
  trimEnd,
  textLayers,
  soundFile,
  mixOriginalAudio,
  originalVolume,
  soundVolume,
  soundStart,
  onProgress,
}: {
  video: HTMLVideoElement;
  trimStart: number;
  trimEnd: number;
  textLayers: TextLayer[];
  soundFile: File | null;
  mixOriginalAudio: boolean;
  originalVolume: number;
  soundVolume: number;
  soundStart: number;
  onProgress: (ratio: number) => void;
}): Promise<Blob> {
  const mimeType = pickSupportedMimeType();
  if (!mimeType) throw new Error("Video editing isn't supported on this browser.");

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 720;
  canvas.height = video.videoHeight || 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Video editing isn't supported on this browser.");

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const dest = audioCtx.createMediaStreamDestination();
  const cleanupFns: (() => void)[] = [];

  if (mixOriginalAudio) {
    const originalWasMuted = video.muted;
    video.muted = false;
    const videoSource = audioCtx.createMediaElementSource(video);
    const originalGain = audioCtx.createGain();
    originalGain.gain.value = originalVolume;
    videoSource.connect(originalGain).connect(dest);
    cleanupFns.push(() => {
      video.muted = originalWasMuted;
    });
  }

  let soundNode: AudioBufferSourceNode | null = null;
  if (soundFile) {
    const arrayBuffer = await soundFile.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    soundNode = audioCtx.createBufferSource();
    soundNode.buffer = buffer;
    soundNode.loop = true;
    const soundGain = audioCtx.createGain();
    soundGain.gain.value = soundVolume;
    soundNode.connect(soundGain).connect(dest);
  }

  const canvasStream = canvas.captureStream(30);
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(combined, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error("Recording failed."));
  });

  await new Promise<void>((resolve) => {
    video.currentTime = trimStart;
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
  });

  recorder.start();
  soundNode?.start(0, soundStart);
  await video.play();

  await new Promise<void>((resolve) => {
    function drawFrame() {
      if (video.paused || video.ended || video.currentTime >= trimEnd) {
        video.pause();
        resolve();
        return;
      }
      ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
      for (const layer of textLayers) {
        const canvasFont = TEXT_FONTS.find((f) => f.id === layer.font)?.canvasFont ?? "sans-serif";
        const fontSize = Math.round(canvas.width * 0.075);
        ctx!.font = `bold ${fontSize}px ${canvasFont}`;
        ctx!.textAlign = "center";
        const y =
          layer.position === "top"
            ? canvas.height * 0.12
            : layer.position === "bottom"
              ? canvas.height * 0.88
              : canvas.height * 0.5;
        if (layer.bubble) {
          const textWidth = ctx!.measureText(layer.text).width;
          const padX = fontSize * 0.4;
          const padY = fontSize * 0.35;
          ctx!.fillStyle = "rgba(0,0,0,.55)";
          const radius = fontSize * 0.3;
          const rectX = canvas.width / 2 - textWidth / 2 - padX;
          const rectY = y - fontSize * 0.75 - padY;
          const rectW = textWidth + padX * 2;
          const rectH = fontSize + padY * 2;
          ctx!.beginPath();
          ctx!.roundRect(rectX, rectY, rectW, rectH, radius);
          ctx!.fill();
        } else {
          ctx!.strokeStyle = "rgba(0,0,0,.6)";
          ctx!.lineWidth = 4;
          ctx!.strokeText(layer.text, canvas.width / 2, y);
        }
        ctx!.fillStyle = layer.color;
        ctx!.fillText(layer.text, canvas.width / 2, y);
      }
      onProgress(Math.min(1, (video.currentTime - trimStart) / Math.max(0.1, trimEnd - trimStart)));
      requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);
  });

  soundNode?.stop();
  recorder.stop();
  for (const fn of cleanupFns) fn();
  void audioCtx.close();
  return finished;
}

/** Captures one frame from a video at the given timestamp as a JPEG Blob -
 * used by the thumbnail picker for both a freshly-chosen local file (upload
 * wizard) and an already-uploaded video's signed URL (edit sheet). */
const FILMSTRIP_FRAME_COUNT = 8;

export function ThumbnailPicker({
  source,
  onPick,
}: {
  source: Blob | string;
  onPick: (blob: Blob) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  // The source can arrive late (a signed URL resolves asynchronously when
  // editing an already-published video), so it must stay reactive - freezing
  // it in a ref left the picker pointing at an empty src forever.
  const mediaUrl = useMemo(
    () => (typeof source === "string" ? source : URL.createObjectURL(source)),
    [source],
  );
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frames, setFrames] = useState<string[] | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);

  useEffect(() => {
    setPreview(null);
    setDuration(0);
    setTime(0);
    setFrames(null);
    setSelectedFrame(null);
    if (typeof source === "string") return;
    return () => URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl, source]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => () => frames?.forEach((f) => URL.revokeObjectURL(f)), [frames]);

  // Generates the cover-frame filmstrip once the video's duration is known -
  // an evenly spaced set of frames someone can tap instead of scrubbing by
  // hand for the exact moment they want.
  useEffect(() => {
    if (!duration || frames) return;
    let cancelled = false;
    void (async () => {
      const urls: string[] = [];
      for (let i = 0; i < FILMSTRIP_FRAME_COUNT; i++) {
        if (cancelled) return;
        const at = (duration * (i + 0.5)) / FILMSTRIP_FRAME_COUNT;
        try {
          const blob = await captureVideoFrame(source, at);
          urls.push(URL.createObjectURL(blob));
        } catch {
          break;
        }
      }
      if (!cancelled) setFrames(urls);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  async function capture() {
    setBusy(true);
    try {
      const blob = await captureVideoFrame(source, time);
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      setSelectedFrame(null);
      onPick(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function pickFrame(index: number, frameUrl: string) {
    setBusy(true);
    try {
      const at = (duration * (index + 0.5)) / FILMSTRIP_FRAME_COUNT;
      const blob = await captureVideoFrame(source, at);
      setPreview(frameUrl);
      setSelectedFrame(index);
      onPick(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[9/16] max-h-[38dvh] overflow-hidden rounded-3xl bg-black">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            src={mediaUrl}
            muted
            playsInline
            onLoadedMetadata={() => {
              setDuration(videoRef.current?.duration ?? 0);
              // Otherwise this stays a black rectangle on a lot of Android
              // WebViews until the user manually scrubs it - same decoder
              // quirk as captureVideoFrame, same fix (briefly play, then
              // pause right away so nothing actually plays).
              videoRef.current
                ?.play()
                .then(() => videoRef.current?.pause())
                .catch(() => {});
            }}
            className="h-full w-full object-contain"
          />
        )}
      </div>

      {frames ? (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => void pickFrame(i, f)}
              className={cn(
                "aspect-[9/16] h-16 shrink-0 overflow-hidden rounded-lg border-2",
                selectedFrame === i ? "border-primary" : "border-transparent",
              )}
            >
              <img src={f} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : duration > 0 ? (
        <div className="flex gap-1.5">
          {Array.from({ length: FILMSTRIP_FRAME_COUNT }).map((_, i) => (
            <div
              key={i}
              className="aspect-[9/16] h-16 shrink-0 animate-pulse rounded-lg bg-surface-2"
            />
          ))}
        </div>
      ) : null}

      <input
        ref={importRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (preview) URL.revokeObjectURL(preview);
            const url = URL.createObjectURL(file);
            setPreview(url);
            setSelectedFrame(null);
            onPick(file);
          }
          e.target.value = "";
        }}
      />
      <button
        onClick={() => importRef.current?.click()}
        className="w-full rounded-2xl border border-dashed border-border py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
      >
        {t("thumbnailImportImage")}
      </button>

      <p className="text-center text-xs text-muted-foreground">{t("thumbnailHint")}</p>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={time}
        onChange={(e) => {
          const v = Number(e.target.value);
          setTime(v);
          setSelectedFrame(null);
          if (videoRef.current) videoRef.current.currentTime = v;
        }}
        className="w-full accent-primary"
      />
      {preview ? (
        <button
          onClick={() => setPreview(null)}
          className="w-full rounded-2xl border border-border py-2.5 text-sm font-bold text-muted-foreground"
        >
          {t("thumbnailTitle")}
        </button>
      ) : (
        <button
          onClick={() => void capture()}
          disabled={busy}
          className="w-full rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {t("thumbnailCapture")}
        </button>
      )}
    </div>
  );
}
