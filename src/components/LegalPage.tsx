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
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Bloxspark
          </Link>
          <Logo className="h-10" />
        </div>

        <h1 className="mt-8 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{updated}</p>

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
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
