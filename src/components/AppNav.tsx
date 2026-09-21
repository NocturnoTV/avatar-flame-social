import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  BookOpen,
  Bookmark,
  Calendar,
  Clock,
  Compass,
  Crown,
  Gamepad2,
  HelpCircle,
  Home,
  MessageCircle,
  Newspaper,
  Play,
  Receipt,
  Send,
  Settings,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { useUnreadConversations } from "@/lib/unreadConversations";
import { cn } from "@/lib/utils";
import { LogoWordmark } from "@/components/Logo";
import { discoverFeedKey, fetchDiscoverFeed } from "@/lib/discover-feed";

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

/** Warms the Discover feed cache the moment a finger/cursor touches the tab
 * - by the time the actual navigation lands, the feed is often already
 * fetched, so the page renders instantly instead of showing a spinner.
 * Shares its query key and fetch logic with discover.index.tsx exactly
 * (src/lib/discover-feed.ts) so this prefetch is the same cache entry the
 * page itself reads, not a wasted parallel fetch. */
function usePrefetchDiscover() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return () => {
    if (!user) return;
    void (async () => {
      const followingIds = await queryClient.fetchQuery({
        queryKey: ["following", user.id],
        staleTime: 60_000,
        queryFn: async () => {
          const { data } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          return (data ?? []).map((r) => r.following_id);
        },
      });
      void queryClient.prefetchQuery({
        queryKey: discoverFeedKey(user.id, "foryou", followingIds, undefined),
        staleTime: 30_000,
        queryFn: () => fetchDiscoverFeed({ userId: user.id, tab: "foryou", followingIds }),
      });
    })();
  };
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

function useUnreadNotifications() {
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

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => pathname === to || pathname.startsWith(to + "/");
}

export function SideNav() {
  const isActive = useActive();
  const unread = useUnreadConversations();
  const unreadNotifications = useUnreadNotifications();
  const { t } = useI18n();
  const prefetchDiscover = usePrefetchDiscover();
  const primaryItems = [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/discover", icon: Compass, label: t("discover") },
    { to: "/discover", icon: Play, label: t("menuVideos") },
    { to: "/sparks", icon: Sparkles, label: t("sparks"), featured: true },
    { to: "/communities", icon: Users, label: t("menuCommunities") },
    { to: "/news", icon: Newspaper, label: t("newsFeedTitle") },
    { to: "/wiki", icon: BookOpen, label: t("wiki") },
    { icon: Gamepad2, label: t("menuGames"), disabled: true },
    {
      to: "/messages",
      icon: MessageCircle,
      label: t("messages"),
      badge: unread + unreadNotifications,
    },
    { to: "/profile", icon: User, label: t("profile") },
  ];
  const secondaryItems = [
    { to: "/shop", icon: Crown, label: t("shop") },
    { to: "/shop/billing", icon: Receipt, label: t("purchasesAndBilling") },
    { to: "/news/saved", icon: Bookmark, label: t("menuSaved") },
    { to: "/events", icon: Calendar, label: t("eventsTitle") },
    { icon: Clock, label: t("menuRecent"), disabled: true },
    { to: "/support", icon: HelpCircle, label: t("support") },
    { to: "/settings", icon: Settings, label: t("settings") },
  ];

  const renderItem = (item: (typeof primaryItems)[number], group: string) => {
    const active = item.to ? isActive(item.to) : false;
    return item.disabled || !item.to ? (
      <div
        key={`${group}-${item.label}`}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground opacity-45"
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{item.label}</span>
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase">
          {t("comingSoon")}
        </span>
      </div>
    ) : (
      <Link
        key={`${group}-${item.to}-${item.label}`}
        to={item.to}
        {...(item.to === "/discover"
          ? { onMouseEnter: prefetchDiscover, onFocus: prefetchDiscover }
          : {})}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-surface hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "relative grid h-8 w-8 shrink-0 place-items-center rounded-lg transition",
            item.featured && "spark-gradient text-white shadow-[0_0_14px_rgba(168,85,247,.45)]",
            active &&
              !item.featured &&
              "bg-primary text-primary-foreground shadow-sm shadow-primary/25",
          )}
        >
          <item.icon className="h-4.5 w-4.5" fill={item.featured ? "currentColor" : "none"} />
          {item.badge ? (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-background">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background/80 backdrop-blur-xl lg:flex">
      <div className="flex items-center px-6 py-6">
        <Link to="/home" aria-label="Bloxspark">
          <LogoWordmark className="h-10 w-auto" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {primaryItems.map((item) => renderItem(item, "primary"))}
        <div className="mx-3 my-3 border-t border-border" />
        {secondaryItems.map((item) => renderItem(item, "secondary"))}
      </nav>
      <p className="border-t border-border px-5 py-4 text-[9px] leading-relaxed text-muted-foreground">
        {t("notAffiliated")}
      </p>
    </aside>
  );
}

export function BottomNav({ onOpenMenu }: { onOpenMenu?: () => void } = {}) {
  const items = useItems();
  const isActive = useActive();
  const unread = useUnreadConversations();
  const myAvatar = useMyAvatar();
  const prefetchDiscover = usePrefetchDiscover();

  // Warms the Discover feed cache as soon as the app shell mounts (i.e. on
  // launch, since BottomNav is part of the persistent authenticated layout)
  // rather than waiting for a hover/tap on the Discover tab, so the very
  // first visit to /discover in a session is instant instead of a fresh
  // fetch.
  useEffect(() => {
    prefetchDiscover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 rounded-[1.65rem] border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_45px_-12px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
        {items.map((item) => {
          const active = isActive(item.to);
          const isSpark = item.to === "/sparks";
          const isProfile = item.to === "/profile";

          // Sparks is the app's hub: same size as every other icon, but
          // always carries the brand gradient + a soft glow so it reads as
          // special without breaking the row's rhythm. It opens the full
          // nav menu instead of navigating directly - Sparks itself is one
          // tap away from inside that menu.
          if (isSpark) {
            const content = (
              <>
                <span className="relative grid h-8 w-10 place-items-center rounded-xl">
                  <span
                    className={cn("bx-glow absolute inset-0 rounded-xl spark-gradient blur-[6px]")}
                  />
                  <span className="spark-gradient relative grid h-8 w-10 place-items-center rounded-xl text-white shadow-[0_0_10px_rgba(168,85,247,.55)]">
                    <item.icon className="h-5 w-5" fill="currentColor" />
                  </span>
                </span>
                <span className="w-full truncate text-center text-[10px] font-bold leading-tight text-primary">
                  {item.label}
                </span>
              </>
            );
            if (onOpenMenu) {
              return (
                <button
                  key={item.to}
                  onClick={onOpenMenu}
                  className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 active:scale-95"
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 active:scale-95"
              >
                {content}
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              {...(item.to === "/discover"
                ? { onTouchStart: prefetchDiscover, onMouseEnter: prefetchDiscover }
                : {})}
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
                  active &&
                    !isProfile &&
                    "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                  active && isProfile && "rounded-full ring-2 ring-primary",
                )}
              >
                {isProfile ? (
                  <StoredImage
                    path={myAvatar?.avatar_url}
                    alt={myAvatar?.username ?? ""}
                    className="h-7 w-7 rounded-full object-cover"
                    fallback={myAvatar?.username?.[0]?.toUpperCase() ?? "?"}
                  />
                ) : (
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.7 : 2.1} />
                )}
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
