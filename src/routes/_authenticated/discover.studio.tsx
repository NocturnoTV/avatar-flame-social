import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Trash2,
  Upload,
  Users,
  Video as VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Button, Card, Input, Label, Textarea } from "@/components/ui-kit";
import { uploadFile } from "@/lib/media";
import { useSignedUrl } from "@/components/Media";
import { formatCount } from "./discover.index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/discover/studio")({
  head: () => ({
    meta: [
      { title: "Studio créateur — Bloxspark" },
      {
        name: "description",
        content:
          "Publie tes vidéos Roblox et suis tes vues, likes, favoris et abonnés en un coup d'œil.",
      },
      { property: "og:title", content: "Studio créateur — Bloxspark" },
      {
        property: "og:description",
        content: "Tableau de bord complet pour les créateurs Bloxspark.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioPage,
});

type Tab = "stats" | "videos" | "publier";

function StudioPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("stats");

  const videos = useQuery({
    queryKey: ["my-videos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const followers = useQuery({
    queryKey: ["followers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", user!.id);
      return count ?? 0;
    },
  });

  const rows = videos.data ?? [];
  const sum = (
    k:
      | "views_count"
      | "likes_count"
      | "comments_count"
      | "favorites_count"
      | "reposts_count"
      | "shares_count",
  ) => rows.reduce((a, v) => a + (v[k] ?? 0), 0);

  const totalViews = sum("views_count");
  const totalLikes = sum("likes_count");
  const engagement = totalViews
    ? ((totalLikes + sum("comments_count") + sum("favorites_count")) / totalViews) * 100
    : 0;
  const best = [...rows].sort((a, b) => b.views_count - a.views_count)[0];

  const stats = [
    { label: "Vues", value: totalViews, icon: Eye },
    { label: "J'aime", value: totalLikes, icon: Heart },
    { label: "Commentaires", value: sum("comments_count"), icon: MessageCircle },
    { label: "Favoris", value: sum("favorites_count"), icon: Bookmark },
    { label: "Republications", value: sum("reposts_count"), icon: Repeat2 },
    { label: "Partages", value: sum("shares_count"), icon: Send },
    { label: "Abonnés", value: followers.data ?? 0, icon: Users },
    { label: "Vidéos", value: rows.length, icon: VideoIcon },
  ];

  const maxViews = Math.max(1, ...rows.map((r) => r.views_count));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 lg:pb-12">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/discover"
          aria-label="Retour"
          className="grid h-10 w-10 place-items-center rounded-full border border-border"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black">Studio créateur</h1>
          <p className="text-sm text-muted-foreground">Tes vidéos, tes stats, ta communauté.</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-full bg-surface-2 p-1">
        {(
          [
            ["stats", "Statistiques", BarChart3],
            ["videos", "Mes vidéos", VideoIcon],
            ["publier", "Publier", Upload],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition",
              tab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "stats" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="p-4">
                <s.icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-2xl font-black">{formatCount(s.value)}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          <Card>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Taux d'engagement
            </p>
            <p className="text-3xl font-black">{engagement.toFixed(1)}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full spark-gradient"
                style={{ width: `${Math.min(100, engagement)}%` }}
              />
            </div>
            {best ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Meilleure vidéo :{" "}
                <span className="font-semibold text-foreground">
                  {best.caption || "Sans titre"}
                </span>{" "}
                — {formatCount(best.views_count)} vues
              </p>
            ) : null}
          </Card>

          <Card>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vues par vidéo
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Publie ta première vidéo pour voir tes stats.
              </p>
            ) : (
              <div className="space-y-3">
                {rows.slice(0, 8).map((v) => (
                  <div key={v.id} className="space-y-1">
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">
                        {v.caption || "Sans titre"}
                      </span>
                      <span className="shrink-0 font-bold">{formatCount(v.views_count)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(v.views_count / maxViews) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "videos" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Aucune vidéo pour l'instant.
            </p>
          ) : (
            rows.map((v) => (
              <MyVideoCard
                key={v.id}
                video={v}
                onDeleted={() => {
                  void qc.invalidateQueries({ queryKey: ["my-videos"] });
                  void qc.invalidateQueries({ queryKey: ["feed"] });
                }}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "publier" ? (
        <UploadForm
          onDone={() => {
            setTab("videos");
            void qc.invalidateQueries({ queryKey: ["my-videos"] });
            void qc.invalidateQueries({ queryKey: ["feed"] });
          }}
        />
      ) : null}
    </div>
  );
}

function MyVideoCard({
  video,
  onDeleted,
}: {
  video: {
    id: string;
    storage_path: string;
    caption: string | null;
    views_count: number;
    likes_count: number;
  };
  onDeleted: () => void;
}) {
  const url = useSignedUrl(video.storage_path);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vidéo supprimée");
    onDeleted();
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-black">
      {url ? (
        <video src={url} muted playsInline className="aspect-[9/16] w-full object-cover" />
      ) : (
        <div className="aspect-[9/16] w-full animate-pulse bg-surface-2" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="truncate text-xs text-white">{video.caption || "Sans titre"}</p>
        <p className="flex items-center gap-2 text-[11px] font-bold text-white/80">
          <Eye className="h-3 w-3" /> {formatCount(video.views_count)}
          <Heart className="ml-1 h-3 w-3" /> {formatCount(video.likes_count)}
        </p>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        aria-label="Supprimer"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [sound, setSound] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  async function publish() {
    if (!file || !user) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = await uploadFile("videos", user.id, file, ext);
      const { error } = await supabase.from("videos").insert({
        user_id: user.id,
        storage_path: path,
        caption: caption.trim() || null,
        sound_name: sound.trim() || null,
        visibility,
      });
      if (error) throw error;
      toast.success("Vidéo publiée 🎉");
      setFile(null);
      setCaption("");
      setSound("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la publication");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <video
          src={preview}
          controls
          playsInline
          className="mx-auto max-h-80 rounded-2xl bg-black"
        />
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border py-12 text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm font-semibold">Choisir une vidéo (max 200 Mo)</span>
        </button>
      )}
      {file ? (
        <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
          Changer de vidéo
        </Button>
      ) : null}

      <div>
        <Label>Légende</Label>
        <Textarea
          rows={3}
          value={caption}
          maxLength={300}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Décris ta vidéo, ajoute des #hashtags…"
        />
      </div>
      <div>
        <Label>Son</Label>
        <Input
          value={sound}
          onChange={(e) => setSound(e.target.value)}
          placeholder="Son original"
        />
      </div>
      <div>
        <Label>Visibilité</Label>
        <div className="flex gap-2">
          {(
            [
              ["public", "Public"],
              ["private", "Privé"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setVisibility(value)}
              className={cn(
                "flex-1 rounded-2xl border py-3 text-sm font-bold transition",
                visibility === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Button className="w-full" size="lg" disabled={!file || busy} onClick={publish}>
        {busy ? "Publication…" : "Publier"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        En publiant, tu confirmes respecter les règles de la communauté. Bloxspark n'est pas affilié
        à Roblox Corporation.
      </p>
    </Card>
  );
}
