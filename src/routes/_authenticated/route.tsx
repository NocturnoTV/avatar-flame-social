import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav, SideNav } from "@/components/AppNav";
import { AppMenu } from "@/components/AppMenu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (data.user.user_metadata["onboarding_completed"] !== true) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        if (data.user.user_metadata["onboarding_required"] !== true) {
          await supabase.auth.updateUser({
            data: { onboarding_completed: false, onboarding_required: true },
          });
        }
        throw redirect({ to: "/onboarding" });
      }

      await supabase.auth.updateUser({
        data: { onboarding_completed: true, onboarding_required: false },
      });
    }
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-background min-h-screen">
      <SideNav />
      <div className="pb-24 lg:ml-64 lg:pb-0">
        <Outlet />
      </div>
      <BottomNav onOpenMenu={() => setMenuOpen(true)} />
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
