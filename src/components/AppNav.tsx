import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Flame, Home, Send, Settings, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

function useUnread() {
  const { user } = useSession();
  const { data = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });
  return data;
}

function useItems() {
  const { t } = useI18n();
  return [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/discover", icon: Compass, label: t("discover") },
    { to: "/sparks", icon: Flame, label: t("sparks") },
    { to: "/messages", icon: Send, label: t("messages") },
    { to: "/profile", icon: User, label: t("profile") },
  ];
}

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => pathname === to || pathname.startsWith(to + "/");
}

export function SideNav() {
  const items = useItems();
  const isActive = useActive();
  const unread = useUnread();
  const { t } = useI18n();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background/80 backdrop-blur-xl lg:flex">
      <div className="flex items-center px-6 py-6">
        <Link to="/home" aria-label="Bloxspark">
          <Logo className="h-10 w-auto" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-4 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-all",
                active
                  ? "bg-surface-2 text-primary"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <item.icon className="h-6 w-6 shrink-0" strokeWidth={active ? 2.6 : 2} />
              <span className="truncate">{item.label}</span>
              {item.to === "/messages" && unread ? (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          );
        })}
        <Link
          to="/settings"
          className="group flex items-center gap-4 rounded-2xl px-4 py-3 text-[15px] font-semibold text-muted-foreground transition-all hover:bg-surface hover:text-foreground"
        >
          <Settings className="h-6 w-6 shrink-0" />
          <span className="truncate">{t("settings")}</span>
        </Link>
      </nav>
      <p className="px-6 pb-6 text-[10px] leading-relaxed text-muted-foreground">
        Bloxspark n'est ni affilié, ni approuvé, ni sponsorisé par Roblox Corporation.
      </p>
    </aside>
  );
}

export function BottomNav() {
  const items = useItems();
  const isActive = useActive();
  const unread = useUnread();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {items.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} />
              {item.to === "/messages" && unread ? (
                <span className="absolute right-[24%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
