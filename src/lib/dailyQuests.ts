/**
 * Fixed catalog of daily quests. Must mirror the VALUES list embedded in the
 * `ensure_daily_quests_for` SQL function (supabase/migrations/
 * 20260914160000_blox_economy.sql) - key/target/reward stay in sync by hand
 * since the catalog is small and rarely changes. Each `metricKey` is the
 * `_metric_key` string passed to `bump_quest_progress` wherever that action
 * actually happens in the app.
 */
export type QuestKey =
  | "social_spark"
  | "conversation"
  | "creator"
  | "explorer"
  | "community"
  | "make_a_friend"
  | "share_it"
  | "content_time"
  | "show_some_love"
  | "daily_visit";

export type QuestDef = {
  key: QuestKey;
  emoji: string;
  target: number;
  reward: number;
  titleKey: string;
  descriptionKey: string;
};

export const DAILY_QUESTS: QuestDef[] = [
  {
    key: "social_spark",
    emoji: "❤️",
    target: 10,
    reward: 30,
    titleKey: "questSocialSpark",
    descriptionKey: "questSocialSparkDesc",
  },
  {
    key: "conversation",
    emoji: "💬",
    target: 3,
    reward: 40,
    titleKey: "questConversation",
    descriptionKey: "questConversationDesc",
  },
  {
    key: "creator",
    emoji: "🎥",
    target: 1,
    reward: 50,
    titleKey: "questCreator",
    descriptionKey: "questCreatorDesc",
  },
  {
    key: "explorer",
    emoji: "👥",
    target: 10,
    reward: 25,
    titleKey: "questExplorer",
    descriptionKey: "questExplorerDesc",
  },
  {
    key: "community",
    emoji: "🏘️",
    target: 3,
    reward: 40,
    titleKey: "questCommunity",
    descriptionKey: "questCommunityDesc",
  },
  {
    key: "make_a_friend",
    emoji: "🤝",
    target: 1,
    reward: 35,
    titleKey: "questMakeAFriend",
    descriptionKey: "questMakeAFriendDesc",
  },
  {
    key: "share_it",
    emoji: "📤",
    target: 2,
    reward: 30,
    titleKey: "questShareIt",
    descriptionKey: "questShareItDesc",
  },
  {
    key: "content_time",
    emoji: "🎬",
    target: 5,
    reward: 30,
    titleKey: "questContentTime",
    descriptionKey: "questContentTimeDesc",
  },
  {
    key: "show_some_love",
    emoji: "⭐",
    target: 5,
    reward: 25,
    titleKey: "questShowSomeLove",
    descriptionKey: "questShowSomeLoveDesc",
  },
  {
    key: "daily_visit",
    emoji: "🎁",
    target: 1,
    reward: 15,
    titleKey: "questDailyVisit",
    descriptionKey: "questDailyVisitDesc",
  },
];

export function questDef(key: string) {
  return DAILY_QUESTS.find((q) => q.key === key);
}

export const BADGE_RARITY_STYLES: Record<string, string> = {
  common: "border-border bg-card",
  rare: "border-sky-400/40 bg-sky-500/5",
  epic: "border-purple-400/40 bg-purple-500/5",
  legendary: "border-amber-400/50 bg-amber-500/5",
};

export const BADGE_RARITY_LABEL_KEYS: Record<string, string> = {
  common: "rarityCommon",
  rare: "rarityRare",
  epic: "rarityEpic",
  legendary: "rarityLegendary",
};
