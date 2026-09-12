import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Mic, Users, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bloxspark — rencontre les joueurs Roblox" },
      {
        name: "description",
        content:
          "Crée ton profil, swipe des joueurs Roblox, matche et discute en privé, en groupe ou en vocal. Bloxspark n'est pas affilié à Roblox Corporation.",
      },
      { property: "og:title", content: "Bloxspark — rencontre les joueurs Roblox" },
      {
        property: "og:description",
        content: "Swipe, matche et discute avec la communauté Roblox.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();

  const features = [
    { icon: Flame, title: "Sparks", text: t("heroSub").slice(0, 0) || "" },
  ];
  void features;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo className="h-12" />
        <Link to="/auth">
          <Button variant="outline" size="sm">
            {t("signIn")}
          </Button>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 text-center">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-spark-2/25 blur-3xl" />
          <div className="relative">
            <Logo className="mx-auto mb-7 h-28 drop-shadow-[0_0_50px_rgba(255,90,140,0.3)] sm:h-40" />
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> BLOXSPARK
            </span>
            <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-bold leading-tight sm:text-6xl">
              <span className="spark-text">{t("tagline")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">{t("heroSub")}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="lg">{t("getStarted")}</Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">
                  {t("signIn")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Flame, title: "Sparks", text: "Swipe des profils de joueurs et matche." },
            { icon: Mic, title: "Vocal", text: "Messages vocaux, photos et émojis." },
            { icon: Users, title: "Groupes", text: "Crée des groupes avec ta team." },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-5">
              <f.icon className="h-7 w-7 text-primary" />
              <h2 className="mt-3 text-lg font-bold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>

        <footer className="mt-12 space-y-3 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/conditions" className="hover:text-foreground">
              {t("terms")}
            </Link>
            <Link to="/confidentialite" className="hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link to="/regles" className="hover:text-foreground">
              {t("rules")}
            </Link>
          </div>
          <p>{t("notAffiliated")}</p>
        </footer>
      </main>
    </div>
  );
}
