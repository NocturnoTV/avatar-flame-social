import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Image as ImageIcon, Globe2, Users, AtSign, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { uploadFile } from "@/lib/media";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage } from "@/lib/utils";
import type { PostRow, ReplyPermission } from "@/lib/feedPosts";

const MAX_CHARS = 500;
const MAX_IMAGES = 4;

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
  onClose,
  onPublished,
}: {
  replyTo?: { id: string; content: string; username: string; avatarUrl: string | null } | null;
  quoting?: { id: string; content: string; username: string; avatarUrl: string | null } | null;
  onClose: () => void;
  onPublished: (postId: string) => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>("everyone");
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_CHARS - content.length;
  const canPublish = (content.trim().length > 0 || images.length > 0) && remaining >= 0 && !publishing;

  function addImages(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) break;
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages(next);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function requestClose() {
    if (content.trim() || images.length) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function publish() {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
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
        <PublishButton canPublish={canPublish} publishing={publishing} onClick={() => void publish()} />
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
            {!replyTo ? (
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
        <button
          type="button"
          disabled={images.length >= MAX_IMAGES}
          onClick={() => fileRef.current?.click()}
          className="p-1.5 text-primary disabled:opacity-40"
          aria-label={t("commentPickImage")}
        >
          <ImageIcon className="h-5 w-5" />
        </button>
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
  onClick,
}: {
  canPublish: boolean;
  publishing: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      disabled={!canPublish}
      className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
    >
      {publishing ? t("loading") : t("feedPublish")}
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
