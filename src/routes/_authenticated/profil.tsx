import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ImagePlus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { uploadFile } from "@/lib/media";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { ACCENTS, BANNERS, FRAMES, STICKERS, ageFrom } from "@/lib/decorations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — Bloxspark" },
      { name: "description", content: "Personnalise ton profil Bloxspark : photos, bio et décorations." },
      { property: "og:title", content: "Mon profil — Bloxspark" },
      { property: "og:description", content: "Décore ton profil de joueur Roblox." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const { user } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const photos = useQuery({
    queryKey: ["my-photos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_photos")
        .select("id,url,position")
        .eq("user_id", user?.id ?? "")
        .order("position");
      return data ?? [];
    },
    enabled: !!user,
  });

  async function patch(values: Partial<Record<string, string | null>>) {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(values as never).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("saved"));
    void profile.refetch();
  }

  async function addPhoto(file: File) {
    if (!user) return;
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = await uploadFile("profile-photos", user.id, file, ext);
      const { error } = await supabase
        .from("profile_photos")
        .insert({ user_id: user.id, url: path, position: (photos.data?.length ?? 0) });
      if (error) throw error;
      void photos.refetch();
    } catch {
      toast.error(t("errorGeneric"));
    }
  }

  const p = profile.data;
  const age = ageFrom(p?.birth_date ?? null);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("profile")}</h1>
        <Link to="/parametres" aria-label={t("settings")}>
          <Settings className="h-6 w-6" />
        </Link>
      </header>

      <div
        className="mt-4 h-28 rounded-3xl"
        style={{ backgroundImage: BANNERS[p?.banner_style ?? "nebula"] ?? BANNERS["nebula"] }}
      />
      <div className="-mt-10 px-4">
        <div
          className={cn("inline-block rounded-3xl p-1", FRAMES[p?.frame_style ?? "none"] ?? "")}
          style={{ boxShadow: `0 0 0 3px ${ACCENTS[p?.accent_color ?? "spark"] ?? "#ff5f6d"}` }}
        >
          <StoredImage
            path={photos.data?.[0]?.url}
            alt={p?.username ?? ""}
            className="h-20 w-20 rounded-[1.3rem]"
          />
        </div>
        <h2 className="mt-2 flex items-center gap-2 text-xl font-bold">
          {p?.username}
          {p?.sticker ? <span>{p.sticker}</span> : null}
        </h2>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>🎮 {p?.roblox_username}</span>
          {age ? <span>· {age} {t("years")}</span> : null}
          <Flag code={p?.language ?? ""} />
        </p>
      </div>

      <section className="mt-6 space-y-3">
        <Label>{t("photos")}</Label>
        <div className="flex flex-wrap gap-2">
          {(photos.data ?? []).map((ph) => (
            <div key={ph.id} className="relative">
              <StoredImage path={ph.url} alt="" className="h-24 w-24 rounded-2xl" />
              <button
                onClick={async () => {
                  await supabase.from("profile_photos").delete().eq("id", ph.id);
                  void photos.refetch();
                }}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label={t("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void addPhoto(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-4">
        <div>
          <Label>{t("bio")}</Label>
          <Textarea
            rows={3}
            defaultValue={p?.bio ?? ""}
            maxLength={300}
            onBlur={(e) => patch({ bio: e.target.value })}
          />
        </div>
        <div>
          <Label>{t("robloxUsername")}</Label>
          <Input
            defaultValue={p?.roblox_username ?? ""}
            onBlur={(e) => patch({ roblox_username: e.target.value })}
          />
        </div>
        <div>
          <Label>{t("banner")}</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BANNERS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => patch({ banner_style: key })}
                className={cn(
                  "h-10 w-16 rounded-xl border-2",
                  p?.banner_style === key ? "border-primary" : "border-transparent",
                )}
                style={{ backgroundImage: value }}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>{t("accent")}</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ACCENTS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => patch({ accent_color: key })}
                className={cn(
                  "h-8 w-8 rounded-full border-2",
                  p?.accent_color === key ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>{t("frame")}</Label>
          <Select
            defaultValue={p?.frame_style ?? "none"}
            onChange={(e) => patch({ frame_style: e.target.value })}
          >
            {Object.keys(FRAMES).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("sticker")}</Label>
          <div className="flex flex-wrap gap-2 text-2xl">
            {STICKERS.map((s) => (
              <button
                key={s}
                onClick={() => patch({ sticker: s })}
                className={cn(
                  "rounded-xl border-2 px-2",
                  p?.sticker === s ? "border-primary" : "border-transparent",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {saving ? <p className="text-xs text-muted-foreground">{t("loading")}</p> : null}
      </section>

      <Link
        to="/parametres"
        className="mt-6 flex h-11 w-full items-center justify-center rounded-2xl border border-border text-sm font-semibold"
      >
        {t("settings")}
      </Link>
    </div>
  );
}
