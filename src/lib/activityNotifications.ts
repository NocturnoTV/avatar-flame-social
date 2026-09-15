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
  "video_mention",
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
    case "video_mention":
      return t("notifVideoMentionBody", { name: actorName, text: body ?? "" });
    default:
      return body ?? "";
  }
}

/**
 * Same as localizeActivityNotification, but without the actor's name baked
 * into the sentence - for the "Activités" tabbed list, where the actor's
 * avatar and username are already shown separately on the row, e.g.
 * "@alice" + "a répondu à ton commentaire: salut, ça va ?" rather than
 * repeating the name inside the sentence itself.
 */
export function localizeActivityAction(
  t: (key: string, vars?: Record<string, string | number>) => string,
  kind: string,
  body: string | null,
): string {
  switch (kind) {
    case "video_like":
      return t("notifVideoLikeAction");
    case "video_favorite":
      return t("notifVideoFavoriteAction");
    case "video_repost":
      return t("notifVideoRepostAction");
    case "video_comment":
      return t("notifVideoCommentAction", { text: body ?? "" });
    case "video_comment_reply":
      return t("notifVideoCommentReplyAction", { text: body ?? "" });
    case "video_mention":
      return t("notifVideoMentionAction", { text: body ?? "" });
    default:
      return body ?? "";
  }
}
