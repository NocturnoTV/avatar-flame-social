import { useEffect, useRef, useState } from "react";
import { Music2, Plus, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

export type TextLayer = {
  id: string;
  text: string;
  color: string;
  position: "top" | "center" | "bottom";
};

const TEXT_COLORS = ["#ffffff", "#facc15", "#f472b6", "#22d3ee", "#a855f7", "#000000"];

function pickSupportedMimeType(): string | null {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** True only when every API this editor depends on is actually available. */
export function isMontageSupported() {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    typeof (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
    ) !== "undefined"
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
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const soundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => URL.revokeObjectURL(objectUrl.current), []);

  function onLoadedMetadata() {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    setTrimEnd(d);
  }

  function addTextLayer() {
    setTextLayers((layers) => [
      ...layers,
      { id: crypto.randomUUID(), text: "", color: TEXT_COLORS[0]!, position: "center" },
    ]);
  }
  function updateTextLayer(id: string, patch: Partial<TextLayer>) {
    setTextLayers((layers) => layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removeTextLayer(id: string) {
    setTextLayers((layers) => layers.filter((l) => l.id !== id));
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
              "pointer-events-none absolute inset-x-2 truncate text-center text-lg font-black drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]",
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
            <span>{trimEnd.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={trimStart}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), trimEnd - 0.2);
              setTrimStart(Math.max(0, v));
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
            className="w-full accent-primary"
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={trimEnd}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), trimStart + 0.2);
              setTrimEnd(Math.min(duration, v));
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
            className="w-full accent-primary"
          />
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
          {soundFile ? (
            <label className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm font-semibold">
              {t("montageMixAudio")}
              <input
                type="checkbox"
                checked={mixOriginalAudio}
                onChange={(e) => setMixOriginalAudio(e.target.checked)}
                className="accent-primary"
              />
            </label>
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
  onProgress,
}: {
  video: HTMLVideoElement;
  trimStart: number;
  trimEnd: number;
  textLayers: TextLayer[];
  soundFile: File | null;
  mixOriginalAudio: boolean;
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
    videoSource.connect(dest);
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
    soundNode.connect(dest);
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
  soundNode?.start();
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
        ctx!.font = `bold ${Math.round(canvas.width * 0.075)}px sans-serif`;
        ctx!.fillStyle = layer.color;
        ctx!.textAlign = "center";
        ctx!.strokeStyle = "rgba(0,0,0,.6)";
        ctx!.lineWidth = 4;
        const y =
          layer.position === "top"
            ? canvas.height * 0.12
            : layer.position === "bottom"
              ? canvas.height * 0.88
              : canvas.height * 0.5;
        ctx!.strokeText(layer.text, canvas.width / 2, y);
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
export async function captureVideoFrame(source: Blob | string, atSeconds: number): Promise<Blob> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read video."));
    });
    video.currentTime = Math.min(Math.max(atSeconds, 0), Math.max(video.duration - 0.05, 0));
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not capture frame.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture frame."))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

export function ThumbnailPicker({
  source,
  onPick,
}: {
  source: Blob | string;
  onPick: (blob: Blob) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrl = useRef(typeof source === "string" ? source : URL.createObjectURL(source));
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (typeof source !== "string") URL.revokeObjectURL(objectUrl.current);
    },
    [source],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function capture() {
    setBusy(true);
    try {
      const blob = await captureVideoFrame(source, time);
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(blob);
      setPreview(url);
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
            src={objectUrl.current}
            muted
            playsInline
            onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("thumbnailHint")}</p>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={time}
        disabled={!!preview}
        onChange={(e) => {
          const v = Number(e.target.value);
          setTime(v);
          if (videoRef.current) videoRef.current.currentTime = v;
        }}
        className="w-full accent-primary disabled:opacity-40"
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
