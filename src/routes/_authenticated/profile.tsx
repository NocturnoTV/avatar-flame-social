import { Flag } from "@/components/Flag";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Camera,
  Gamepad2,
  ImagePlus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Textarea } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { ExternalLinkButton } from "@/components/ExternalLinkButton";
import { ProfileContentTabs, type TabVideo } from "@/components/ProfileContentTabs";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useRoles } from "@/lib/roles";
import { BANNERS, ageFrom } from "@/lib/decorations";
import { cn } from "@/lib/utils";
import { RobloxIdentity } from "@/components/RobloxIdentity";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Bloxspark" },
      {
        name: "description",
        content: "Customize your Bloxspark profile: avatar, photos, bio, favorite Roblox games.",
      },
      { property: "og:title", content: "My profile — Bloxspark" },
      { property: "og:description", content: "Decorate your Roblox player profile." },
    ],
  }),
  component: ProfilePage,
});

const MAX_PHOTOS = 9;
const MAX_GAMES = 5;

function ProfilePage() {
  const { t } = useI18n();
  const { user } = useSession();
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [newGameName, setNewGameName] = useState("");
  const [newGameUrl, setNewGameUrl] = useState("");

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

  const games = useQuery({
    queryKey: ["my-favorite-games", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("favorite_games")
        .select("id,name,url,position,thumbnail_url")
        .eq("user_id", user?.id ?? "")
        .order("position");
      return data ?? [];
    },
    enabled: !!user,
  });

  const videos = useQuery({
    queryKey: ["my-profile-videos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("id,storage_path,caption,views_count")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as TabVideo[];
    },
  });

  const reposts = useQuery({
    queryKey: ["my-reposts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("video_reposts")
        .select("video_id,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.video_id);
      if (!ids.length) return [] as TabVideo[];
      const { data: vids } = await supabase
        .from("videos")
        .select("id,storage_path,caption,views_count")
        .in("id", ids);
      const byId = new Map((vids ?? []).map((v) => [v.id, v]));
      return ids.map((id) => byId.get(id)).filter((v): v is TabVideo => Boolean(v));
    },
  });

  // Les modifications sont mises en brouillon et enregistrées uniquement au clic sur "Enregistrer".
  function patch(values: Record<string, unknown>) {
    setDraft((d) => ({ ...d, ...values }));
  }

  const dirty = Object.keys(draft).length > 0;

  async function saveChanges() {
    if (!user || !dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(draft as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft({});
    toast.success(t("saved"));
    void profile.refetch();
  }

  async function uploadTo(kind: "avatar" | "banner", file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = await uploadFile("profile-photos", user.id, file, ext);
      patch(kind === "avatar" ? { avatar_url: path } : { banner_url: path });
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File) {
    if (!user) return;
    if ((photos.data?.length ?? 0) >= MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos.`);
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = await uploadFile("profile-photos", user.id, file, ext);
      const { error } = await supabase
        .from("profile_photos")
        .insert({ user_id: user.id, url: path, position: photos.data?.length ?? 0 });
      if (error) throw error;
      void photos.refetch();
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(id: string) {
    await supabase.from("profile_photos").delete().eq("id", id);
    void photos.refetch();
  }

  async function movePhoto(index: number, delta: number) {
    const list = [...(photos.data ?? [])];
    const target = index + delta;
    const a = list[index];
    const b = list[target];
    if (!a || !b) return;
    await supabase.from("profile_photos").update({ position: target }).eq("id", a.id);
    await supabase.from("profile_photos").update({ position: index }).eq("id", b.id);
    void photos.refetch();
  }

  async function addFavoriteGame() {
    if (!user || !newGameName.trim()) return;
    const { error } = await supabase.from("favorite_games").insert({
      user_id: user.id,
      name: newGameName.trim(),
      url: newGameUrl.trim() || null,
      position: games.data?.length ?? 0,
    });
    if (error) {
      toast.error(error.message.includes("max_five_games") ? t("maxFiveGames") : t("errorGeneric"));
      return;
    }
    setNewGameName("");
    setNewGameUrl("");
    void games.refetch();
    void qc.invalidateQueries({ queryKey: ["deck-games"] });
  }

  async function deleteFavoriteGame(id: string) {
    await supabase.from("favorite_games").delete().eq("id", id);
    void games.refetch();
  }

  // Aperçu = données enregistrées + brouillon non encore enregistré
  const p = profile.data ? ({ ...profile.data, ...draft } as typeof profile.data) : profile.data;
  const age = ageFrom(p?.birth_date ?? null);
  const gameList = games.data ?? [];

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-40 lg:pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("profile")}</h1>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Link
              to="/admin"
              aria-label="Administration"
              className="text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="h-6 w-6" />
            </Link>
          ) : null}
          <Link to="/settings" aria-label={t("settings")}>
            <Settings className="h-6 w-6" />
          </Link>
        </div>
      </header>

      {/* Bannière */}
      <div className="relative z-0 mt-4 h-36 overflow-hidden rounded-3xl">
        {p?.banner_url ? (
          <StoredImage path={p.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundImage: BANNERS[p?.banner_style ?? "nebula"] ?? BANNERS["nebula"] }}
          />
        )}
        <button
          onClick={() => bannerRef.current?.click()}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
        >
          <ImagePlus className="h-3.5 w-3.5" /> {t("banner")}
        </button>
        {p?.banner_url ? (
          <button
            onClick={() => patch({ banner_url: null })}
            className="absolute right-3 bottom-3 rounded-full bg-black/55 p-1.5 text-white backdrop-blur"
            aria-label="Remove banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadTo("banner", f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Avatar */}
      <div className="relative z-10 -mt-12 px-1">
        <div className="relative inline-block">
          <div className="inline-block rounded-full bg-background p-1">
            <StoredImage
              path={p?.avatar_url ?? photos.data?.[0]?.url}
              alt={p?.username ?? ""}
              className="h-24 w-24 rounded-full object-cover"
            />
          </div>
          <button
            onClick={() => avatarRef.current?.click()}
            className="spark-gradient absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg"
            aria-label="Change avatar"
          >
            <Camera className="h-4.5 w-4.5" />
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadTo("avatar", f);
              e.target.value = "";
            }}
          />
        </div>

        <h2 className="mt-3 flex items-center gap-2 text-xl font-bold">
          {p?.username}
          {p?.verified ? <Verified className="h-5 w-5" /> : null}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RobloxIdentity displayName={p?.roblox_display_name} username={p?.roblox_username} />
          {age ? (
            <span>
              · {age} {t("years")}
            </span>
          ) : null}
          <Flag code={p?.language ?? ""} />
        </p>
        {p?.bio ? <p className="mt-2 whitespace-pre-line text-sm">{p.bio}</p> : null}
        {p?.link_url ? <ExternalLinkButton url={p.link_url} /> : null}

        {gameList.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {gameList.map((g) =>
              g.url ? (
                <a
                  key={g.id}
                  href={g.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-primary"
                >
                  <Gamepad2 className="h-3.5 w-3.5" /> {g.name}
                </a>
              ) : (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"
                >
                  <Gamepad2 className="h-3.5 w-3.5" /> {g.name}
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>

      {/* Édition */}
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
          <Label>{t("externalLink")}</Label>
          <Input
            defaultValue={p?.link_url ?? ""}
            placeholder={t("externalLinkPlaceholder")}
            onBlur={(e) => patch({ link_url: e.target.value.trim() || null })}
          />
        </div>

        <div>
          <Label>
            {t("favoriteGames")} ({gameList.length}/{MAX_GAMES})
          </Label>
          <div className="space-y-2">
            {gameList.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2 text-sm">
                {g.thumbnail_url ? (
                  <img src={g.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2">
                    <Gamepad2 className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                <button
                  onClick={() => void deleteFavoriteGame(g.id)}
                  aria-label={t("delete")}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {gameList.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noFavoriteGames")}</p>
            ) : null}
            {gameList.length < MAX_GAMES ? (
              <div className="flex gap-2">
                <Input
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder={t("favoriteGamePlaceholder")}
                  className="flex-1"
                />
                <Input
                  value={newGameUrl}
                  onChange={(e) => setNewGameUrl(e.target.value)}
                  placeholder="https:// (optional)"
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={() => void addFavoriteGame()}
                  disabled={!newGameName.trim()}
                  aria-label={t("addFavoriteGame")}
                >
                  <Gamepad2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <Label>{t("banner")}</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BANNERS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => patch({ banner_style: key, banner_url: null })}
                className={cn(
                  "h-10 w-16 rounded-xl border-2",
                  p?.banner_style === key && !p?.banner_url
                    ? "border-primary"
                    : "border-transparent",
                )}
                style={{ backgroundImage: value }}
              />
            ))}
          </div>
        </div>
        {saving || busy ? <p className="text-xs text-muted-foreground">{t("loading")}</p> : null}
      </section>

      <ProfileContentTabs
        videos={videos.data ?? []}
        reposts={reposts.data ?? []}
        photos={photos.data ?? []}
        photosEditable
        maxPhotos={MAX_PHOTOS}
        busy={busy}
        onAddPhotoClick={() => photoRef.current?.click()}
        onDeletePhoto={(id) => void deletePhoto(id)}
        onMovePhoto={(i, delta) => void movePhoto(i, delta)}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addPhoto(file);
          e.target.value = "";
        }}
      />
      <Link
        to="/discover/studio"
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-semibold"
      >
        {t("creatorStudio")}
      </Link>

      <Link
        to="/settings"
        className="mt-6 flex h-11 w-full items-center justify-center rounded-2xl border border-border text-sm font-semibold"
      >
        {t("settings")}
      </Link>

      {/* Bouton Enregistrer fixe, au-dessus de la navbar mobile */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6">
        <button
          onClick={saveChanges}
          disabled={!dirty || saving || busy}
          className={cn(
            "pointer-events-auto flex h-12 items-center gap-2 rounded-full px-7 text-sm font-bold text-white shadow-xl transition",
            dirty ? "spark-gradient bx-pop" : "bg-muted-foreground/40",
            (!dirty || saving || busy) && "cursor-not-allowed opacity-70",
          )}
        >
          <Save className="h-4.5 w-4.5" />
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    </div>
  );
}
