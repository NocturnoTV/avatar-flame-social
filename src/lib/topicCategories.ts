/** The recommendation engine's topic taxonomy - shared as its own
 * zero-dependency module so both the (server-only) recommendation engine
 * and plain client UI (e.g. the ad campaign targeting picker) can safely
 * import the exact same list without pulling in server-only code. */
export const TOPIC_CATEGORIES = [
  "roblox_development",
  "scripting",
  "building",
  "gaming",
  "meme",
  "funny",
  "roleplay",
  "obby",
  "tutorial",
  "news",
  "updates",
  "showcase",
  "ugc",
  "animation",
  "vehicles",
  "scp",
  "murder_mystery",
] as const;

export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];
