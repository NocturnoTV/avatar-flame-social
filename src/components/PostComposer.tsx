import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Image as ImageIcon, Video as VideoIcon, Globe2, Users, AtSign, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { uploadFile, uploadVideoToMux } from "@/lib/media";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage } from "@/lib/utils";
import type { PostRow, ReplyPermission } from "@/lib/feedPosts";

const MAX_CHARS = 500;
const MAX_IMAGES = 4;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;

type VideoAttachment = {
  file: File;
  preview: string;
  videoRowId: string | null;
  uploading: boolean;
  progress: number;
  error: string | null;
};

const REPLY_OPTIONS: { value: ReplyPermission; icon: typeof Globe2 }[] = [
  { value: "everyone", icon: Globe2 },
  { value: "following", icon: Users },
  { value: "mentioned", icon: AtSign },
  { value: "none", icon: Ban },
];

/** Full-screen composer for both a brand-new post and a reply - a reply
 * just carries `replyTo` and skips the reply-permission picker (it always
 * inherits "everyone" for now, matching a normal reply's expectations). */
export function PostComposer({
  replyTo,
  quoting,
  editing,
  onClose,
  onPublished,
}: {
  replyTo?: { id: string; content: string; username: string; avatarUrl: string | null } | null;
  quoting?: { id: string; content: string; username: string; avatarUrl: string | null } | null;
  /** Editing an existing post - only the text can change, not attachments,
   * and it stamps edited_at instead of creating a new post. */
  editing?: { id: string; content: string } | null;
  onClose: () => void;
  onPublished: (postId: string) => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [content, setContent] = useState(editing?.content ?? "");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [video, setVideo] = useState<VideoAttachment | null>(null);
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>("everyone");
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_CHARS - content.length;
  const canPublish =
    (content.trim().length > 0 || images.length > 0 || !!video) &&
    remaining >= 0 &&
    !publishing &&
    !video?.uploading &&
    !video?.error;

  function pickVideo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error(t("postVideoInvalidType"));
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error(t("postVideoTooLarge"));
      return;
    }
    const attachment: VideoAttachment = {
      file,
      preview: URL.createObjectURL(file),
      videoRowId: null,
      uploading: true,
      progress: 0,
      error: null,
    };
    setVideo(attachment);
    setImages([]);
    void uploadVideoToMux(
      file,
      file.name,
      (pct) => setVideo((v) => (v && v.file === file ? { ...v, progress: pct } : v)),
      { kind: "feed" },
    )
      .then(({ videoRowId }) => setVideo((v) => (v && v.file === file ? { ...v, videoRowId, uploading: false } : v)))
      .catch(() =>
        setVideo((v) => (v && v.file === file ? { ...v, uploading: false, error: t("postVideoUploadFailed") } : v)),
      );
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) break;
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages(next);
    setVideo(null);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function removeVideo() {
    setVideo(null);
  }

  function requestClose() {
    if (content.trim() || images.length || video) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function publish() {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("feed_posts")
          .update({ content: content.trim(), edited_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        void qc.invalidateQueries({ queryKey: ["feed-posts"] });
        void qc.invalidateQueries({ queryKey: ["feed-post-thread", editing.id] });
        toast.success(t("feedPostUpdated"));
        onPublished(editing.id);
        return;
      }
      const media = await Promise.all(
        images.map(async (img) => {
          const ext = img.file.name.split(".").pop() || "jpg";
          const path = await uploadFile("feed-posts", user.id, img.file, ext);
          return { url: path, type: "image" as const };
        }),
      );
      const { data, error } = await supabase
        .from("feed_posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          media,
          reply_to_id: replyTo?.id ?? null,
          quote_post_id: quoting?.id ?? null,
          reply_permission: replyPermission,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (video?.videoRowId) {
        await supabase
          .from("post_videos")
          .update({ post_id: data.id })
          .eq("id", video.videoRowId)
          .eq("user_id", user.id);
      }
      void qc.invalidateQueries({ queryKey: ["feed-posts"] });
      if (replyTo) void qc.invalidateQueries({ queryKey: ["feed-post-thread", replyTo.id] });
      toast.success(replyTo ? t("feedReplyPublished") : t("feedPostPublished"));
      onPublished(data.id);
    } catch (err) {
      toast.error(errorMessage(err, t("errorGeneric")));
    } finally {
      setPublishing(false);
    }
  }

  const other = replyTo ?? quoting ?? null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={requestClose}
          className="text-sm font-semibold text-foreground active:opacity-60"
        >
          {t("cancel")}
        </button>
        <PublishButton
          canPublish={canPublish}
          publishing={publishing}
          label={editing ? t("save") : undefined}
          onClick={() => void publish()}
        />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {replyTo ? (
          <p className="mb-2 text-sm text-muted-foreground">
            {t("feedReplyingTo", { username: replyTo.username })}
          </p>
        ) : null}
        <div className="flex gap-3">
          <MyAvatar />
          <div className="min-w-0 flex-1">
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("feedComposerPlaceholder")}
              rows={5}
              className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
            {other ? (
              <div className="mt-2 rounded-2xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <StoredImage
                    path={other.avatarUrl}
                    alt={other.username}
                    className="h-6 w-6 rounded-full"
                    fallback={other.username[0]?.toUpperCase() ?? "?"}
                  />
                  <span className="text-sm font-bold">@{other.username}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{other.content}</p>
              </div>
            ) : null}
            {images.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {images.map((img, i) => (
                  <div key={img.preview} className="relative overflow-hidden rounded-2xl">
                    <img src={img.preview} alt="" className="h-32 w-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {video ? (
              <div className="relative mt-3 overflow-hidden rounded-2xl bg-black">
                <video src={video.preview} className="max-h-72 w-full" muted playsInline controls={!video.uploading} />
                <button
                  onClick={removeVideo}
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {video.uploading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-xs font-bold">{t("postVideoUploading", { percent: video.progress })}</p>
                  </div>
                ) : null}
                {video.error ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-xs font-bold text-white">
                    {video.error}
                  </div>
                ) : null}
              </div>
            ) : null}
            {!replyTo && !editing ? (
              <button
                type="button"
                onClick={() => setPermissionOpen((v) => !v)}
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-foreground/70"
              >
                <Globe2 className="h-3.5 w-3.5" />
                {t(`feedReplyPermission_${replyPermission}` as `feedReplyPermission_${ReplyPermission}`)}
              </button>
            ) : null}
            {permissionOpen ? (
              <div className="mt-2 space-y-1 rounded-2xl border border-border p-2">
                {REPLY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setReplyPermission(opt.value);
                      setPermissionOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold",
                      replyPermission === opt.value ? "bg-foreground/10" : "hover:bg-surface-2",
                    )}
                  >
                    <opt.icon className="h-4 w-4" />
                    {t(`feedReplyPermission_${opt.value}` as `feedReplyPermission_${ReplyPermission}`)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addImages(e.target.files);
            e.target.value = "";
          }}
        />
        {!editing ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={images.length >= MAX_IMAGES || !!video}
              onClick={() => fileRef.current?.click()}
              className="p-1.5 text-primary disabled:opacity-40"
              aria-label={t("commentPickImage")}
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={videoFileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                pickVideo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={images.length > 0 || !!video}
              onClick={() => videoFileRef.current?.click()}
              className="p-1.5 text-primary disabled:opacity-40"
              aria-label={t("postAttachVideo")}
            >
              <VideoIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "text-xs font-bold",
            remaining < 0
              ? "text-destructive"
              : remaining <= 20
                ? "text-amber-500"
                : "text-muted-foreground",
          )}
        >
          {remaining <= 100 ? remaining : ""}
        </span>
      </div>

      {confirmDiscard ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-card p-5">
            <p className="text-base font-black">{t("feedDiscardTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("feedDiscardBody")}</p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-2xl bg-destructive py-3 text-sm font-bold text-destructive-foreground"
            >
              {t("feedDiscardConfirm")}
            </button>
            <button
              onClick={() => setConfirmDiscard(false)}
              className="mt-2 w-full rounded-2xl border border-border py-3 text-sm font-bold"
            >
              {t("feedKeepEditing")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PublishButton({
  canPublish,
  publishing,
  label,
  onClick,
}: {
  canPublish: boolean;
  publishing: boolean;
  label?: string | undefined;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      disabled={!canPublish}
      className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
    >
      {publishing ? t("loading") : (label ?? t("feedPublish"))}
    </button>
  );
}

function MyAvatar() {
  const { user } = useSession();
  const me = useQuery({
    queryKey: ["composer-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url,username")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  return (
    <StoredImage
      path={me.data?.avatar_url}
      alt={me.data?.username ?? ""}
      className="h-11 w-11 shrink-0 rounded-full"
      fallback={me.data?.username?.[0]?.toUpperCase() ?? "?"}
    />
  );
}
