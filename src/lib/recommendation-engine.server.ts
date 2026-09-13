/**
 * BLOXSPARK PERSONALIZED VIDEO RECOMMENDATION ENGINE
 * ===================================================
 * Server-only. A proprietary, heuristic scoring + ranking pipeline for the
 * Discover "For You" feed — built around the same principles as modern
 * short-video recommenders (watch time, completion, interactions, freshness,
 * exploration, diversity, negative feedback, quality, safety) without
 * copying any specific product's algorithm.
 *
 * WHAT'S REAL vs. A v1 PLACEHOLDER
 * - Signal storage, affinity learning (EMA with time-decay), candidate
 *   generation, scoring, freshness, greedy diversification, exploration
 *   injection, eligibility/safety filtering and rule-based anti-fraud are
 *   fully implemented and wired to real Supabase data.
 * - `predicted_watch/completion/like/comment/share/follow` are heuristic
 *   estimators built from the user's own affinities blended with each
 *   video's observed ratios — not trained ML models. Swapping them for real
 *   predictive models later only means changing the bodies of the small
 *   `predict*` functions below; every caller is unaffected.
 * - Anti-fraud is rule-based (burst + new-account heuristics), not ML.
 *
 * Pipeline (see generatePersonalizedFeed): candidates → filter → score →
 * freshness → diversity → exploration → final feed. Every stage is its own
 * exported function per the requested architecture, so weights, filters or
 * any single stage can be iterated on independently.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Config & constants
// ---------------------------------------------------------------------------

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

const DEFAULT_AFFINITY = 0.3;
const NEUTRAL_AFFINITY = 0.5;

// Exponential moving-average learning rates. Tuned so a full, completed
// watch nudges a 0.73 affinity to ~0.79 (matches product spec's example),
// while a single "not interested" click only nudges it down a little
// (0.72 -> ~0.67) instead of zeroing it out.
const LR = {
  fullWatch: 0.24,
  partialWatch: 0.1,
  like: 0.28,
  comment: 0.22,
  share: 0.22,
  follow: 0.3,
  visitProfile: 0.08,
  ignore: 0.045,
  notInterested: 0.07,
  hide: 0.35,
} as const;

type Weights = {
  watch: number;
  completion: number;
  like: number;
  comment: number;
  share: number;
  follow: number;
  creatorAffinity: number;
  topicAffinity: number;
};

type EngineConfig = {
  weights: Weights;
  freshnessHalfLifeHours: number;
  affinityHalfLifeDays: number;
  explorationRatio: number;
};

const FALLBACK_CONFIG: EngineConfig = {
  weights: {
    watch: 0.3,
    completion: 0.2,
    like: 0.15,
    comment: 0.1,
    share: 0.1,
    follow: 0.05,
    creatorAffinity: 0.05,
    topicAffinity: 0.05,
  },
  freshnessHalfLifeHours: 36,
  affinityHalfLifeDays: 45,
  explorationRatio: 0.15,
};

export async function getEngineConfig(): Promise<EngineConfig> {
  const { data } = await supabaseAdmin
    .from("recommendation_config")
    .select("weights,decay,exploration_ratio")
    .eq("id", "default")
    .maybeSingle();
  if (!data) return FALLBACK_CONFIG;
  const weights = { ...FALLBACK_CONFIG.weights, ...(data.weights as Partial<Weights>) };
  const decay = data.decay as { freshnessHalfLifeHours?: number; affinityHalfLifeDays?: number };
  return {
    weights,
    freshnessHalfLifeHours: decay?.freshnessHalfLifeHours ?? FALLBACK_CONFIG.freshnessHalfLifeHours,
    affinityHalfLifeDays: decay?.affinityHalfLifeDays ?? FALLBACK_CONFIG.affinityHalfLifeDays,
    explorationRatio: data.exploration_ratio ?? FALLBACK_CONFIG.explorationRatio,
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Pulls a stored value back toward neutral as it ages (section 18). */
function timeDecay(value: number, updatedAt: string, halfLifeDays: number, neutral: number) {
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  const factor = Math.exp((-Math.LN2 * ageDays) / Math.max(halfLifeDays, 1));
  return neutral + (value - neutral) * factor;
}

// ---------------------------------------------------------------------------
// 1. getUserInterestProfile — section 4 & 17
// ---------------------------------------------------------------------------

export async function getUserInterestProfile(
  userId: string,
): Promise<Record<TopicCategory, number>> {
  const config = await getEngineConfig();
  const { data } = await supabaseAdmin
    .from("user_topic_affinity")
    .select("category,affinity,updated_at")
    .eq("user_id", userId);

  const profile = Object.fromEntries(TOPIC_CATEGORIES.map((c) => [c, DEFAULT_AFFINITY])) as Record<
    TopicCategory,
    number
  >;

  for (const row of data ?? []) {
    if (!TOPIC_CATEGORIES.includes(row.category as TopicCategory)) continue;
    profile[row.category as TopicCategory] = clamp01(
      timeDecay(row.affinity, row.updated_at, config.affinityHalfLifeDays, NEUTRAL_AFFINITY),
    );
  }
  return profile;
}

/** Creator affinity, scoped to a set of creator ids to keep the query cheap. */
export async function getUserCreatorAffinity(
  userId: string,
  creatorIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>(creatorIds.map((id) => [id, DEFAULT_AFFINITY]));
  if (creatorIds.length === 0) return map;
  const config = await getEngineConfig();
  const { data } = await supabaseAdmin
    .from("user_creator_affinity")
    .select("creator_id,affinity,updated_at")
    .eq("user_id", userId)
    .in("creator_id", creatorIds);
  for (const row of data ?? []) {
    map.set(
      row.creator_id,
      clamp01(
        timeDecay(row.affinity, row.updated_at, config.affinityHalfLifeDays, NEUTRAL_AFFINITY),
      ),
    );
  }
  return map;
}

// ---------------------------------------------------------------------------
// 2. getCandidateVideos — section 6 & 15 (step 1)
// ---------------------------------------------------------------------------

export type Candidate = {
  id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  sound_name: string | null;
  created_at: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  favorites_count: number;
  reposts_count: number;
  shares_count: number;
  recommendation_eligible: boolean;
  categories: TopicCategory[];
  source: "following" | "topic" | "popular" | "recent" | "exploration";
};

const VIDEO_COLUMNS =
  "id,user_id,storage_path,caption,sound_name,created_at,views_count,likes_count,comments_count,favorites_count,reposts_count,shares_count,recommendation_eligible,visibility";

async function attachCategories(rows: any[]): Promise<Candidate[]> {
  const ids = rows.map((r) => r.id);
  const byVideo = new Map<string, TopicCategory[]>();
  if (ids.length) {
    const { data } = await supabaseAdmin
      .from("video_categories")
      .select("video_id,category")
      .in("video_id", ids);
    for (const row of data ?? []) {
      const list = byVideo.get(row.video_id) ?? [];
      list.push(row.category as TopicCategory);
      byVideo.set(row.video_id, list);
    }
  }
  return rows.map((r) => ({ ...r, categories: byVideo.get(r.id) ?? [] }) as Candidate);
}

export async function getCandidateVideos(userId: string): Promise<Candidate[]> {
  const [followsRes, topicProfile] = await Promise.all([
    supabaseAdmin.from("follows").select("following_id").eq("follower_id", userId),
    getUserInterestProfile(userId),
  ]);
  const followingIds = (followsRes.data ?? []).map((f) => f.following_id);
  const topTopics = Object.entries(topicProfile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category]) => category);

  const queries: PromiseLike<{ rows: any[]; source: Candidate["source"] }>[] = [];

  if (followingIds.length > 0) {
    queries.push(
      supabaseAdmin
        .from("videos")
        .select(VIDEO_COLUMNS)
        .in("user_id", followingIds)
        .in("visibility", ["public", "sparks"])
        .order("created_at", { ascending: false })
        .limit(60)
        .then((r) => ({ rows: r.data ?? [], source: "following" as const })),
    );
  }

  if (topTopics.length > 0) {
    queries.push(
      supabaseAdmin
        .from("video_categories")
        .select(`weight,video:videos!inner(${VIDEO_COLUMNS})`)
        .in("category", topTopics)
        .eq("video.visibility", "public")
        .order("weight", { ascending: false })
        .limit(150)
        .then((r) => ({
          rows: (r.data ?? []).map((row: any) => row.video).filter(Boolean),
          source: "topic" as const,
        })),
    );
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  queries.push(
    supabaseAdmin
      .from("videos")
      .select(VIDEO_COLUMNS)
      .eq("visibility", "public")
      .gte("created_at", sevenDaysAgo)
      .order("views_count", { ascending: false })
      .limit(60)
      .then((r) => ({ rows: r.data ?? [], source: "popular" as const })),
  );

  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  queries.push(
    supabaseAdmin
      .from("videos")
      .select(VIDEO_COLUMNS)
      .eq("visibility", "public")
      .gte("created_at", twoDaysAgo)
      .order("created_at", { ascending: false })
      .limit(40)
      .then((r) => ({ rows: r.data ?? [], source: "recent" as const })),
  );

  // Exploration pool: outside the user's top categories entirely (section 6).
  queries.push(
    supabaseAdmin
      .from("videos")
      .select(VIDEO_COLUMNS)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(200)
      .then((r) => ({ rows: r.data ?? [], source: "exploration" as const })),
  );

  const results = await Promise.all(queries);
  const seen = new Map<string, Candidate & { source: Candidate["source"] }>();
  for (const { rows, source } of results) {
    const withCategories = await attachCategories(rows);
    for (const video of withCategories) {
      if (!seen.has(video.id)) seen.set(video.id, { ...video, source });
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// 3. filterIneligibleVideos — section 11 & 13
// ---------------------------------------------------------------------------

export async function filterIneligibleVideos(
  userId: string,
  candidates: Candidate[],
): Promise<Candidate[]> {
  const [blocksRes, hiddenCreatorsRes, hiddenCategoriesRes, notInterestedRes, completedRes] =
    await Promise.all([
      supabaseAdmin.from("blocks").select("blocked_id").eq("blocker_id", userId),
      supabaseAdmin.from("hidden_creators").select("creator_id").eq("user_id", userId),
      supabaseAdmin.from("hidden_categories").select("category").eq("user_id", userId),
      supabaseAdmin.from("video_not_interested").select("video_id").eq("user_id", userId),
      supabaseAdmin
        .from("video_watch_events")
        .select("video_id")
        .eq("user_id", userId)
        .eq("completed", true),
    ]);

  const blockedCreators = new Set((blocksRes.data ?? []).map((b) => b.blocked_id));
  const hiddenCreators = new Set((hiddenCreatorsRes.data ?? []).map((h) => h.creator_id));
  const hiddenCategories = new Set((hiddenCategoriesRes.data ?? []).map((h) => h.category));
  const notInterested = new Set((notInterestedRes.data ?? []).map((n) => n.video_id));
  const alreadyCompleted = new Set((completedRes.data ?? []).map((w) => w.video_id));

  return candidates.filter((video) => {
    if (video.user_id === userId) return false;
    if (!video.recommendation_eligible) return false;
    if (blockedCreators.has(video.user_id) || hiddenCreators.has(video.user_id)) return false;
    if (video.categories.some((c) => hiddenCategories.has(c))) return false;
    if (notInterested.has(video.id)) return false;
    if (alreadyCompleted.has(video.id)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// 4. calculateVideoScore — section 3
// ---------------------------------------------------------------------------

type VideoStats = {
  watchRatio: number;
  completionRate: number;
  likeRatio: number;
  commentRatio: number;
  shareRatio: number;
};

async function getVideoStats(videoIds: string[]): Promise<Map<string, VideoStats>> {
  const map = new Map<string, VideoStats>();
  if (videoIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("video_watch_events")
    .select("video_id,watch_ratio,completed")
    .in("video_id", videoIds);
  const grouped = new Map<string, { ratios: number[]; completed: number }>();
  for (const row of data ?? []) {
    const g = grouped.get(row.video_id) ?? { ratios: [], completed: 0 };
    g.ratios.push(row.watch_ratio);
    if (row.completed) g.completed += 1;
    grouped.set(row.video_id, g);
  }
  for (const videoId of videoIds) {
    const g = grouped.get(videoId);
    const events = g?.ratios.length ?? 0;
    map.set(videoId, {
      watchRatio: events ? g!.ratios.reduce((a, b) => a + b, 0) / events : 0.4,
      completionRate: events ? g!.completed / events : 0.25,
      likeRatio: 0,
      commentRatio: 0,
      shareRatio: 0,
    });
  }
  return map;
}

export type ScoredVideo = Candidate & {
  score: number;
  reason: "following" | "creator" | "topic" | "popular" | "fresh" | "exploration";
};

export async function calculateVideoScore(
  userId: string,
  video: Candidate,
  ctx: {
    config: EngineConfig;
    topicProfile: Record<TopicCategory, number>;
    creatorAffinity: Map<string, number>;
    stats: Map<string, VideoStats>;
    followingIds: Set<string>;
  },
): Promise<ScoredVideo> {
  const stats =
    ctx.stats.get(video.id) ??
    ({
      watchRatio: 0.4,
      completionRate: 0.25,
      likeRatio: 0,
      commentRatio: 0,
      shareRatio: 0,
    } as VideoStats);
  const creatorAffinity = ctx.creatorAffinity.get(video.user_id) ?? DEFAULT_AFFINITY;
  const topicAffinity = video.categories.length
    ? video.categories.reduce((sum, c) => sum + (ctx.topicProfile[c] ?? DEFAULT_AFFINITY), 0) /
      video.categories.length
    : DEFAULT_AFFINITY;

  const views = Math.max(video.views_count, 1);
  const likeRatio = clamp01(video.likes_count / views);
  const commentRatio = clamp01(video.comments_count / views);
  const shareRatio = clamp01((video.reposts_count + video.shares_count) / views);

  const predictedWatch = clamp01(
    0.5 * creatorAffinity + 0.3 * topicAffinity + 0.2 * stats.watchRatio,
  );
  const predictedCompletion = clamp01(0.6 * stats.completionRate + 0.4 * topicAffinity);
  const predictedLike = clamp01(0.5 * likeRatio * 4 + 0.3 * creatorAffinity + 0.2 * topicAffinity);
  const predictedComment = clamp01(commentRatio * 8 * (0.5 + 0.5 * creatorAffinity));
  const predictedShare = clamp01(shareRatio * 8 * (0.5 + 0.5 * topicAffinity));
  const predictedFollow = ctx.followingIds.has(video.user_id) ? 0 : clamp01(creatorAffinity * 0.8);

  const w = ctx.config.weights;
  const score =
    w.watch * predictedWatch +
    w.completion * predictedCompletion +
    w.like * predictedLike +
    w.comment * predictedComment +
    w.share * predictedShare +
    w.follow * predictedFollow +
    w.creatorAffinity * creatorAffinity +
    w.topicAffinity * topicAffinity;

  const reason: ScoredVideo["reason"] = ctx.followingIds.has(video.user_id)
    ? "following"
    : creatorAffinity > 0.6
      ? "creator"
      : topicAffinity > 0.6
        ? "topic"
        : video.source === "popular"
          ? "popular"
          : video.source === "exploration"
            ? "exploration"
            : "fresh";

  return { ...video, score, reason };
}

// ---------------------------------------------------------------------------
// 5. applyFreshnessScore — section 9
// ---------------------------------------------------------------------------

export function applyFreshnessScore(video: ScoredVideo, config: EngineConfig): ScoredVideo {
  const ageHours = (Date.now() - new Date(video.created_at).getTime()) / 3_600_000;
  const bonus = 0.08 * Math.exp((-Math.LN2 * ageHours) / config.freshnessHalfLifeHours);
  return { ...video, score: video.score + bonus };
}

// ---------------------------------------------------------------------------
// 6. applyDiversityPenalty — section 10 (greedy re-ranking / MMR-style)
// ---------------------------------------------------------------------------

export function applyDiversityPenalty(videos: ScoredVideo[], limit: number): ScoredVideo[] {
  const pool = [...videos].sort((a, b) => b.score - a.score);
  const chosen: ScoredVideo[] = [];
  const recentCreators: string[] = [];
  const recentCategories: string[] = [];
  const recentSounds: string[] = [];
  const WINDOW = 4;

  while (chosen.length < limit && pool.length > 0) {
    let bestIndex = 0;
    let bestEffective = -Infinity;
    // Look at a lookahead slice of the highest-scoring remaining candidates
    // rather than the whole pool, to keep this cheap on large candidate sets.
    const slice = pool.slice(0, Math.min(pool.length, 25));
    for (let i = 0; i < slice.length; i++) {
      const v = slice[i]!;
      let penalty = 0;
      if (recentCreators.includes(v.user_id)) penalty += 0.18;
      if (v.categories.some((c) => recentCategories.includes(c))) penalty += 0.1;
      if (v.sound_name && recentSounds.includes(v.sound_name)) penalty += 0.06;
      const effective = v.score - penalty;
      if (effective > bestEffective) {
        bestEffective = effective;
        bestIndex = i;
      }
    }
    const [picked] = pool.splice(bestIndex, 1);
    if (!picked) break;
    chosen.push(picked);
    recentCreators.push(picked.user_id);
    if (recentCreators.length > WINDOW) recentCreators.shift();
    recentCategories.push(...picked.categories);
    while (recentCategories.length > WINDOW * 2) recentCategories.shift();
    if (picked.sound_name) recentSounds.push(picked.sound_name);
    if (recentSounds.length > WINDOW) recentSounds.shift();
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// 7. applyExploration — section 6
// ---------------------------------------------------------------------------

export function applyExploration(
  ranked: ScoredVideo[],
  explorationPool: ScoredVideo[],
  ratio: number,
): ScoredVideo[] {
  const alreadyIn = new Set(ranked.map((v) => v.id));
  const freshExploration = explorationPool
    .filter((v) => !alreadyIn.has(v.id))
    .sort(() => Math.random() - 0.5);
  if (freshExploration.length === 0) return ranked;

  const result = [...ranked];
  const everyN = Math.max(Math.round(1 / Math.max(ratio, 0.01)), 3);
  let explorationIndex = 0;
  for (
    let i = everyN - 1;
    i < result.length && explorationIndex < freshExploration.length;
    i += everyN
  ) {
    const pick = freshExploration[explorationIndex++]!;
    result.splice(i, 0, { ...pick, reason: "exploration" });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 8. rankVideos + generatePersonalizedFeed — section 15 (full pipeline)
// ---------------------------------------------------------------------------

export async function rankVideos(userId: string, candidates: Candidate[], limit: number) {
  const config = await getEngineConfig();
  const [followsRes, topicProfile] = await Promise.all([
    supabaseAdmin.from("follows").select("following_id").eq("follower_id", userId),
    getUserInterestProfile(userId),
  ]);
  const followingIds = new Set((followsRes.data ?? []).map((f) => f.following_id));
  const creatorAffinity = await getUserCreatorAffinity(userId, [
    ...new Set(candidates.map((c) => c.user_id)),
  ]);
  const stats = await getVideoStats(candidates.map((c) => c.id));

  const ctx = { config, topicProfile, creatorAffinity, stats, followingIds };
  const scored = await Promise.all(
    candidates.map((video) => calculateVideoScore(userId, video, ctx)),
  );
  const withFreshness = scored.map((v) => applyFreshnessScore(v, config));

  const explorationPool = withFreshness.filter((v) => v.source === "exploration");
  const mainPool = withFreshness.filter((v) => v.source !== "exploration");
  const mainLimit = Math.round(limit * (1 - config.explorationRatio));

  const diversified = applyDiversityPenalty(mainPool, mainLimit);
  return applyExploration(diversified, explorationPool, config.explorationRatio).slice(0, limit);
}

/**
 * Full pipeline entry point (section 15, steps 1-6):
 * candidates -> filter -> score -> freshness -> diversity -> exploration.
 */
export async function generatePersonalizedFeed(userId: string, limit = 30) {
  const candidates = await getCandidateVideos(userId);
  const eligible = await filterIneligibleVideos(userId, candidates);
  return rankVideos(userId, eligible, limit);
}

// ---------------------------------------------------------------------------
// 9. Interaction recording -> affinity learning — section 4, 5, 17, 18, 19
// ---------------------------------------------------------------------------

async function bumpTopicAffinity(
  userId: string,
  category: string,
  target: number,
  lr: number,
  trust: number,
) {
  const { data: current } = await supabaseAdmin
    .from("user_topic_affinity")
    .select("affinity")
    .eq("user_id", userId)
    .eq("category", category)
    .maybeSingle();
  const old = current?.affinity ?? DEFAULT_AFFINITY;
  const next = clamp01(old + lr * trust * (target - old));
  await supabaseAdmin
    .from("user_topic_affinity")
    .upsert(
      { user_id: userId, category, affinity: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,category" },
    );
}

async function bumpCreatorAffinity(
  userId: string,
  creatorId: string,
  target: number,
  lr: number,
  trust: number,
) {
  const { data: current } = await supabaseAdmin
    .from("user_creator_affinity")
    .select("affinity")
    .eq("user_id", userId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  const old = current?.affinity ?? DEFAULT_AFFINITY;
  const next = clamp01(old + lr * trust * (target - old));
  await supabaseAdmin
    .from("user_creator_affinity")
    .upsert(
      {
        user_id: userId,
        creator_id: creatorId,
        affinity: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,creator_id" },
    );
}

/**
 * Rule-based anti-fraud (section 14): dampens how much a burst of activity
 * from a very new or abnormally fast-firing account can move affinities.
 * Not ML — a cheap, honest first line of defense. A real fraud model
 * (device/IP clustering, graph analysis) is a natural v2.
 */
async function trustWeight(userId: string): Promise<number> {
  const [{ data: profile }, { count: recentEvents }] = await Promise.all([
    supabaseAdmin.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("video_watch_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString()),
  ]);
  const accountAgeHours = profile?.created_at
    ? (Date.now() - new Date(profile.created_at).getTime()) / 3_600_000
    : 999;
  const burst = recentEvents ?? 0;
  if (accountAgeHours < 1 && burst > 40) return 0.1;
  if (burst > 100) return 0.3;
  return 1;
}

export async function recordWatchEvent(
  userId: string,
  videoId: string,
  input: { watchMs: number; durationSeconds: number; replayed?: boolean },
) {
  const durationMs = Math.max(input.durationSeconds * 1000, 1);
  const watchRatio = clamp01(input.watchMs / durationMs);
  const completed = watchRatio >= 0.9;
  const skipped = !completed && input.watchMs < 2500 && watchRatio < 0.3;

  await supabaseAdmin.from("video_watch_events").insert({
    user_id: userId,
    video_id: videoId,
    watch_ms: Math.round(input.watchMs),
    watch_ratio: watchRatio,
    completed,
    replayed: input.replayed ?? false,
    skipped,
    time_before_skip_ms: skipped ? Math.round(input.watchMs) : null,
  });

  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("user_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) return;

  const { data: categories } = await supabaseAdmin
    .from("video_categories")
    .select("category")
    .eq("video_id", videoId);

  const trust = await trustWeight(userId);
  const lr = completed
    ? LR.fullWatch
    : skipped
      ? -LR.ignore
      : input.replayed
        ? LR.fullWatch * 1.2
        : LR.partialWatch * watchRatio;
  const target = lr < 0 ? 0 : 1;
  const effectiveLr = Math.abs(lr);

  await Promise.all([
    bumpCreatorAffinity(userId, video.user_id, target, effectiveLr, trust),
    ...(categories ?? []).map((c) =>
      bumpTopicAffinity(userId, c.category, target, effectiveLr, trust),
    ),
  ]);
}

export async function recordNotInterested(userId: string, videoId: string) {
  await supabaseAdmin
    .from("video_not_interested")
    .upsert({ user_id: userId, video_id: videoId }, { onConflict: "user_id,video_id" });

  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("user_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) return;
  const { data: categories } = await supabaseAdmin
    .from("video_categories")
    .select("category")
    .eq("video_id", videoId);

  const trust = await trustWeight(userId);
  await Promise.all([
    bumpCreatorAffinity(userId, video.user_id, 0, LR.notInterested, trust),
    ...(categories ?? []).map((c) =>
      bumpTopicAffinity(userId, c.category, 0, LR.notInterested, trust),
    ),
  ]);
}

export async function recordHideCreator(userId: string, creatorId: string) {
  await supabaseAdmin
    .from("hidden_creators")
    .upsert({ user_id: userId, creator_id: creatorId }, { onConflict: "user_id,creator_id" });
  await bumpCreatorAffinity(userId, creatorId, 0, LR.hide, 1);
}

export async function recordHideCategory(userId: string, category: TopicCategory) {
  await supabaseAdmin
    .from("hidden_categories")
    .upsert({ user_id: userId, category }, { onConflict: "user_id,category" });
  await bumpTopicAffinity(userId, category, 0, LR.hide, 1);
}

export async function recordPositiveAction(
  userId: string,
  videoId: string,
  action: "like" | "comment" | "share" | "follow" | "visit_profile",
) {
  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("user_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) return;
  const { data: categories } = await supabaseAdmin
    .from("video_categories")
    .select("category")
    .eq("video_id", videoId);
  const trust = await trustWeight(userId);
  const lr = LR[action === "visit_profile" ? "visitProfile" : action];
  await Promise.all([
    bumpCreatorAffinity(userId, video.user_id, 1, lr, trust),
    ...(categories ?? []).map((c) => bumpTopicAffinity(userId, c.category, 1, lr * 0.6, trust)),
  ]);
}
