import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Music2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { Button, Input, Label, Sheet, Textarea } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

/** Sound library upload sheet, used from a profile's "Sounds" tab. Requires
 * the rights-compliance checkbox before it will let the sound go up - see
 * /sound-rights for what that's actually agreeing to. */
export function AddSoundSheet({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished: () => void }) {
  const { t } = useI18n();
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setDescription("");
    setVisibility("public");
    setRightsConfirmed(false);
  }

  async function publish() {
    if (!user || !file || !title.trim()) return;
    if (!rightsConfirmed) {
      toast.error(t("soundMustAcceptRights"));
      return;
    }
    setPublishing(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = await uploadFile("sounds", user.id, file, ext);
      const duration = await new Promise<number | null>((resolve) => {
        const audio = document.createElement("audio");
        audio.preload = "metadata";
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
          resolve(Number.isFinite(audio.duration) ? audio.duration : null);
          URL.revokeObjectURL(audio.src);
        };
        audio.onerror = () => resolve(null);
      });
      const { error } = await supabase.from("sounds").insert({
        user_id: user.id,
        storage_path: path,
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        rights_confirmed: rightsConfirmed,
        duration_seconds: duration,
      });
      if (error) throw error;
      toast.success(t("soundPublished"));
      reset();
      onPublished();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("addSound")}
    >
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left hover:border-primary"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Music2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {file ? file.name : t("addSound")}
          </span>
        </button>

        <div>
          <Label>{t("soundTitleLabel")}</Label>
          <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <Label>{t("soundDescriptionLabel")}</Label>
          <Textarea
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <Label>{t("soundVisibilityLabel")}</Label>
          <div className="mt-1.5 grid gap-2">
            {(
              [
                ["public", t("soundVisibilityPublic")],
                ["private", t("soundVisibilityPrivate")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setVisibility(value)}
                className={cn(
                  "rounded-2xl border p-3 text-left text-sm font-semibold",
                  visibility === value ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-xs">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(e) => setRightsConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            {t("soundRightsCheckbox")} ·{" "}
            <Link to="/sound-rights" target="_blank" className="underline">
              {t("soundRightsLink")}
            </Link>
          </span>
        </label>

        <Button
          className="w-full"
          disabled={!file || !title.trim() || !rightsConfirmed || publishing}
          onClick={() => void publish()}
        >
          {publishing ? "…" : t("publish")}
        </Button>
      </div>
    </Sheet>
  );
}
