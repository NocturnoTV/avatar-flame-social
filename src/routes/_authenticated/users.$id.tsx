import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { ProfileBanner } from "@/components/ProfileBanner";
import { Verified } from "@/components/Verified";
import { EquippedBadges } from "@/components/Blox";
import { ExternalLinkButton } from "@/components/ExternalLinkButton";
import { ProfileContentTabs, type TabVideo } from "@/components/ProfileContentTabs";
import { Button } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { RobloxIdentity } from "@/components/RobloxIdentity";
import { RobloxGameIcon } from "@/components/RobloxGameIcon";
import { profileFontClass, profileGlowClass } from "@/lib/sparkPlus";
import { cn } from "@/lib/utils";
import { PremiumIcon } from "@/components/PremiumIcon";

export const Route = createFileRoute("/_authenticated/users/$id")({
  loader: async ({ params }) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      params.id,
    );
    const { data } = await supabase
      .from("profiles")
      .select("username,bio")
      .eq(isUuid ? "id" : "username", params.id)
      .maybeSingle();
    return { profile: data };
  },
  head: ({ params, loaderData }) => {
    const username = loaderData?.profile?.username ?? params.id;
    const title = `${username} - Profil BloxSpark`;
    const description =
      loaderData?.profile?.bio ??
      `Découvre le profil de ${username} sur BloxSpark : vidéos, communautés et Sparks.`;
    const url = `https://bloxspark.app/users/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: PublicProfile,
});


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PublicProfile() {
  const { id: param } = Route.useParams();
  const { t } = useI18n();
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [messaging, setMessaging] = useState(false);

  // The URL uses the username (e.g. /users/arthur); resolve it to the real
  // id once here so every other query below can stay UUID-based. A raw
  // UUID in the URL (old links, or a username that never got resolved)
  // still works - we just use it as-is.
  const resolved = useQuery({
    queryKey: ["resolve-profile-id", param],
    queryFn: async () => {
      if (UUID_RE.test(param)) return param;
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", param)
        .maybeSingle();
      return data?.id ?? null;
    },
  });
  const id = resolved.data ?? undefined;
  const isMe = !!user && user.id === id;

  // "Explorer" daily quest - counts distinct profiles visited today.
  useEffect(() => {
    if (!user || !id || isMe) return;
    const today = new Date().toISOString().slice(0, 10);
    void supabase
      .from("profile_visits")
      .upsert(
        { viewer_id: user.id, visited_id: id, visited_date: today },
        { onConflict: "viewer_id,visited_id,visited_date", ignoreDuplicates: true },
      );
    void supabase.rpc("bump_quest_progress", { _metric_key: "explorer", _entity_id: id });
  }, [user, id, isMe]);

  const profile = useQuery({
    queryKey: ["public-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: person }, { data: photos }, { data: games }, { data: videos }, { data: stickers }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id,username,roblox_username,roblox_display_name,bio,link_url,banner_style,banner_url,banner_video_url,avatar_url,verified",
            )
            .eq("id", id!)
            .maybeSingle(),
          supabase
            .from("profile_photos")
            .select("id,url,position")
            .eq("user_id", id!)
            .order("position"),
          supabase
            .from("favorite_games")
            .select("id,name,url,thumbnail_url,position")
            .eq("user_id", id!)
            .order("position"),
          supabase
            .from("videos")
            .select("id,storage_path,caption,views_count")
            .eq("user_id", id!)
            .in("visibility", ["public", "sparks"])
            .eq("moderation_status", "approved")
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("stickers")
            .select("id,storage_path")
            .eq("user_id", id!)
            .order("position"),
        ]);
      return {
        person,
        photos: photos ?? [],
        games: games ?? [],
        videos: videos ?? [],
        stickers: stickers ?? [],
      };
    },
  });

  const sparkPlusStyle = useQuery({
    queryKey: ["public-profile-spark-plus", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("spark_plus_active,spark_plus_expires_at,profile_font,profile_glow")
        .eq("id", id!)
        .maybeSingle();
      return data?.spark_plus_active &&
        (!data.spark_plus_expires_at || new Date(data.spark_plus_expires_at).getTime() > Date.now())
        ? data
        : null;
    },
  });

  const communities = useQuery({
    queryKey: ["public-communities", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", id!);
      const ids = (rows ?? []).map((r) => r.community_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("communities")
        .select("id,handle,name,icon_url")
        .in("id", ids);
      return data ?? [];
    },
  });

  const reposts = useQuery({
    queryKey: ["public-reposts", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("video_reposts")
        .select("video_id,created_at")
        .eq("user_id", id!)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.video_id);
      if (!ids.length) return [] as TabVideo[];
      const { data: vids } = await supabase
        .from("videos")
        .select("id,storage_path,caption,views_count")
        .in("id", ids)
        .in("visibility", ["public", "sparks"])
        .eq("moderation_status", "approved");
      const byId = new Map((vids ?? []).map((v) => [v.id, v]));
      return ids.map((vid) => byId.get(vid)).filter((v): v is TabVideo => Boolean(v));
    },
  });

  const counts = useQuery({
    queryKey: ["profile-counts", id],
    enabled: !!id,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", id!),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", id!),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  const relation = useQuery({
    queryKey: ["profile-relation", id, user?.id],
    enabled: !!user && !isMe && !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id)
        .eq("following_id", id!)
        .maybeSingle();
      return { following: !!data };
    },
  });

  async function toggleFollow() {
    if (!user || isMe || !id) return;
    if (relation.data?.following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: id });
    }
    void qc.invalidateQueries({ queryKey: ["profile-relation", id, user.id] });
    void qc.invalidateQueries({ queryKey: ["profile-counts", id] });
  }

  async function message() {
    if (!user || isMe || messaging || !id) return;
    setMessaging(true);
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: id,
      });
      if (error) throw error;
      await navigate({ to: "/messages/$id", params: { id: conversationId as string } });
    } catch (err) {
      console.error("start_direct_message failed", err);
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setMessaging(false);
    }
  }

  const p = profile.data?.person;
  const stats = [
    { label: t("profileVideos"), value: profile.data?.videos.length ?? 0 },
    { label: t("followers"), value: counts.data?.followers ?? 0 },
    { label: t("following"), value: counts.data?.following ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-xl pb-28">
      <div className="relative z-0 h-40 overflow-hidden bg-primary/20 sm:rounded-b-[2rem]">
        <ProfileBanner
          bannerVideoUrl={p?.banner_video_url}
          bannerUrl={p?.banner_url}
          bannerStyle={p?.banner_style}
          className="h-full w-full object-cover"
        />
        <Link
          to="/discover"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>
      <div className="relative z-10 px-4">
        {/* Instagram-style row: avatar left, stats to the right */}
        <div className="-mt-12 flex items-end gap-4">
          <StoredImage
            path={p?.avatar_url ?? profile.data?.photos[0]?.url}
            alt={p?.username ?? ""}
            className={cn(
              "h-24 w-24 shrink-0 rounded-full border-4 border-background object-cover",
              profileGlowClass(sparkPlusStyle.data?.profile_glow),
            )}
            fallback="🎮"
          />
          <div className="grid flex-1 grid-cols-3 gap-1 pb-1 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-lg font-black leading-none">{s.value}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <h1
          className={cn(
            "mt-3 flex items-center gap-2 text-2xl font-black",
            profileFontClass(sparkPlusStyle.data?.profile_font),
          )}
        >
          {p?.username ?? "Profil"}
          {sparkPlusStyle.data ? (
            <PremiumIcon className="h-6 w-6" />
          ) : null}
          {p?.verified ? <Verified className="h-5 w-5" /> : null}
          <EquippedBadges userId={id} />
        </h1>
        <RobloxIdentity
          displayName={p?.roblox_display_name}
          username={p?.roblox_username}
          className="text-sm text-muted-foreground"
        />
        {p?.bio ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{p.bio}</p>
        ) : null}
        {p?.link_url ? <ExternalLinkButton url={p.link_url} /> : null}

        {(communities.data ?? []).length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(communities.data ?? []).map((c) => (
              <Link
                key={c.id}
                to="/communities/$handle"
                params={{ handle: c.handle }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
              >
                <StoredImage path={c.icon_url} alt="" className="h-4 w-4 rounded" fallback="🎮" />
                {c.name}
              </Link>
            ))}
          </div>
        ) : null}

        {!isMe ? (
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              variant={relation.data?.following ? "outline" : "primary"}
              onClick={() => void toggleFollow()}
            >
              {relation.data?.following ? (
                <UserCheck className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {relation.data?.following ? t("unfollow") : t("follow")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={messaging}
              onClick={() => void message()}
            >
              <MessageCircle className="h-4 w-4" /> {t("messageAction")}
            </Button>
          </div>
        ) : null}

        {!!profile.data?.games.length && (
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.data.games.map((g) => (
              <a
                key={g.id}
                href={g.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/10 py-1.5 pl-1.5 pr-3 text-xs font-bold text-primary transition hover:border-primary/40 hover:bg-primary/15"
              >
                <RobloxGameIcon src={g.thumbnail_url} name={g.name} className="h-9 w-9" />
                {g.name}
              </a>
            ))}
          </div>
        )}
        <ProfileContentTabs
          videos={profile.data?.videos ?? []}
          reposts={reposts.data ?? []}
          photos={profile.data?.photos ?? []}
          stickers={profile.data?.stickers ?? []}
        />
      </div>
    </div>
  );
}
