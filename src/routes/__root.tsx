import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Réessaie dans un instant ou reviens à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "BloxSpark - the social network for Roblox players" },
      {
        name: "description",
        content:
          "BloxSpark connects Roblox players worldwide: discover profiles, share videos, match with Sparks and chat privately, in groups or by voice. Not affiliated with Roblox Corporation.",
      },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#7c3aed" },
      { property: "og:site_name", content: "BloxSpark" },
      { property: "og:title", content: "BloxSpark - the social network for Roblox players" },
      {
        property: "og:description",
        content: "Discover players, share videos, match with Sparks and chat safely on BloxSpark.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://bloxspark.app/bloxspark-hero-banner.png" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BloxSpark - the social network for Roblox players" },
      {
        name: "twitter:description",
        content: "Discover players, share videos, match with Sparks and chat safely on BloxSpark.",
      },
      { name: "twitter:image", content: "https://bloxspark.app/bloxspark-hero-banner.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/bloxspark-logo.png?v=4" },
      { rel: "apple-touch-icon", href: "/bloxspark-logo.png?v=4" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <SessionProvider>
            <AuthSync />
            <Outlet />
            <Toaster position="top-center" richColors />
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
