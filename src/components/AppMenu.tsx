import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  Clock,
  Compass,
  Crown,
  Gamepad2,
  HelpCircle,
  Home,
  LogOut,
  MessageCircle,
  Play,
  Settings,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { LogoWordmark } from "@/components/Logo";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function useMyProfile() {
  const { user } = useSession();
  return useQuery({
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

function useUnreadConversations() {
  const { user } = useSession();
  const { data = 0 } = useQuery({
    queryKey: ["unread-conversations", user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const [{ data: mine }, { data: convos }] = await Promise.all([
        supabase.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id", user!.id),
        supabase.from("conversations").select("id,last_message_at").eq("request_status", "accepted"),
      ]);
      const readAt = new Map((mine ?? []).map((m) => [m.conversation_id, m.last_read_at]));
      const mineIds = new Set((mine ?? []).map((m) => m.conversation_id));
      return (convos ?? []).filter((c) => {
        if (!mineIds.has(c.id)) return false;
        const lastRead = readAt.get(c.id);
        return !lastRead || new Date(c.last_message_at).getTime() > new Date(lastRead).getTime();
      }).length;
    },
  });
  return data;
}

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function Row({
  icon: Icon,
  label,
  to,
  badge,
  active,
  onClick,
  disabled,
  comingSoon,
}: {
  icon: typeof Home;
  label: string;
  to?: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  comingSoon?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          active ? "spark-gradient text-white shadow-[0_0_14px_rgba(168,85,247,.5)]" : "text-foreground",
        )}
      >
        <Icon className="h-5 w-5" fill={active ? "currentColor" : "none"} />
      </span>
      <span className={cn("flex-1 truncate text-[15px] font-medium", active && "font-semibold")}>{label}</span>
      {comingSoon ? (
        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {comingSoon}
        </span>
      ) : null}
      {badge ? <Badge count={badge} /> : null}
    </>
  );

  const rowClass = cn(
    "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition",
    active ? "bg-[#1b1230]" : disabled ? "opacity-45" : "hover:bg-surface-2",
  );

  if (disabled || !to) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={rowClass}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to} onClick={onClick} className={rowClass}>
      {content}
    </Link>
  );
}

export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useMyProfile();
  const unreadNotifs = useUnreadNotifications();
  const unreadMessages = useUnreadConversations();

  if (!open) return null;

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  async function signOut() {
    await supabase.auth.signOut();
    onClose();
    await navigate({ to: "/", replace: true });
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-24 z-[45] flex flex-col overflow-y-auto bg-background px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
      <div className="flex items-center justify-between">
        <LogoWordmark className="h-6 w-auto" />
        <button
          onClick={onClose}
          aria-label={t("cancel")}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <Link
        to="/profile"
        onClick={onClose}
        className="mt-4 flex items-center gap-3 rounded-2xl px-1 py-2 active:scale-[.99]"
      >
        <span className="relative shrink-0 rounded-full p-[2px] shadow-[0_0_12px_rgba(168,85,247,.45)] ring-1 ring-primary/70">
          <StoredImage
            path={profile.data?.avatar_url}
            alt={profile.data?.username ?? ""}
            className="h-11 w-11 rounded-full object-cover"
            fallback={profile.data?.username?.[0]?.toUpperCase() ?? "?"}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{profile.data?.username ?? "…"}</span>
          <span className="block truncate text-xs text-muted-foreground">@{profile.data?.username ?? "…"}</span>
        </span>
        <Link
          to="/notifications"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={t("notifications")}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-2"
        >
          <Bell className="h-5 w-5" />
          {unreadNotifs ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadNotifs > 9 ? "9+" : unreadNotifs}
            </span>
          ) : null}
        </Link>
        <Link
          to="/settings"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={t("settings")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-2"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </Link>

      <div className="mt-4 space-y-0.5 rounded-3xl border border-border bg-card p-2">
        <Row icon={Home} label={t("home")} to="/home" active={isActive("/home")} onClick={onClose} />
        <Row icon={Compass} label={t("discover")} to="/discover" active={isActive("/discover")} onClick={onClose} />
        <Row icon={Play} label={t("menuVideos")} to="/discover" active={false} onClick={onClose} />
        <Row icon={Sparkles} label={t("sparks")} to="/sparks" active={isActive("/sparks")} onClick={onClose} />
        <Row
          icon={Users}
          label={t("menuCommunities")}
          to="/communities"
          active={isActive("/communities")}
          onClick={onClose}
        />
        <Row icon={Gamepad2} label={t("menuGames")} disabled comingSoon={t("comingSoon")} />
        <Row
          icon={MessageCircle}
          label={t("messages")}
          to="/messages"
          active={isActive("/messages")}
          badge={unreadMessages}
          onClick={onClose}
        />
        <Row
          icon={Bell}
          label={t("notifications")}
          to="/notifications"
          active={isActive("/notifications")}
          badge={unreadNotifs}
          onClick={onClose}
        />
        <Row icon={User} label={t("profile")} to="/profile" active={isActive("/profile")} onClick={onClose} />

        <div className="my-1.5 border-t border-border" />

        <Row icon={Crown} label={t("menuPremium")} to="/shop" onClick={onClose} />
        <Row icon={Bookmark} label={t("menuSaved")} disabled comingSoon={t("comingSoon")} />
        <Row icon={Clock} label={t("menuRecent")} disabled comingSoon={t("comingSoon")} />
        <Row icon={HelpCircle} label={t("support")} to="/support" onClick={onClose} />
      </div>

      <button
        onClick={() => void signOut()}
        className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-[15px] font-semibold text-foreground hover:bg-surface-2"
      >
        <LogOut className="h-5 w-5" /> {t("signOut")}
      </button>
    </div>
  );
}
