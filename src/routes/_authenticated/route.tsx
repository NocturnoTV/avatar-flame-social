import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav, SideNav } from "@/components/AppNav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed,username,birth_date")
      .eq("id", data.user.id)
      .maybeSingle();
    const legacyProfileIsComplete = Boolean(profile?.username && profile?.birth_date);
    if (!profile?.onboarding_completed && legacyProfileIsComplete) {
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", data.user.id);
    } else if (!profile?.onboarding_completed) {
      throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <SideNav />
      <div className="pb-20 lg:ml-64 lg:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
