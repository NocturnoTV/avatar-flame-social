import { Flag } from "@/components/Flag";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  ImagePlus,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useRoles } from "@/lib/roles";
import { ACCENTS, BANNERS, FRAMES, STICKERS, ageFrom } from "@/lib/decorations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — Bloxspark" },
      { name: "description", content: "Personnalise ton profil Bloxspark : avatar, photos, bio, jeux Roblox préférés." },
      { property: "og:title", content: "Mon profil — Bloxspark" },
      { property: "og:description", content: "Décore ton profil de joueur Roblox." },
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
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gameName, setGameName] = useState("");
  const [gameUrl, setGameUrl] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown>>({});

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
    queryKey: ["my-games"],
    queryFn: async () => {
      const { data } = await supabase
        .from("roblox_games")
        .select("id,name,url,position")
        .eq("user_id", user?.id ?? "")
        .order("position");
      return data ?? [];
    },
    enabled: !!user,
  });

  // Les modifications sont mises en brouillon et enregistrées uniquement au clic sur "Enregistrer".
  function patch(values: Record<string, unknown>) {
    setDraft((d) => ({ ...d, ...values }));
  }

  const dirty = Object.keys(draft).length > 0;

  async function saveChanges() {
    if (!user || !dirty) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(draft as never).eq("id", user.id);
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

  async function addGame() {
    if (!user || !gameName.trim()) return;
    if ((games.data?.length ?? 0) >= MAX_GAMES) {
      toast.error(`Maximum ${MAX_GAMES} jeux.`);
      return;
    }
    const { error } = await supabase.from("roblox_games").insert({
      user_id: user.id,
      name: gameName.trim().slice(0, 60),
      url: gameUrl.trim() ? gameUrl.trim().slice(0, 300) : null,
      position: games.data?.length ?? 0,
    });
    if (error) {
      toast.error(error.message.includes("max_five_games") ? `Maximum ${MAX_GAMES} jeux.` : t("errorGeneric"));
      return;
    }
    setGameName("");
    setGameUrl("");
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
            <Link to="/admin" aria-label="Administration" className="text-muted-foreground hover:text-foreground">
              <ShieldCheck className="h-6 w-6" />
            </Link>
          ) : null}
          <Link to="/parametres" aria-label={t("settings")}>
            <Settings className="h-6 w-6" />
          </Link>
        </div>
      </header>

      {/* Bannière */}
      <div className="relative mt-4 overflow-hidden rounded-3xl">
        {p?.banner_url ? (
          <StoredImage path={p.banner_url} alt="" className="h-36 w-full" />
        ) : (
          <div
            className="h-36 w-full"
            style={{ backgroundImage: BANNERS[p?.banner_style ?? "nebula"] ?? BANNERS["nebula"] }}
          />
        )}
        <button
          onClick={() => bannerRef.current?.click()}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Bannière
        </button>
        {p?.banner_url ? (
          <button
            onClick={() => patch({ banner_url: null })}
            className="absolute right-3 bottom-3 rounded-full bg-black/55 p-1.5 text-white backdrop-blur"
            aria-label="Retirer la bannière"
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
      <div className="-mt-12 px-1">
        <div className="relative inline-block">
          <div
            className={cn("inline-block rounded-full p-1", FRAMES[p?.frame_style ?? "none"] ?? "")}
            style={{ boxShadow: `0 0 0 3px ${ACCENTS[p?.accent_color ?? "spark"] ?? "#ff5f6d"}` }}
          >
            <StoredImage
              path={p?.avatar_url ?? photos.data?.[0]?.url}
              alt={p?.username ?? ""}
              className="h-24 w-24 rounded-full"
            />
          </div>
          <button
            onClick={() => avatarRef.current?.click()}
            className="spark-gradient absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg"
            aria-label="Changer d'avatar Roblox"
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
          {p?.sticker ? <span>{p.sticker}</span> : null}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Gamepad2 className="h-4 w-4" /> {p?.roblox_username}
          </span>
          {age ? <span>· {age} {t("years")}</span> : null}
          <Flag code={p?.language ?? ""} />
        </p>
        {p?.bio ? <p className="mt-2 whitespace-pre-line text-sm">{p.bio}</p> : null}

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

      {/* Galerie */}
      <section className="mt-6">
        <Label>
          {t("photos")} ({photos.data?.length ?? 0}/{MAX_PHOTOS})
        </Label>
        <div className="flex flex-wrap gap-2">
          {(photos.data ?? []).map((ph, i) => (
            <div key={ph.id} className="relative">
              <StoredImage path={ph.url} alt="" className="h-24 w-24 rounded-2xl" />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                  1
                </span>
              ) : null}
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
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button
                  onClick={() => movePhoto(i, -1)}
                  disabled={i === 0}
                  className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                  aria-label="Déplacer à gauche"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => movePhoto(i, 1)}
                  disabled={i === (photos.data?.length ?? 1) - 1}
                  className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                  aria-label="Déplacer à droite"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {(photos.data?.length ?? 0) < MAX_PHOTOS ? (
            <button
              onClick={() => photoRef.current?.click()}
              className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              <ImagePlus className="h-6 w-6" />
            </button>
          ) : null}
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
        </div>
      </section>

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
          <Label>Mes jeux Roblox préférés ({gameList.length}/{MAX_GAMES})</Label>
          <div className="space-y-2">
            {gameList.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-2xl bg-surface px-3 py-2 text-sm">
                <span className="truncate">{g.name}</span>
                <button
                  onClick={async () => {
                    await supabase.from("roblox_games").delete().eq("id", g.id);
                    void games.refetch();
                  }}
                  aria-label={t("delete")}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {gameList.length < MAX_GAMES ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="Nom du jeu (ex : Blox Fruits)"
                  maxLength={60}
                />
                <Input
                  value={gameUrl}
                  onChange={(e) => setGameUrl(e.target.value)}
                  placeholder="Lien (facultatif)"
                  maxLength={300}
                />
                <Button size="md" onClick={addGame} disabled={!gameName.trim()} className="shrink-0">
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>
            ) : null}
          </div>
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
                onClick={() => patch({ banner_style: key, banner_url: null })}
                className={cn(
                  "h-10 w-16 rounded-xl border-2",
                  p?.banner_style === key && !p?.banner_url ? "border-primary" : "border-transparent",
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
        {saving || busy ? <p className="text-xs text-muted-foreground">{t("loading")}</p> : null}
      </section>

      <Link
        to="/parametres"
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
          {saving ? t("loading") : dirty ? "Enregistrer les modifications" : t("saved")}
        </button>
      </div>
    </div>
  );
}
