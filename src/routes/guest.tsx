import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, MessageCircle, Settings, ShieldCheck, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState, type UIEvent } from "react";
import { Logo } from "@/components/Logo";
import { Button, Select } from "@/components/ui-kit";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { useTheme, type ThemeName } from "@/lib/theme";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/guest")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guest preview — BloxSpark" },
      { name: "description", content: "Explore the BloxSpark community as a guest." },
    ],
  }),
  component: GuestPage,
});

type GuestProfile = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  roblox_display_name: string | null;
  roblox_username: string | null;
  roblox_avatar_url: string | null;
  language: string;
  verified: boolean;
};

const DEMO_PROFILES: GuestProfile[] = (
  [
    ["NovaBuilder", "Building neon worlds one block at a time.", "en"],
    ["LunaPlays", "Obbies, adventures and good vibes.", "en"],
    ["PixelRider", "Toujours partant pour une nouvelle partie !", "fr"],
    ["SkyQuest", "Exploring every corner of Roblox.", "en"],
    ["BlueComet", "Creator, player, dreamer.", "de"],
    ["GameWave", "Vamos jogar juntos!", "pt"],
  ] as const
).map(([username, bio, language], index) => ({
  id: `demo-${index}`,
  username,
  bio,
  language,
  avatar_url: null,
  roblox_display_name: username,
  roblox_username: username,
  roblox_avatar_url: null,
  verified: index === 0,
}));

function GuestPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gate, setGate] = useState<"limit" | "messages" | null>(null);

  useEffect(() => {
    if (window.localStorage.getItem("bloxspark-guest") !== "true") {
      window.localStorage.setItem("bloxspark-guest", "true");
      window.localStorage.removeItem("bloxspark-guest-gate-seen");
      setLang("en");
      setTheme("dark");
    }
  }, [setLang, setTheme]);

  useEffect(() => {
    if (session) navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  const profiles = useQuery({
    queryKey: ["guest-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("guest_profiles", { _limit: 40 });
      if (error) throw error;
      return data as GuestProfile[];
    },
    retry: false,
  });

  const feed = useMemo(() => {
    const source = profiles.data?.length ? profiles.data : DEMO_PROFILES;
    return Array.from(
      { length: Math.max(24, source.length) },
      (_, index) => source[index % source.length],
    );
  }, [profiles.data]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const viewed =
      Math.floor((element.scrollTop + element.clientHeight * 0.6) / element.clientHeight) + 1;
    if (viewed >= 15 && window.localStorage.getItem("bloxspark-guest-gate-seen") !== "true") {
      window.localStorage.setItem("bloxspark-guest-gate-seen", "true");
      setGate("limit");
    }
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <Logo className="h-9" />
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            {t("guestBadge")}
          </span>
        </div>
      </header>

      <main
        className="h-full snap-y snap-mandatory overflow-y-auto pt-16 pb-20"
        onScroll={onScroll}
      >
        {feed.map((profile, index) => (
          <article
            key={`${profile.id}-${index}`}
            className="flex min-h-[calc(100dvh-9rem)] snap-start items-center justify-center px-5 py-8"
          >
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-primary/20 bg-card shadow-xl shadow-primary/10">
              <div className="h-32 bg-gradient-to-br from-sky-300 via-blue-400 to-blue-600" />
              <div className="relative p-6 pt-14">
                <div className="absolute -top-12 left-6 grid h-24 w-24 place-items-center overflow-hidden rounded-3xl border-4 border-card bg-surface-2 text-3xl font-black text-primary">
                  {profile.roblox_avatar_url || profile.avatar_url ? (
                    <img
                      src={profile.roblox_avatar_url ?? profile.avatar_url ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (profile.roblox_display_name ?? profile.username ?? "B")
                      .slice(0, 1)
                      .toUpperCase()
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold">
                    {profile.roblox_display_name ?? profile.username ?? "BloxSpark player"}
                  </h2>
                  {profile.verified ? <ShieldCheck className="h-5 w-5 text-primary" /> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  @{profile.roblox_username ?? profile.username ?? "player"} ·{" "}
                  {profile.language.toUpperCase()}
                </p>
                <p className="mt-5 min-h-12 leading-relaxed">{profile.bio ?? t("guestSubtitle")}</p>
                <div className="mt-6 flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                  <Compass className="h-4 w-4" /> {t("guestTitle")}
                </div>
              </div>
            </div>
          </article>
        ))}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-3">
          <button className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-primary">
            <Compass className="h-5 w-5" /> {t("discover")}
          </button>
          <button
            onClick={() => setGate("messages")}
            className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"
          >
            <MessageCircle className="h-5 w-5" /> {t("messages")}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"
          >
            <Settings className="h-5 w-5" /> {t("settings")}
          </button>
        </div>
      </nav>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <button
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setSettingsOpen(false)}
          />
          <section className="relative w-full rounded-t-[2rem] border border-border bg-card p-6 sm:max-w-sm sm:rounded-[2rem]">
            <button
              className="absolute right-5 top-5"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold">{t("guestSettings")}</h2>
            <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("language")}
            </label>
            <Select
              className="mt-2"
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.flag} {language.label}
                </option>
              ))}
            </Select>
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("theme")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["dark", "light"] as ThemeName[]).map((value) => (
                <Button
                  key={value}
                  variant={theme === value ? "primary" : "outline"}
                  onClick={() => setTheme(value)}
                >
                  {t(value)}
                </Button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {gate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-md">
          <section className="w-full max-w-sm rounded-[2rem] border border-primary/30 bg-card p-7 text-center shadow-2xl shadow-primary/20">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <UserPlus className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-2xl font-extrabold">{t("guestGateTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {gate === "messages" ? t("guestMessagesLocked") : t("guestGateBody")}
            </p>
            <Link to="/auth" search={{ mode: "signup" }} className="mt-6 block">
              <Button className="w-full" size="lg">
                {t("createAccount")}
              </Button>
            </Link>
            <button
              className="mt-4 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setGate(null)}
            >
              {t("continueBrowsing")}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
