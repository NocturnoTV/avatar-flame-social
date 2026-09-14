/** Video-activity notification kinds (likes, favorites, reposts, comments
 * and replies) - shown in their own "Activités" thread, separate from Team
 * Spark which is reserved for official messages (the welcome message, and
 * future announcements). Kept as its own module since both
 * messages.index.tsx (row previews) and messages.$id.tsx (the full thread)
 * need the exact same kind list and rendering. */
export const ACTIVITY_NOTIFICATION_KINDS = [
  "video_like",
  "video_favorite",
  "video_repost",
  "video_comment",
  "video_comment_reply",
] as const;

export type ActivityNotificationKind = (typeof ACTIVITY_NOTIFICATION_KINDS)[number];

export function isActivityNotificationKind(kind: string): kind is ActivityNotificationKind {
  return (ACTIVITY_NOTIFICATION_KINDS as readonly string[]).includes(kind);
}

/**
 * Renders a video-activity notification's text in the viewer's *current*
 * language. The database only stores the raw data (kind, actor_id, and a
 * comment snippet in `body` where relevant) rather than a pre-rendered
 * sentence, so this always reflects whatever language is selected right
 * now - including if the viewer changes their language after the
 * notification was created.
 */
export function localizeActivityNotification(
  t: (key: string, vars?: Record<string, string | number>) => string,
  kind: string,
  actorName: string,
  body: string | null,
): string {
  switch (kind) {
    case "video_like":
      return t("notifVideoLikeBody", { name: actorName });
    case "video_favorite":
      return t("notifVideoFavoriteBody", { name: actorName });
    case "video_repost":
      return t("notifVideoRepostBody", { name: actorName });
    case "video_comment":
      return t("notifVideoCommentBody", { name: actorName, text: body ?? "" });
    case "video_comment_reply":
      return t("notifVideoCommentReplyBody", { name: actorName, text: body ?? "" });
    default:
      return body ?? "";
  }
}
