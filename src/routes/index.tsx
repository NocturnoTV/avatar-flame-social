import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Flame, MessageCircle, Play, ShieldCheck, Sparkles, Users } from "lucide-react";
import { LogoWordmark } from "@/components/Logo";
import { ThreeBackground } from "@/components/landing/ThreeBackground";
import { Button } from "@/components/ui-kit";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BloxSpark — Meet your Roblox community" },
      {
        name: "description",
        content:
          "Discover Roblox players, share videos, find your people and chat safely on BloxSpark. Free to join — sign up with your Roblox account.",
      },
      { property: "og:title", content: "BloxSpark — The social world for Roblox players" },
      {
        property: "og:description",
        content: "Profiles, vertical videos, Sparks, stories and real conversations.",
      },
      { property: "og:image", content: "https://bloxspark.app/bloxspark-hero-banner.png" },
      { property: "og:url", content: "https://bloxspark.app/" },
      { name: "twitter:title", content: "BloxSpark — The social world for Roblox players" },
      {
        name: "twitter:description",
        content: "Profiles, vertical videos, Sparks, stories and real conversations.",
      },
      { name: "twitter:image", content: "https://bloxspark.app/bloxspark-hero-banner.png" },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "BloxSpark",
          url: "https://bloxspark.app/",
          description:
            "BloxSpark connects Roblox players worldwide: discover profiles, share videos, match with Sparks and chat safely.",
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "BloxSpark",
          url: "https://bloxspark.app/",
          logo: "https://bloxspark.app/bloxspark-logo.png",
        },
      },
    ],
    links: [{ rel: "canonical", href: "https://bloxspark.app/" }],
  }),
  component: Landing,
});

function Landing() {
  const { t, lang, setLang } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (session) void navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  const features = [
    { icon: Flame, title: t("landingDiscoverTitle"), text: t("landingDiscoverText") },
    { icon: Play, title: t("landingCreateTitle"), text: t("landingCreateText") },
    { icon: MessageCircle, title: t("landingChatTitle"), text: t("landingChatText") },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#030914] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#030914]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <LogoWordmark className="h-7 w-auto sm:h-9" forceVariant="dark" />
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
              aria-label={t("language")}
              className="max-w-12 rounded-full border border-white/15 bg-white/5 px-2 py-2 text-xs text-white outline-none sm:max-w-none sm:px-3"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="text-black">
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
            <Link to="/auth">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {t("signIn")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen overflow-hidden bg-[#030914] px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="absolute inset-0 opacity-70">
            <ThreeBackground />
          </div>
          <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.38),transparent_65%)]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="bx-landing-reveal relative overflow-hidden rounded-[1.6rem] border border-sky-300/25 bg-blue-950/40 shadow-[0_24px_100px_rgba(14,165,233,.28)] sm:rounded-[2.5rem]">
              <img
                src="/bloxspark-hero-banner.png"
                alt="BloxSpark Roblox community"
                className="block aspect-[3/1] min-h-40 w-full object-cover object-center sm:min-h-64"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030914]/55 via-transparent to-white/5" />
              <div className="pointer-events-none absolute inset-0 bx-banner-sheen" />
            </div>

            <div className="relative mx-auto -mt-5 max-w-5xl rounded-[1.8rem] border border-white/10 bg-[#061329]/85 px-5 py-8 text-center shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:-mt-16 sm:px-10 sm:py-12">
              <span className="bx-landing-reveal bx-delay-1 inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-blue-500/15 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-sky-100 sm:text-xs">
                <Sparkles className="h-4 w-4 text-sky-300" /> {t("landingEyebrow")}
              </span>
              <h1 className="bx-landing-reveal bx-delay-2 mx-auto mt-5 max-w-4xl text-[2.65rem] font-black leading-[.95] tracking-[-.055em] sm:text-7xl lg:text-8xl">
                {t("landingHeroTitle")}
              </h1>
              <p className="bx-landing-reveal bx-delay-3 mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-blue-100/75 sm:text-xl">
                {t("landingHeroText")}
              </p>
              <div className="bx-landing-reveal bx-delay-4 mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="bx-star-cta group relative inline-flex min-h-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600 px-8 font-black text-white shadow-[0_0_45px_rgba(56,189,248,.55)] transition duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_0_70px_rgba(56,189,248,.8)]"
              >
                <span className="bx-cta-shine absolute inset-y-0 w-24 -skew-x-12 bg-white/60 blur-md" />
                <Sparkles className="bx-cta-star absolute left-4 top-2 h-3 w-3" />
                <Sparkles className="bx-cta-star bx-delay-2 absolute bottom-2 right-5 h-4 w-4" />
                <span className="relative z-10 flex items-center gap-2">
                  {t("landingJoin")} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
              <Link to="/auth" className="inline-block">
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-14 w-full rounded-full border-white/20 bg-white/5 px-8 text-white backdrop-blur hover:bg-white/10 sm:w-auto"
                >
                  {t("signIn")}
                </Button>
              </Link>
              </div>
              <div className="bx-landing-reveal bx-delay-4 mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs font-bold text-white/65">
              <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-400" /> {t("landingSafe")}
              </span>
              <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-400" /> {t("landingCommunity")}
              </span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-5 py-24">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[100px]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.28em] text-sky-400">
              {t("landingBuiltFor")}
            </p>
            <h2 className="mt-4 text-4xl font-black sm:text-6xl">{t("landingSectionTitle")}</h2>
          </div>
          <div className="relative mt-12 grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="group rounded-[2rem] border border-white/10 bg-white/[.045] p-7 backdrop-blur transition duration-300 hover:-translate-y-2 hover:border-sky-400/50 hover:bg-blue-500/10"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <f.icon className="h-7 w-7" />
                </span>
                <h3 className="mt-6 text-xl font-black">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-blue-100/60">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="mx-5 mb-16 overflow-hidden rounded-[2.5rem] border border-sky-400/20 bg-gradient-to-br from-blue-600 to-blue-950 px-6 py-16 text-center sm:mx-auto sm:max-w-6xl sm:px-16"
        >
          <Sparkles className="mx-auto h-9 w-9 text-sky-200 bx-float" />
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black sm:text-6xl">
            {t("landingCtaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-blue-100/70">{t("landingCtaText")}</p>
          <Link to="/auth" search={{ mode: "signup" }} className="inline-block">
            <Button size="lg" className="mt-8 bg-white text-blue-700 shadow-xl hover:scale-105">
              {t("getStarted")}
            </Button>
          </Link>
        </section>
      </main>
      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-blue-100/45">
        <div className="mb-3 flex justify-center gap-5">
          <Link to="/terms">{t("terms")}</Link>
          <Link to="/privacy">{t("privacy")}</Link>
          <Link to="/community-guidelines">{t("rules")}</Link>
        </div>
        <p>{t("notAffiliated")}</p>
      </footer>
    </div>
  );
}
