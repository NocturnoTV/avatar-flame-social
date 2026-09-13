/**
 * Fixed catalog of Sparks profile badges (e.g. 🎮 Gamer, 🎙️ Has a mic...).
 * Users pick up to MAX_SPARK_BADGES of these from the "My profile" tab on
 * the Sparks page; they're stored as plain ids in profiles.spark_badges and
 * shown as chips on the swipe card.
 */
export type SparkBadgeId =
  | "gamer"
  | "mic"
  | "competitive"
  | "friendly"
  | "casual"
  | "creative"
  | "night_owl"
  | "team_player";

export const SPARK_BADGES: { id: SparkBadgeId; emoji: string; labelKey: string }[] = [
  { id: "gamer", emoji: "🎮", labelKey: "badgeGamer" },
  { id: "mic", emoji: "🎙️", labelKey: "badgeMic" },
  { id: "competitive", emoji: "🏆", labelKey: "badgeCompetitive" },
  { id: "friendly", emoji: "😄", labelKey: "badgeFriendly" },
  { id: "casual", emoji: "🎯", labelKey: "badgeCasual" },
  { id: "creative", emoji: "🎨", labelKey: "badgeCreative" },
  { id: "night_owl", emoji: "🌙", labelKey: "badgeNightOwl" },
  { id: "team_player", emoji: "🤝", labelKey: "badgeTeamPlayer" },
];

export const MAX_SPARK_BADGES = 3;

export function sparkBadge(id: string) {
  return SPARK_BADGES.find((b) => b.id === id);
}
