import { Flag } from "@/components/Flag";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Camera,
  Clapperboard,
  Crown,
  Gamepad2,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Sheet, Textarea } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { ProfileBanner, parseYouTubeId } from "@/components/ProfileBanner";
import { Verified } from "@/components/Verified";
import { ExternalLinkButton } from "@/components/ExternalLinkButton";
import { ProfileContentTabs, type TabVideo } from "@/components/ProfileContentTabs";
import { uploadFile } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useRoles } from "@/lib/roles";
import { ageFrom } from "@/lib/decorations";
import { cn } from "@/lib/utils";
import { RobloxIdentity } from "@/components/RobloxIdentity";
import { RobloxGameIcon } from "@/components/RobloxGameIcon";
import { PROFILE_FONTS, PROFILE_GLOWS, profileFontClass, profileGlowClass } from "@/lib/sparkPlus";
import {
  searchPopularRobloxGames,
  type RobloxGameSearchResult,
} from "@/lib/roblox-games.functions";

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
  const [gameSearch, setGameSearch] = useState("");
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");
  const bannerVideoRef = useRef<HTMLInputElement>(null);

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
        .select("id,name,url,position,thumbnail_url,roblox_universe_id")
        .eq("user_id", user?.id ?? "")
        .order("position");
      return data ?? [];
    },
    enabled: !!user,
  });

  const gameResults = useQuery({
    queryKey: ["roblox-game-search", gameSearch.trim()],
    enabled: gamePickerOpen && gameSearch.trim().length >= 2,
    queryFn: () => searchPopularRobloxGames({ data: { query: gameSearch.trim() } }),
    staleTime: 5 * 60 * 1000,
  });

  const myCommunities = useQuery({
    queryKey: ["my-communities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user!.id);
      const ids = (rows ?? []).map((r) => r.community_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("communities")
        .select("id,handle,name,icon_url")
        .in("id", ids);
      return data ?? [];
    },
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

  async function uploadBannerVideo(file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = await uploadFile("profile-photos", user.id, file, ext);
      patch({ banner_video_url: path });
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  function setBannerYoutube() {
    const trimmed = youtubeInput.trim();
    if (!trimmed) return;
    if (!parseYouTubeId(trimmed)) {
      toast.error(t("invalidYoutubeLink"));
      return;
    }
    patch({ banner_video_url: trimmed });
    setYoutubeInput("");
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

  async function addFavoriteGame(game: RobloxGameSearchResult) {
    if (!user || gameList.length >= MAX_GAMES) return;
    if (gameList.some((current) => current.roblox_universe_id === game.universeId)) {
      toast.error(t("duplicateGame"));
      return;
    }
    const { error } = await supabase.from("favorite_games").insert({
      user_id: user.id,
      name: game.name,
      url: game.url,
      position: gameList.length,
      roblox_universe_id: game.universeId,
      thumbnail_url: game.thumbnailUrl,
    });
    if (error) {
      toast.error(error.message.includes("max_five_games") ? t("maxFiveGames") : t("errorGeneric"));
      return;
    }
    setGameSearch("");
    setGamePickerOpen(false);
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
  const sparkPlusActive = Boolean(
    p?.spark_plus_active &&
    (!p.spark_plus_expires_at || new Date(p.spark_plus_expires_at).getTime() > Date.now()),
  );

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
        <ProfileBanner
          bannerVideoUrl={p?.banner_video_url}
          bannerUrl={p?.banner_url}
          bannerStyle={p?.banner_style}
          className="h-full w-full object-cover"
        />
        <button
          onClick={() => setEditOpen(true)}
          aria-label={t("editProfile")}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
        >
          <Pencil className="h-3.5 w-3.5" /> {t("editProfile")}
        </button>
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
          <div
            className={cn(
              "inline-block rounded-full bg-background p-1",
              profileGlowClass(p?.profile_glow),
            )}
          >
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

        <h2
          className={cn(
            "mt-3 flex items-center gap-2 text-xl font-bold",
            profileFontClass(p?.profile_font),
          )}
        >
          {p?.username}
          {sparkPlusActive ? (
            <Crown className="h-5 w-5 text-blue-500" aria-label="Spark Plus" />
          ) : null}
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
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface py-1.5 pl-1.5 pr-3 text-xs font-semibold transition hover:border-primary hover:bg-primary/5"
                >
                  <RobloxGameIcon src={g.thumbnail_url} name={g.name} className="h-8 w-8" />
                  {g.name}
                </a>
              ) : (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface py-1.5 pl-1.5 pr-3 text-xs font-semibold"
                >
                  <RobloxGameIcon src={g.thumbnail_url} name={g.name} className="h-8 w-8" />
                  {g.name}
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>

      {(myCommunities.data ?? []).length > 0 ? (
        <div className="mt-5">
          <Label>Communautés</Label>
          <div className="flex flex-wrap gap-2">
            {(myCommunities.data ?? []).map((c) => (
              <Link
                key={c.id}
                to="/communities/$handle"
                params={{ handle: c.handle }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
              >
                <StoredImage path={c.icon_url} alt="" className="h-4 w-4 rounded" fallback="🎮" />
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title={t("editProfile")}>
        <div className="max-h-[75vh] space-y-5 overflow-y-auto pb-2">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-primary">Spark Plus</p>
                <p className="text-xs text-muted-foreground">{t("premiumProfileCustomization")}</p>
              </div>
              {!sparkPlusActive ? (
                <Link
                  to="/shop"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-white"
                >
                  {t("discoverSparkPlus")}
                </Link>
              ) : null}
            </div>
            <div
              className={cn(
                "mt-4 grid gap-3 sm:grid-cols-2",
                !sparkPlusActive && "pointer-events-none opacity-45",
              )}
            >
              <div>
                <Label>{t("usernameFont")}</Label>
                <select
                  value={p?.profile_font ?? "default"}
                  onChange={(event) => patch({ profile_font: event.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {PROFILE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {t(`profileFont${font[0]!.toUpperCase()}${font.slice(1)}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("profileGlow")}</Label>
                <select
                  value={p?.profile_glow ?? "none"}
                  onChange={(event) => patch({ profile_glow: event.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {PROFILE_GLOWS.map((glow) => (
                    <option key={glow} value={glow}>
                      {t(`profileGlow${glow[0]!.toUpperCase()}${glow.slice(1)}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={cn("mt-4", !sparkPlusActive && "pointer-events-none opacity-45")}>
              <Label className="flex items-center gap-1.5">
                <Clapperboard className="h-3.5 w-3.5" /> {t("animatedBanner")}
              </Label>
              <p className="mb-2 text-xs text-muted-foreground">{t("animatedBannerHint")}</p>
              {p?.banner_video_url ? (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs">
                  <span className="truncate font-semibold">
                    {parseYouTubeId(p.banner_video_url) ? "YouTube" : t("uploadVideoBanner")}
                  </span>
                  <button
                    onClick={() => patch({ banner_video_url: null })}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bannerVideoRef.current?.click()}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-input text-xs font-semibold hover:border-primary"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> {t("uploadVideoBanner")}
                </button>
              </div>
              <input
                ref={bannerVideoRef}
                type="file"
                accept="video/mp4,image/gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBannerVideo(f);
                  e.target.value = "";
                }}
              />
              <div className="mt-2 flex gap-2">
                <Input
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder={t("youtubeLinkPlaceholder")}
                  className="h-10 text-xs"
                />
                <Button size="sm" variant="outline" onClick={setBannerYoutube} disabled={!youtubeInput.trim()}>
                  OK
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>{t("banner")}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-input text-xs font-semibold hover:border-primary"
              >
                <ImagePlus className="h-3.5 w-3.5" /> {t("banner")}
              </button>
              {p?.banner_url ? (
                <Button size="sm" variant="outline" onClick={() => patch({ banner_url: null })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

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
              {t("favoriteRobloxGames")} ({gameList.length}/{MAX_GAMES})
            </Label>
            <button
              type="button"
              disabled={gameList.length >= MAX_GAMES}
              onClick={() => setGamePickerOpen((open) => !open)}
              className="mb-3 flex w-full items-center justify-between rounded-2xl border border-input bg-background/75 px-4 py-3 text-left text-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Search className="h-4 w-4 text-primary" /> {t("popularGameSearch")}
              </span>
              <Plus className="h-4 w-4" />
            </button>
            {gamePickerOpen ? (
              <div className="mb-3 overflow-hidden rounded-2xl border border-primary/30 bg-popover shadow-xl">
                <div className="flex items-center gap-2 border-b border-border px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={gameSearch}
                    onChange={(event) => setGameSearch(event.target.value)}
                    placeholder="Brookhaven, Adopt Me, Blox Fruits…"
                    className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  {gameResults.isFetching ? (
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                  ) : null}
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {gameSearch.trim().length < 2 ? (
                    <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                      {t("gameSearchHint")}
                    </p>
                  ) : null}
                  {(gameResults.data ?? []).map((game) => (
                    <button
                      key={game.universeId}
                      type="button"
                      onClick={() => void addFavoriteGame(game)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-primary/10"
                    >
                      {game.thumbnailUrl ? (
                        <img
                          src={game.thumbnailUrl}
                          alt=""
                          className="h-11 w-11 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">
                          <Gamepad2 className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{game.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("playersOnline", { count: game.playerCount.toLocaleString() })}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                  {gameResults.isError ? (
                    <p className="px-3 py-6 text-center text-xs text-destructive">
                      {t("robloxSearchUnavailable")}
                    </p>
                  ) : null}
                  {gameResults.isSuccess && !gameResults.data.length ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      {t("noGamesFound")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              {gameList.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2 text-sm"
                >
                  <RobloxGameIcon src={g.thumbnail_url} name={g.name} className="h-10 w-10" />
                  <a
                    href={g.url ?? undefined}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-w-0 flex-1 truncate font-semibold"
                  >
                    {g.name}
                  </a>
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
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!dirty || saving || busy}
            onClick={() => void saveChanges()}
          >
            <Save className="h-4 w-4" />
            {saving || busy ? t("loading") : t("save")}
          </Button>
        </div>
      </Sheet>

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
