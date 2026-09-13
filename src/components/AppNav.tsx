import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Home, Send, Settings, Sparkles, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
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

// Shares its cache with AppMenu's own profile query (same queryKey) so the
// avatar shown on the bottom-nav "Profil" tab never re-fetches twice.
function useMyAvatar() {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ["app-menu-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  return data;
}

function useItems() {
  const { t } = useI18n();
  return [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/discover", icon: Compass, label: t("discover") },
    { to: "/sparks", icon: Sparkles, label: t("sparks") },
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
          const isSpark = item.to === "/sparks";
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
              {isSpark ? (
                <span
                  className={cn(
                    "spark-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_0_16px_rgba(168,85,247,.55)]",
                  )}
                >
                  <item.icon className="h-5 w-5" fill="currentColor" />
                </span>
              ) : (
                <item.icon className="h-6 w-6 shrink-0" strokeWidth={active ? 2.6 : 2} />
              )}
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

export function BottomNav({ onOpenMenu }: { onOpenMenu?: () => void } = {}) {
  const items = useItems();
  const isActive = useActive();
  const unread = useUnread();
  const myAvatar = useMyAvatar();

  return (
    <nav className="fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 rounded-[1.65rem] border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_45px_-12px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-around gap-1">
        {items.map((item) => {
          const active = isActive(item.to);
          const isSpark = item.to === "/sparks";
          const isProfile = item.to === "/profile";

          if (isProfile && onOpenMenu) {
            return (
              <button
                key={item.to}
                onClick={onOpenMenu}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-bold transition-all duration-200 active:scale-95",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative grid h-8 w-10 place-items-center",
                    active && "rounded-full ring-2 ring-primary",
                  )}
                >
                  <StoredImage
                    path={myAvatar?.avatar_url}
                    alt={myAvatar?.username ?? ""}
                    className="h-7 w-7 rounded-full object-cover"
                    fallback={myAvatar?.username?.[0]?.toUpperCase() ?? "?"}
                  />
                </span>
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </button>
            );
          }

          if (isSpark) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex flex-1 flex-col items-center gap-1 pb-2 text-[10px] font-semibold text-primary"
              >
                <span
                  className={cn(
                    "spark-gradient -mt-6 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_0_22px_rgba(168,85,247,.6)] transition-transform",
                    active ? "scale-100 ring-2 ring-white/50" : "scale-[.92]",
                  )}
                >
                  <item.icon className="h-7 w-7" fill="currentColor" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-bold transition-all duration-200 active:scale-95",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "relative grid h-8 w-10 place-items-center rounded-xl transition-all",
                  active && "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.7 : 2.1} />
                {item.to === "/messages" && unread ? (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-background">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
