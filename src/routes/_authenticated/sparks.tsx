import { Flag } from "@/components/Flag";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Gamepad2, Heart, SlidersHorizontal, Star, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button, Select, Sheet } from "@/components/ui-kit";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { ACCENTS, BANNERS, FRAMES, STICKERS, ageFrom } from "@/lib/decorations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sparks")({
  head: () => ({
    meta: [
      { title: "Sparks — Bloxspark" },
      { name: "description", content: "Swipe les profils de joueurs Roblox et trouve tes matchs." },
      { property: "og:title", content: "Sparks — Bloxspark" },
      { property: "og:description", content: "Swipe, matche et discute." },
    ],
  }),
  component: SparksPage,
});

type DeckProfile = {
  id: string;
  username: string | null;
  roblox_username: string | null;
  bio: string | null;
  language: string;
  birth_date: string | null;
  banner_style: string;
  frame_style: string;
  accent_color: string;
  sticker: string | null;
  avatar_url: string | null;
  verified: boolean | null;
};

function SparksPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"deck" | "matches">("deck");
  const [filters, setFilters] = useState({ lang: "", min: 13, max: 99 });
  const [showFilters, setShowFilters] = useState(false);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [match, setMatch] = useState<{ name: string; conversationId: string } | null>(null);

  const { data: deck = [], refetch } = useQuery({
    queryKey: ["deck", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("spark_deck", {
        _limit: 30,
        _min_age: filters.min,
        _max_age: filters.max,
        ...(filters.lang ? { _lang: filters.lang } : {}),
      });
      if (error) throw error;
      setIndex(0);
      return (data ?? []) as unknown as DeckProfile[];
    },
  });

  const { data: photos = {} } = useQuery({
    queryKey: ["deck-photos", deck.map((d) => d.id).join(",")],
    enabled: deck.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_photos")
        .select("user_id,url,position")
        .in(
          "user_id",
          deck.map((d) => d.id),
        )
        .order("position");
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        (map[row.user_id] ??= []).push(row.url);
      }
      return map;
    },
  });

  const current = deck[index];
  const next = deck[index + 1];

  async function swipe(action: "like" | "pass" | "super") {
    if (!current) return;
    const target = current;
    setIndex((i) => i + 1);
    setDrag(0);
    const { data, error } = await supabase.rpc("perform_swipe", {
      _target: target.id,
      _action: action,
    });
    if (error) {
      toast.error(t("errorGeneric"));
      return;
    }
    const result = data as unknown as { match: boolean; conversation_id?: string };
    if (result?.match && result.conversation_id) {
      setMatch({ name: target.username ?? "?", conversationId: result.conversation_id });
    }
  }

  const cardStyle = useMemo(
    () => ({
      transform: `translateX(${drag}px) rotate(${drag / 25}deg)`,
      transition: drag === 0 ? "transform .25s ease" : "none",
    }),
    [drag],
  );

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4">
      <header className="flex items-center justify-between">
        <Logo className="h-11" />
        <Button variant="ghost" size="icon" onClick={() => setShowFilters(true)} aria-label={t("filters")}>
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative mt-4 h-[62vh] min-h-100">
        {!current ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border text-center text-muted-foreground">
            <p className="px-8">{t("noMoreProfiles")}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              {t("loading")}
            </Button>
          </div>
        ) : (
          <>
            {next ? <SparkCard profile={next} photos={photos[next.id] ?? []} className="scale-95 opacity-60" /> : null}
            <div
              style={cardStyle}
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={(e) => {
                if (e.buttons === 1) setDrag((d) => d + e.movementX);
              }}
              onPointerUp={() => {
                if (drag > 110) void swipe("like");
                else if (drag < -110) void swipe("pass");
                else setDrag(0);
              }}
              className="absolute inset-0 touch-none"
            >
              <SparkCard profile={current} photos={photos[current.id] ?? []} />
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          onClick={() => swipe("pass")}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-muted-foreground active:scale-95"
        >
          <X className="h-7 w-7" />
        </button>
        <button
          onClick={() => swipe("super")}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-spark-2 active:scale-95"
        >
          <Star className="h-6 w-6" />
        </button>
        <button
          onClick={() => swipe("like")}
          className="spark-gradient flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30 active:scale-95"
        >
          <Heart className="h-8 w-8" fill="currentColor" />
        </button>
      </div>

      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title={t("filters")}>
        <div className="space-y-4">
          <Select value={filters.lang} onChange={(e) => setFilters((f) => ({ ...f, lang: e.target.value }))}>
            <option value="">{t("allLanguages")}</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.label}
              </option>
            ))}
          </Select>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              {t("ageRange")}: {filters.min} – {filters.max}
            </p>
            <div className="flex gap-3">
              <input
                type="range"
                min={13}
                max={99}
                value={filters.min}
                onChange={(e) => setFilters((f) => ({ ...f, min: Number(e.target.value) }))}
                className="flex-1 accent-[var(--spark)]"
              />
              <input
                type="range"
                min={13}
                max={99}
                value={filters.max}
                onChange={(e) => setFilters((f) => ({ ...f, max: Number(e.target.value) }))}
                className="flex-1 accent-[var(--spark)]"
              />
            </div>
          </div>
          <Button className="w-full" onClick={() => setShowFilters(false)}>
            {t("save")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!match} onClose={() => setMatch(null)}>
        <div className="py-4 text-center">
          <p className="text-5xl">✨</p>
          <h2 className="spark-text mt-3 text-3xl font-bold">{t("itsAMatch")}</h2>
          <p className="mt-1 text-muted-foreground">{match?.name}</p>
          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                if (match) navigate({ to: "/messages/$id", params: { id: match.conversationId } });
              }}
            >
              {t("sendMessage")}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setMatch(null)}>
              {t("keepSwiping")}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function SparkCard({
  profile,
  photos,
  className,
}: {
  profile: DeckProfile;
  photos: string[];
  className?: string;
}) {
  const { t } = useI18n();
  const age = ageFrom(profile.birth_date);
  
  const accent = ACCENTS[profile.accent_color] ?? ACCENTS["spark"];

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl",
        className,
      )}
    >
      <div className="relative h-full">
        {photos[0] ? (
          <StoredImage path={photos[0]} alt={profile.username ?? ""} className="h-full w-full" />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundImage: BANNERS[profile.banner_style] ?? BANNERS["nebula"] }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16 text-white">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{profile.username}</h2>
            {age ? (
              <span className="text-lg">
                {age} {t("years")}
              </span>
            ) : null}
            <Flag code={profile.language ?? ""} className="h-4 w-6" />
            {profile.sticker && STICKERS.includes(profile.sticker) ? (
              <span className="text-xl">{profile.sticker}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm opacity-90">🎮 {profile.roblox_username}</p>
          {profile.bio ? <p className="mt-2 line-clamp-3 text-sm opacity-90">{profile.bio}</p> : null}
          <span
            className={cn("mt-3 inline-block h-1.5 w-16 rounded-full", FRAMES[profile.frame_style] ? "" : "")}
            style={{ backgroundColor: accent }}
          />
        </div>
      </div>
    </div>
  );
}
