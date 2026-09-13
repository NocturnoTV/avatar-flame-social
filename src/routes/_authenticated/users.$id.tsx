import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage, useSignedUrl } from "@/components/Media";
import { Verified } from "@/components/Verified";
import { BANNERS } from "@/lib/decorations";

export const Route = createFileRoute("/_authenticated/users/$id")({
  head: () => ({ meta: [{ title: "Profil — Bloxspark" }] }),
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const profile = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const [{ data: person }, { data: photos }, { data: games }, { data: videos }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,username,roblox_username,bio,banner_style,banner_url,avatar_url,verified")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("profile_photos")
            .select("id,url,position")
            .eq("user_id", id)
            .order("position"),
          supabase
            .from("roblox_games")
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
  const p = profile.data?.person;
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
        <StoredImage
          path={p?.avatar_url ?? profile.data?.photos[0]?.url}
          alt={p?.username ?? ""}
          className="-mt-14 h-28 w-28 rounded-full border-4 border-background"
          fallback="🎮"
        />
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-black">
          {p?.username ?? "Profil"}
          {p?.verified ? <Verified className="h-5 w-5" /> : null}
        </h1>
        <p className="text-sm text-muted-foreground">🎮 {p?.roblox_username}</p>
        {p?.bio ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{p.bio}</p>
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
        <h2 className="mt-7 text-lg font-black">Vidéos</h2>
        <div className="mt-3 grid grid-cols-3 gap-1">
          {profile.data?.videos.map((v) => (
            <ProfileVideo key={v.id} video={v} />
          ))}
          {!profile.data?.videos.length ? (
            <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">
              Aucune vidéo publique.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileVideo({
  video,
}: {
  video: { storage_path: string; caption: string | null; views_count: number };
}) {
  const url = useSignedUrl(video.storage_path);
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black">
      {url ? <video src={url} muted playsInline className="h-full w-full object-cover" /> : null}
      <span className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow">
        <Play className="h-3 w-3 fill-white" />
        {video.views_count}
      </span>
    </div>
  );
}
