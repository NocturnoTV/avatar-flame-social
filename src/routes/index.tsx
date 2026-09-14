import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowRight, Flame, MessageCircle, Play, ShieldCheck, Sparkles, Users } from "lucide-react";
import { LogoWordmark } from "@/components/Logo";
import { ThreeBackground } from "@/components/landing/ThreeBackground";
import { Button } from "@/components/ui-kit";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

// GSAP (and its ScrollTrigger plugin) touch `window`/`document` as soon as
// they're imported. This route is server-rendered for SEO, and importing
// them at module scope ran that browser-only code during SSR (Node) and
// crashed the whole app. Both are loaded dynamically, client-side only,
// from inside the effect below instead.

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

  const rootRef = useRef<HTMLDivElement>(null);
  const heroEyebrowRef = useRef<HTMLSpanElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroTextRef = useRef<HTMLParagraphElement>(null);
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const heroTrustRef = useRef<HTMLDivElement>(null);
  const featureCardsRef = useRef<HTMLDivElement>(null);
  const featureHeadingRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLElement>(null);

  const features = [
    { icon: Flame, title: t("landingDiscoverTitle"), text: t("landingDiscoverText") },
    { icon: Play, title: t("landingCreateTitle"), text: t("landingCreateText") },
    { icon: MessageCircle, title: t("landingChatTitle"), text: t("landingChatText") },
  ];

  const gsapRef = useRef<typeof import("gsap").gsap | null>(null);

  useEffect(() => {
    let ctx: ReturnType<typeof import("gsap").gsap.context> | undefined;
    let cancelled = false;

    void (async () => {
      // Loaded dynamically, client-side only: GSAP and ScrollTrigger touch
      // `window`/`document` on import, which would run during this route's
      // server-side render otherwise.
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      gsapRef.current = gsap;

      ctx = gsap.context(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const ease = "power3.out";

        // Hero entrance — a confident stagger, not a fade-fest.
        const tl = gsap.timeline({ defaults: { ease, duration: reduceMotion ? 0.01 : 0.9 } });
        tl.from(heroEyebrowRef.current, { y: 24, opacity: 0 })
          .from(heroTitleRef.current, { y: 50, opacity: 0, scale: 0.96 }, "-=0.55")
          .from(heroTextRef.current, { y: 30, opacity: 0 }, "-=0.55")
          .from(heroCtaRef.current, { y: 24, opacity: 0 }, "-=0.5")
          .from(heroTrustRef.current, { y: 16, opacity: 0 }, "-=0.45");

        if (!reduceMotion) {
          // A slow ambient pulse on the primary CTA glow so the page never
          // looks static, even before you scroll or touch anything.
          gsap.to(heroCtaRef.current, {
            keyframes: [{ filter: "brightness(1.08)" }, { filter: "brightness(1)" }],
            duration: 2.4,
            repeat: -1,
            ease: "sine.inOut",
          });
        }

        if (featureHeadingRef.current) {
          gsap.from(featureHeadingRef.current.children, {
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.12,
            ease,
            scrollTrigger: { trigger: featureHeadingRef.current, start: "top 85%" },
          });
        }

        if (featureCardsRef.current) {
          gsap.from(featureCardsRef.current.children, {
            y: 60,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease,
            scrollTrigger: { trigger: featureCardsRef.current, start: "top 82%" },
          });
        }

        if (ctaSectionRef.current) {
          gsap.from(ctaSectionRef.current, {
            scale: 0.92,
            opacity: 0,
            duration: 1,
            ease,
            scrollTrigger: { trigger: ctaSectionRef.current, start: "top 85%" },
          });
        }
      }, rootRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  function magnetize(e: React.MouseEvent<HTMLElement>) {
    const gsap = gsapRef.current;
    if (!gsap) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    gsap.to(el, { x: relX * 0.18, y: relY * 0.35, duration: 0.4, ease: "power2.out" });
  }
  function unmagnetize(e: React.MouseEvent<HTMLElement>) {
    const gsap = gsapRef.current;
    if (!gsap) return;
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" });
  }

  return (
    <div ref={rootRef} className="min-h-screen overflow-hidden bg-[#0a0614] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a0614]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
          <LogoWordmark className="h-10 w-auto" forceVariant="dark" />
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
              aria-label={t("language")}
              className="hidden rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white outline-none sm:block"
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
        <section className="relative flex min-h-[70vh] items-end overflow-hidden bg-[#0a0614] pt-20 sm:min-h-[100vh]">
          <img
            src="/bloxspark-hero-banner.png"
            alt="BloxSpark Roblox community"
            className="absolute inset-0 h-full w-full object-contain object-top opacity-90 sm:object-cover sm:object-center"
          />
          <div className="absolute inset-0">
            <ThreeBackground />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0614] via-[#0a0614]/45 to-[#0a0614]/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_10%,rgba(3,11,29,.45)_75%)]" />
          <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 sm:pb-24">
            <span
              ref={heroEyebrowRef}
              className="inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-600/20 px-4 py-2 text-xs font-extrabold uppercase tracking-[.22em] text-purple-100 backdrop-blur"
            >
              <Sparkles className="h-4 w-4" /> {t("landingEyebrow")}
            </span>
            <h1
              ref={heroTitleRef}
              className="mt-5 max-w-4xl text-5xl font-black leading-[.93] tracking-[-.055em] sm:text-7xl lg:text-8xl"
            >
              {t("landingHeroTitle")}
            </h1>
            <p
              ref={heroTextRef}
              className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-purple-50/80 sm:text-xl"
            >
              {t("landingHeroText")}
            </p>
            <div ref={heroCtaRef} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                onMouseMove={magnetize}
                onMouseLeave={unmagnetize}
                className="inline-block"
              >
                <Button
                  size="lg"
                  className="w-full px-8 shadow-[0_0_45px_rgba(168,85,247,.55)] sm:w-auto"
                >
                  {t("landingJoin")} <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth" className="inline-block">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/20 bg-black/15 text-white backdrop-blur hover:bg-white/10 sm:w-auto"
                >
                  {t("signIn")}
                </Button>
              </Link>
            </div>
            <div ref={heroTrustRef} className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs font-bold text-white/70">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-400" /> {t("landingSafe")}
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" /> {t("landingCommunity")}
              </span>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-5 py-24">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/20 blur-[100px]" />
          <div ref={featureHeadingRef} className="relative mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.28em] text-purple-400">
              {t("landingBuiltFor")}
            </p>
            <h2 className="mt-4 text-4xl font-black sm:text-6xl">{t("landingSectionTitle")}</h2>
          </div>
          <div ref={featureCardsRef} className="relative mt-12 grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="group rounded-[2rem] border border-white/10 bg-white/[.045] p-7 backdrop-blur transition duration-300 hover:-translate-y-2 hover:border-purple-400/50 hover:bg-purple-500/10"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-400 shadow-lg shadow-purple-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  <f.icon className="h-7 w-7" />
                </span>
                <h3 className="mt-6 text-xl font-black">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-purple-100/60">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          ref={ctaSectionRef}
          className="mx-5 mb-16 overflow-hidden rounded-[2.5rem] border border-purple-400/20 bg-gradient-to-br from-purple-700 to-purple-950 px-6 py-16 text-center sm:mx-auto sm:max-w-6xl sm:px-16"
        >
          <Sparkles className="mx-auto h-9 w-9 text-purple-300 bx-float" />
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black sm:text-6xl">
            {t("landingCtaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-purple-100/70">{t("landingCtaText")}</p>
          <Link to="/auth" search={{ mode: "signup" }} onMouseMove={magnetize} onMouseLeave={unmagnetize} className="inline-block">
            <Button size="lg" className="mt-8 bg-white text-purple-700 shadow-xl hover:scale-105">
              {t("getStarted")}
            </Button>
          </Link>
        </section>
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
