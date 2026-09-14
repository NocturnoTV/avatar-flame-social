import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
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
            <p className="font-bold text-foreground">Minimum age</p>
            <p className="mt-1 text-muted-foreground">13 years old</p>
          </div>
          <div>
            <p className="font-bold text-foreground">Your controls</p>
            <p className="mt-1 text-muted-foreground">Report, block, delete</p>
          </div>
          <div>
            <p className="font-bold text-foreground">Roblox</p>
            <p className="mt-1 text-muted-foreground">Independent service</p>
          </div>
          <div>
            <p className="font-bold text-foreground">Questions</p>
            <Link to="/support" className="mt-1 block text-primary underline">
              Open Support
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-8">{children}</div>

        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          Bloxspark is not affiliated with Roblox Corporation. “Roblox” is a registered trademark of
          Roblox Corporation.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="underline">
            Terms of Use
          </Link>
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          <Link to="/community-guidelines" className="underline">
            Community Guidelines
          </Link>
          <Link to="/shop-terms" className="underline">
            Shop Terms & Refund Policy
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
