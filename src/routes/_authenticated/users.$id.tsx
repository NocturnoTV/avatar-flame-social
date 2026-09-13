import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Gamepad2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { ExternalLinkButton } from "@/components/ExternalLinkButton";
import { ProfileContentTabs, type TabVideo } from "@/components/ProfileContentTabs";
import { Button } from "@/components/ui-kit";
import { BANNERS } from "@/lib/decorations";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { RobloxIdentity } from "@/components/RobloxIdentity";

export const Route = createFileRoute("/_authenticated/users/$id")({
  head: () => ({ meta: [{ title: "Profil — Bloxspark" }] }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [messaging, setMessaging] = useState(false);
  const isMe = user?.id === id;

  const profile = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const [{ data: person }, { data: photos }, { data: games }, { data: videos }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id,username,roblox_username,roblox_display_name,bio,link_url,banner_style,banner_url,avatar_url,verified",
            )
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("profile_photos")
            .select("id,url,position")
            .eq("user_id", id)
            .order("position"),
          supabase
            .from("favorite_games")
            .select("id,name,url,thumbnail_url,position")
            .eq("user_id", id)
            .order("position"),
          supabase
            .from("videos")
            .select("id,storage_path,caption,views_count")
            .eq("user_id", id)
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(12),
        ]);
      return { person, photos: photos ?? [], games: games ?? [], videos: videos ?? [] };
    },
  });

  const reposts = useQuery({
    queryKey: ["public-reposts", id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("video_reposts")
        .select("video_id,created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r) => r.video_id);
      if (!ids.length) return [] as TabVideo[];
      const { data: vids } = await supabase
        .from("videos")
        .select("id,storage_path,caption,views_count")
        .in("id", ids)
        .eq("visibility", "public");
      const byId = new Map((vids ?? []).map((v) => [v.id, v]));
      return ids.map((vid) => byId.get(vid)).filter((v): v is TabVideo => Boolean(v));
    },
  });

  const counts = useQuery({
    queryKey: ["profile-counts", id],
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", id),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  const relation = useQuery({
    queryKey: ["profile-relation", id, user?.id],
    enabled: !!user && !isMe,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id)
        .eq("following_id", id)
        .maybeSingle();
      return { following: !!data };
    },
  });

  async function toggleFollow() {
    if (!user || isMe) return;
    if (relation.data?.following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: id });
    }
    void qc.invalidateQueries({ queryKey: ["profile-relation", id, user.id] });
    void qc.invalidateQueries({ queryKey: ["profile-counts", id] });
  }

  async function message() {
    if (!user || isMe || messaging) return;
    setMessaging(true);
    try {
      const { data: conversationId, error } = await supabase.rpc("start_direct_message", {
        _target: id,
      });
      if (error) throw error;
      await navigate({ to: "/messages/$id", params: { id: conversationId as string } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
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
      <div
        className="relative h-48 overflow-hidden bg-primary/20 sm:rounded-b-[2rem]"
        style={
          !p?.banner_url ? { backgroundImage: BANNERS[p?.banner_style ?? "ocean"] } : undefined
        }
      >
        {p?.banner_url ? (
          <StoredImage path={p.banner_url} alt="" className="h-full w-full" />
        ) : null}
        <Link
          to="/discover"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>
      <div className="px-4">
        {/* Instagram-style row: avatar left, stats to the right */}
        <div className="-mt-14 flex items-end gap-4">
          <StoredImage
            path={p?.avatar_url ?? profile.data?.photos[0]?.url}
            alt={p?.username ?? ""}
            className="h-28 w-28 shrink-0 rounded-full border-4 border-background"
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

        <h1 className="mt-3 flex items-center gap-2 text-2xl font-black">
          {p?.username ?? "Profil"}
          {p?.verified ? <Verified className="h-5 w-5" /> : null}
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

        {!isMe ? (
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              variant={relation.data?.following ? "outline" : "primary"}
              onClick={() => void toggleFollow()}
            >
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
                className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
              >
                <Gamepad2 className="h-4 w-4" />
                {g.name}
              </a>
            ))}
          </div>
        )}
        <ProfileContentTabs
          videos={profile.data?.videos ?? []}
          reposts={reposts.data ?? []}
          photos={profile.data?.photos ?? []}
        />
      </div>
    </div>
  );
}
