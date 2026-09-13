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
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();
    if ((profile as { moderation_status?: string } | null)?.moderation_status === "banned") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });
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
