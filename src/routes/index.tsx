import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Heart, MessageCircle, Play, Sparkles, UserRound } from "lucide-react";
import { LogoWordmark } from "@/components/Logo";
import { ThreeBackground } from "@/components/landing/ThreeBackground";
import { Reveal } from "@/components/Reveal";
import { RobloxMark } from "@/components/RobloxIdentity";
import { Button } from "@/components/ui-kit";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BloxSpark - Meet your Roblox community" },
      {
        name: "description",
        content:
          "Discover Roblox players, share videos, find your people and chat safely on BloxSpark. Free to join - sign up with your Roblox account.",
      },
      { property: "og:title", content: "BloxSpark - The social world for Roblox players" },
      {
        property: "og:description",
        content: "Profiles, vertical videos, Sparks, stories and real conversations.",
      },
      { property: "og:image", content: "https://bloxspark.app/bloxspark-hero-banner.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "400" },
      { property: "og:image:alt", content: "BloxSpark - The social world for Roblox players" },
      { property: "og:url", content: "https://bloxspark.app/" },
      { name: "twitter:title", content: "BloxSpark - The social world for Roblox players" },
      {
        name: "twitter:description",
        content: "Profiles, vertical videos, Sparks, stories and real conversations.",
      },
      { name: "twitter:image", content: "https://bloxspark.app/bloxspark-hero-banner.png" },
      {
        name: "twitter:image:alt",
        content: "BloxSpark - The social world for Roblox players",
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "BloxSpark",
          url: "https://bloxspark.app/",
          description:
            "BloxSpark connects Roblox players worldwide: discover profiles, share videos, match with Sparks and chat safely.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://bloxspark.app/discover?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
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
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "BloxSpark",
          url: "https://bloxspark.app/",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Web",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
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

  const journey = [
    { number: "01", title: t("landingStep1Title"), text: t("landingStep1Text") },
    { number: "02", title: t("landingStep2Title"), text: t("landingStep2Text") },
    { number: "03", title: t("landingStep3Title"), text: t("landingStep3Text") },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#090313] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#090313]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <LogoWordmark className="h-7 w-auto sm:h-9" forceVariant="dark" />
          <div className="flex items-center gap-2">
            <div className="relative flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 transition hover:bg-white/10">
              <img
                src={`/flags/${lang}.png`}
                alt=""
                className="h-4 w-6 rounded-sm object-cover shadow-sm"
              />
              <span className="hidden text-xs font-bold text-white/80 sm:block">
                {LANGUAGES.find((language) => language.code === lang)?.label}
              </span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as typeof lang)}
                aria-label={t("language")}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
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
        <section className="relative min-h-screen overflow-hidden bg-[#090313] px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="absolute inset-0 opacity-70">
            <ThreeBackground />
          </div>
          <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.42),transparent_65%)]" />
          <div className="bx-aurora pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-violet-600/25 blur-[90px]" />
          <div className="bx-aurora bx-delay-3 pointer-events-none absolute -right-24 top-64 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[100px]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="bx-landing-reveal relative overflow-hidden rounded-[1.6rem] border border-fuchsia-300/30 bg-purple-950/45 shadow-[0_24px_110px_rgba(168,85,247,.38)] ring-1 ring-white/10 sm:rounded-[2.5rem]">
              <img
                src="/bloxspark-hero-banner.png"
                alt="BloxSpark Roblox community"
                className="block aspect-[3/1] min-h-40 w-full object-cover object-center sm:min-h-64"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090313]/60 via-transparent to-white/5" />
              <div className="pointer-events-none absolute inset-0 bx-banner-sheen" />
              <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-fuchsia-200/90 to-transparent shadow-[0_0_24px_rgba(232,121,249,.9)]" />
            </div>

            <div className="relative mx-auto -mt-5 max-w-5xl rounded-[1.8rem] border border-fuchsia-200/15 bg-[#160828]/88 px-5 py-8 text-center shadow-[0_30px_100px_rgba(0,0,0,.55),0_0_70px_rgba(168,85,247,.14)] backdrop-blur-2xl sm:-mt-16 sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/80 to-transparent" />
              {/* A floating Roblox avatar breaking out of the card's top edge -
                  hidden on the smallest screens where there's no room for it
                  without crowding the headline. */}
              <div className="bx-landing-reveal bx-delay-1 pointer-events-none absolute -top-16 right-4 hidden sm:block lg:-top-20 lg:right-10">
                <div className="bx-float absolute inset-0 -z-10 rounded-full bg-fuchsia-500/30 blur-3xl" />
                <img
                  src="/landing/hero-avatar-1.webp"
                  alt=""
                  className="bx-float h-28 w-28 object-contain drop-shadow-[0_18px_40px_rgba(168,85,247,.55)] lg:h-36 lg:w-36"
                />
              </div>
              <span className="bx-landing-reveal bx-delay-1 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/35 bg-purple-500/20 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-purple-100 sm:text-xs">
                <Sparkles className="h-4 w-4 text-fuchsia-300" /> {t("landingEyebrow")}
              </span>
              <h1 className="bx-landing-reveal bx-delay-2 mx-auto mt-5 max-w-4xl text-[2.65rem] font-black leading-[.95] tracking-[-.055em] sm:text-7xl lg:text-8xl">
                {t("landingHeroTitle")}
              </h1>
              <p className="bx-landing-reveal bx-delay-3 mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed text-purple-100/75 sm:text-xl">
                {t("landingHeroText")}
              </p>
              <div className="bx-landing-reveal bx-delay-4 mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="bx-star-cta group relative inline-flex min-h-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-violet-700 via-fuchsia-500 to-violet-700 px-8 font-black text-white shadow-[0_0_45px_rgba(217,70,239,.58)] transition duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_0_70px_rgba(217,70,239,.85)]"
                >
                  <span className="bx-cta-shine absolute inset-y-0 w-24 -skew-x-12 bg-white/60 blur-md" />
                  <span className="relative z-10 flex items-center gap-2">
                    {t("landingJoin")}{" "}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
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
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-5 py-24 sm:py-32">
          <div className="pointer-events-none absolute left-0 top-24 h-96 w-96 rounded-full bg-violet-700/20 blur-[120px]" />
          <Reveal className="relative mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.28em] text-fuchsia-400">
              {t("landingShowcaseEyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">
              {t("landingShowcaseTitle")}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-purple-100/60 sm:text-lg">
              {t("landingShowcaseText")}
            </p>
          </Reveal>

          <div className="relative mt-14 grid gap-5 lg:grid-cols-12">
            <Reveal className="lg:col-span-7" y={42}>
              <article className="group h-full overflow-hidden rounded-[2.2rem] border border-violet-300/15 bg-gradient-to-br from-violet-950/90 to-[#10051f] p-6 shadow-2xl sm:p-9">
                <div className="flex items-center gap-3 text-fuchsia-300">
                  <UserRound className="h-5 w-5" />
                  <span className="text-xs font-black uppercase tracking-[.2em]">
                    {t("profile")}
                  </span>
                </div>
                <h3 className="mt-5 text-3xl font-black sm:text-4xl">
                  {t("landingIdentityTitle")}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-purple-100/60 sm:text-base">
                  {t("landingIdentityText")}
                </p>
                <div className="relative mt-8 overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[.055] p-5 backdrop-blur-xl transition duration-500 group-hover:border-fuchsia-300/30 group-hover:shadow-[0_20px_60px_rgba(168,85,247,.22)] sm:p-7">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
                  <div className="relative flex items-center gap-4">
                    <img
                      src="/landing/roblox-profile.png"
                      alt="Purple Roblox avatar"
                      className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-fuchsia-400/30"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xl font-black">PurpleSpark</span>
                        <RobloxMark className="h-5 w-5" />
                      </div>
                      <p className="mt-1 text-sm text-purple-100/50">@PurpleSpark · Creator</p>
                      <div className="mt-3 flex gap-5 text-xs">
                        <span>
                          <strong className="text-white">14.8K</strong> followers
                        </span>
                        <span>
                          <strong className="text-white">328K</strong> likes
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative mt-5 flex flex-wrap gap-2">
                    <span className="flex items-center gap-2 rounded-full bg-violet-500/20 py-1.5 pl-1.5 pr-3 text-xs font-bold">
                      <img
                        src="/landing/game-brookhaven.png"
                        alt=""
                        className="h-7 w-7 rounded-lg"
                      />
                      Brookhaven
                    </span>
                    <span className="flex items-center gap-2 rounded-full bg-fuchsia-500/15 py-1.5 pl-1.5 pr-3 text-xs font-bold">
                      <img
                        src="/landing/game-blox-fruits.png"
                        alt=""
                        className="h-7 w-7 rounded-lg"
                      />
                      Blox Fruits
                    </span>
                    <span className="flex items-center gap-2 rounded-full bg-white/5 py-1.5 pl-1.5 pr-3 text-xs font-bold">
                      <img src="/landing/game-adopt-me.png" alt="" className="h-7 w-7 rounded-lg" />
                      Adopt Me!
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>

            <Reveal className="lg:col-span-5" delay={140} y={42}>
              <article className="group h-full overflow-hidden rounded-[2.2rem] border border-fuchsia-300/15 bg-gradient-to-b from-fuchsia-950/70 to-[#10051f] p-6 shadow-2xl sm:p-9">
                <div className="flex items-center gap-3 text-fuchsia-300">
                  <Play className="h-5 w-5" />
                  <span className="text-xs font-black uppercase tracking-[.2em]">
                    {t("discover")}
                  </span>
                </div>
                <h3 className="mt-5 text-3xl font-black">{t("landingFeedTitle")}</h3>
                <p className="mt-3 text-sm leading-relaxed text-purple-100/60">
                  {t("landingFeedText")}
                </p>
                <div className="relative mx-auto mt-7 aspect-[9/11] max-h-[350px] overflow-hidden rounded-[1.8rem] border border-white/15 shadow-[0_25px_70px_rgba(217,70,239,.25)]">
                  <img
                    src="/landing/discover-world.png"
                    alt="Roblox creators gathered in a city"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/20" />
                  {/* This overlay used to sit flush against the frame's rounded
                      edges (no padding) - on narrower cards the "FOR YOU" badge
                      and caption text got visually clipped by the border-radius
                      itself. The padding keeps everything inside the visible,
                      unclipped area at every width. */}
                  <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
                    <span className="w-fit rounded-full bg-black/30 px-3 py-1.5 text-[10px] font-black backdrop-blur">
                      FOR YOU
                    </span>
                    <div>
                      <div className="mb-3 flex justify-end">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
                          <Heart className="h-5 w-5 fill-white" />
                        </span>
                      </div>
                      <p className="font-black">@sparkcreator</p>
                      <p className="mt-1 text-xs text-white/75">
                        The moment our squad finally won ✨
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>

            <Reveal className="lg:col-span-12" y={46}>
              <article className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[.04] p-6 sm:p-9">
                <div className="grid items-center gap-8 lg:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-3 text-fuchsia-300">
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-xs font-black uppercase tracking-[.2em]">
                        {t("messages")}
                      </span>
                    </div>
                    <h3 className="mt-5 text-3xl font-black sm:text-4xl">
                      {t("landingMessagesTitle")}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-purple-100/60 sm:text-base">
                      {t("landingMessagesText")}
                    </p>
                  </div>
                  <div className="rounded-[1.7rem] border border-white/10 bg-[#130722] p-4 shadow-2xl sm:p-6">
                    <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
                      <img
                        src="/landing/spark-squad.png"
                        alt="Purple Roblox creator"
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-fuchsia-400/40"
                      />
                      <div>
                        <p className="text-sm font-black">Your Spark squad</p>
                        <p className="text-[11px] text-emerald-400">3 friends online</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="mr-auto w-fit max-w-[82%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm">
                        Who’s joining tonight? 🎮
                      </p>
                      <p className="ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-sm">
                        Already in. Let’s go! ✨
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/10 bg-gradient-to-b from-violet-950/45 to-transparent px-5 py-24 sm:py-32">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/10 shadow-[0_0_100px_rgba(168,85,247,.15)]" />
          <div className="relative mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[.28em] text-fuchsia-400">
                {t("landingJourneyEyebrow")}
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">
                {t("landingJourneyTitle")}
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {journey.map((step, index) => (
                <Reveal key={step.number} delay={index * 120} y={38}>
                  <article className="group relative h-full rounded-[2rem] border border-white/10 bg-[#130722]/80 p-7 backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:border-fuchsia-400/40">
                    <span className="text-5xl font-black text-fuchsia-400/20 transition group-hover:text-fuchsia-400/40">
                      {step.number}
                    </span>
                    <h3 className="mt-8 text-xl font-black">{step.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-purple-100/55">{step.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Reveal className="mx-5 mb-16 sm:mx-auto sm:max-w-6xl" y={48}>
          <section className="relative overflow-hidden rounded-[2.5rem] border border-fuchsia-300/30 bg-gradient-to-br from-violet-700 via-purple-800 to-fuchsia-950 px-6 py-16 text-center shadow-[0_35px_110px_rgba(147,51,234,.35)] sm:px-16 sm:py-20">
            <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-400/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl" />
            <span className="relative inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-fuchsia-100">
              {t("landingCtaEyebrow")}
            </span>
            <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black sm:text-6xl">
              {t("landingCtaTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-purple-100/70">{t("landingCtaText")}</p>
            <Link to="/auth" search={{ mode: "signup" }} className="inline-block">
              <Button
                size="lg"
                className="group relative mt-8 min-h-14 overflow-hidden rounded-full bg-white px-9 font-black text-purple-700 shadow-[0_14px_40px_rgba(255,255,255,.2)] transition hover:scale-105"
              >
                <span className="bx-cta-shine absolute inset-y-0 w-20 -skew-x-12 bg-fuchsia-200/80 blur-md" />
                <span className="relative flex items-center gap-2">
                  {t("landingJoinNow")}{" "}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </Button>
            </Link>
          </section>
        </Reveal>
      </main>
      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-purple-100/45">
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
