import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

const CHROME = {
  en: {
    minAgeLabel: "Minimum age",
    minAgeValue: "13 years old",
    controlsLabel: "Your controls",
    controlsValue: "Report, block, delete",
    robloxLabel: "Roblox",
    robloxValue: "Independent service",
    questionsLabel: "Questions",
    openSupport: "Open Support",
    disclaimer:
      "Bloxspark is not affiliated with Roblox Corporation. “Roblox” is a registered trademark of Roblox Corporation.",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    guidelines: "Community Guidelines",
    shopTerms: "Shop Terms & Refund Policy",
  },
  fr: {
    minAgeLabel: "Âge minimum",
    minAgeValue: "13 ans",
    controlsLabel: "Vos options",
    controlsValue: "Signaler, bloquer, supprimer",
    robloxLabel: "Roblox",
    robloxValue: "Service indépendant",
    questionsLabel: "Questions",
    openSupport: "Contacter le Support",
    disclaimer:
      "Bloxspark n'est pas affilié à Roblox Corporation. « Roblox » est une marque déposée de Roblox Corporation.",
    terms: "Conditions d'utilisation",
    privacy: "Politique de confidentialité",
    guidelines: "Règles de la communauté",
    shopTerms: "Conditions de la boutique et remboursements",
  },
} as const;

export function LegalPage({
  title,
  updated,
  lang = "en",
  children,
}: {
  title: string;
  updated: string;
  /** Defaults to "en" so every other legal page (Terms, Privacy, Shop
   * Terms) keeps its existing English chrome untouched - only pages that
   * explicitly pass lang="fr" (see community-guidelines.tsx) get the
   * translated shell below. */
  lang?: "en" | "fr";
  children: ReactNode;
}) {
  const c = CHROME[lang];
  return (
    <div className="min-h-screen bg-background px-5 pb-20 pt-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Bloxspark
          </Link>
          <Logo className="h-10" />
        </div>

        <h1 className="mt-10 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{updated}</p>

        <div className="mt-7 grid gap-3 rounded-3xl border border-border bg-card p-5 text-sm sm:grid-cols-4">
          <div>
            <p className="font-bold text-foreground">{c.minAgeLabel}</p>
            <p className="mt-1 text-muted-foreground">{c.minAgeValue}</p>
          </div>
          <div>
            <p className="font-bold text-foreground">{c.controlsLabel}</p>
            <p className="mt-1 text-muted-foreground">{c.controlsValue}</p>
          </div>
          <div>
            <p className="font-bold text-foreground">{c.robloxLabel}</p>
            <p className="mt-1 text-muted-foreground">{c.robloxValue}</p>
          </div>
          <div>
            <p className="font-bold text-foreground">{c.questionsLabel}</p>
            <Link to="/support" className="mt-1 block text-primary underline">
              {c.openSupport}
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-8">{children}</div>

        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          {c.disclaimer}
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="underline">
            {c.terms}
          </Link>
          <Link to="/privacy" className="underline">
            {c.privacy}
          </Link>
          <Link to="/community-guidelines" className="underline">
            {c.guidelines}
          </Link>
          <Link to="/shop-terms" className="underline">
            {c.shopTerms}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">{title}</h2>
      <div className="space-y-3 text-[15px] leading-7 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}
