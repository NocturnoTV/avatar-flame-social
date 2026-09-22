import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Crown, Images } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WALLPAPERS, setWallpaper, setCustomWallpaper, type Wallpaper } from "@/lib/chatTheme";

/** Full-screen wallpaper picker for a conversation - preset photos are free
 * for everyone, a custom photo from the gallery is a Spark Plus perk. */
export function WallpaperPickerSheet({
  open,
  onClose,
  conversationId,
  hasPlus,
  appTheme,
  current,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  hasPlus: boolean;
  appTheme: "dark" | "light";
  current: Wallpaper;
  onSaved: (wallpaper: Wallpaper) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Wallpaper>(current);

  if (!open) return null;

  function previewCss(w: Wallpaper) {
    if (w.image) return `url(${w.image})`;
    return appTheme === "dark" && w.darkCss ? w.darkCss : w.css;
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === "string") {
        setSelected({ id: "custom", labelKey: "wallpaperAlbum", css: "#000000", image: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  }

  function openAlbum() {
    if (!hasPlus) {
      onClose();
      void navigate({ to: "/shop" });
      return;
    }
    fileRef.current?.click();
  }

  function save() {
    if (selected.id === "custom" && selected.image) {
      setCustomWallpaper(conversationId, selected.image);
    } else {
      setWallpaper(conversationId, selected.id);
    }
    onSaved(selected);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground active:opacity-60"
        >
          {t("cancel")}
        </button>
        <p className="text-sm font-black">{t("wallpaperSheetTitle")}</p>
        <button
          onClick={save}
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground active:opacity-80"
        >
          {t("save")}
        </button>
      </header>

      {/* Live preview */}
      <div
        className="mx-4 flex-1 overflow-hidden rounded-3xl bg-cover bg-center"
        style={{
          background: previewCss(selected),
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex h-full flex-col justify-end gap-2 p-4">
          <div className="ml-auto max-w-[75%] rounded-3xl bg-gradient-to-r from-[#149CF3] to-[#2868FA] px-4 py-3 text-sm font-semibold text-white shadow-lg">
            {t("postCtaTitle")}
          </div>
          <div className="mr-auto max-w-[63%] rounded-3xl bg-black/60 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur">
            {t("wallpaperSheetHint")}
          </div>
        </div>
      </div>

      {/* Picker grid */}
      <div className="mt-3 max-h-[52%] shrink-0 overflow-y-auto rounded-t-3xl border-t border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {t("wallpaperSheetHint")}
        </p>
        <div className="grid grid-cols-3 gap-x-3 gap-y-5">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={openAlbum}
              className="relative flex aspect-[27/39] w-full items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground transition active:scale-[0.97]"
            >
              <Images className="h-7 w-7" />
              {!hasPlus ? (
                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                  <Crown className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
            <span className="text-center text-xs font-semibold leading-tight">
              {t("wallpaperAlbum")}
              {!hasPlus ? (
                <span className="block text-[10px] font-bold text-primary">
                  {t("wallpaperAlbumSparkPlus")}
                </span>
              ) : null}
            </span>
          </div>

          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelected(w)}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={cn(
                  "aspect-[27/39] w-full rounded-2xl bg-cover bg-center ring-2 ring-offset-2 ring-offset-card transition active:scale-[0.97]",
                  selected.id === w.id ? "ring-foreground" : "ring-transparent",
                )}
                style={{
                  background: previewCss(w),
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <span className="text-center text-xs font-semibold leading-tight">
                {t(w.labelKey as Parameters<typeof t>[0])}
              </span>
            </button>
          ))}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickPhoto}
      />
    </div>,
    document.body,
  );
}
