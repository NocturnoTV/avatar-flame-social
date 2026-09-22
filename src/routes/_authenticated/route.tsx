import {
  createFileRoute,
  isRedirect,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav, SideNav } from "@/components/AppNav";
import { AppMenu } from "@/components/AppMenu";
import { CallProvider } from "@/components/CallProvider";
import { DeviceCodePopup } from "@/components/DeviceCodePopup";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Right after a Roblox sign-in the session arrives via a cross-origin
    // magic-link redirect rather than the normal in-page signUp() flow, so
    // it can still be settling on the very first authenticated navigation.
    // getUser() is documented to resolve with an error (never reject) when
    // there's no session yet, but everything here is wrapped defensively
    // anyway: any auth hiccup should bounce to /auth, never crash the route
    // with a raw "Auth session missing" error screen.
    try {
      const { data, error } = await supabase.auth.getUser();
      // Guests get real (read-only) access to the app shell instead of
      // being bounced to /auth - individual pages/actions decide what to
      // do with a null user (usually: render public content, gate writes).
      // Onboarding only applies to real accounts, so skip it entirely here.
      if (error || !data.user) return { user: null };
      if (data.user.user_metadata["onboarding_completed"] !== true) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!profile?.onboarding_completed) {
          if (data.user.user_metadata["onboarding_required"] !== true) {
            await supabase.auth
              .updateUser({ data: { onboarding_completed: false, onboarding_required: true } })
              .catch(() => undefined);
          }
          throw redirect({ to: "/onboarding" });
        }

        await supabase.auth
          .updateUser({ data: { onboarding_completed: true, onboarding_required: false } })
          .catch(() => undefined);
      }
      return { user: data.user };
    } catch (err) {
      // A `redirect()` above is thrown on purpose - let it through as-is.
      // Anything else (a genuine auth error) falls back to /auth instead of
      // surfacing as a crash.
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: AppLayout,
});

/**
 * Keeps profiles.last_active_at fresh so "online" status / "last seen"
 * actually reflects reality instead of the value from account creation
 * (it was never updated anywhere before this).
 */
function usePresenceHeartbeat() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    async function ping() {
      await supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", userId);
    }
    void ping();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void ping();
    }, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") void ping();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);
}

/** "Daily Visit" quest - fires once per app load while signed in; the RPC's
 * own dedup (entity_id="visit") caps it at one credit per local day even if
 * this mounts more than once. */
function useDailyVisitQuest() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) return;
    void supabase.rpc("bump_quest_progress", { _metric_key: "daily_visit", _entity_id: "visit" });
  }, [user]);
}

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  usePresenceHeartbeat();
  useDailyVisitQuest();
  // The full nav menu (AppMenu) lives here, above the Outlet, so it stays
  // mounted across navigations. The bottom nav's other tabs (Discover,
  // Messages, Profil...) remain visible/clickable underneath it while it's
  // open and navigate directly without touching menuOpen - close it on any
  // pathname change so it never lingers over the page you just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  // Inside a single conversation, the tab bar has nothing useful to do and
  // just eats screen space from the message list / composer - hide it there
  // (both list still floats on /messages itself) and let the conversation
  // use the full viewport height instead of the space normally reserved for
  // the floating pill nav.
  const inConversation = pathname.startsWith("/messages/");
  // Discover manages its own bottom-nav clearance (it needs a precise
  // viewport-height video, not padding), so give it the same treatment as a
  // conversation instead of double-reserving space with pb-24 on top of it.
  const managesOwnNavSpace = inConversation || pathname === "/discover";
  return (
    <CallProvider>
      <div className="app-background min-h-screen">
        <SideNav />
        <div className={cn("lg:ml-64 lg:pb-0", managesOwnNavSpace ? "pb-0" : "pb-24")}>
          <div key={pathname} className="bx-page-enter">
            <Outlet />
          </div>
        </div>
        {!inConversation ? <BottomNav onOpenMenu={() => setMenuOpen(true)} /> : null}
        <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
        <DeviceCodePopup />
      </div>
    </CallProvider>
  );
}
