import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgIlikePattern, pgQuote } from "@/lib/pgFilter";

async function requireStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((row) => row.role);
  if (!roles.some((role) => role === "admin" || role === "moderator")) throw new Error("forbidden");
  return supabaseAdmin;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketByDay(rows: { created_at: string }[], days: number) {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(daysAgo(i).toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

/** Everything the Overview + Analytics tabs need, in one round trip so the
 * dashboard doesn't fire dozens of small count queries. */
export const adminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireStaff(context.userId);
    const since30 = daysAgo(30).toISOString();
    const since7 = daysAgo(7).toISOString();

    const [
      profiles,
      newProfiles30,
      matches,
      messages30,
      swipes30,
      videos,
      reportsOpen,
      dataRequestsOpen,
      sparkPlusActive,
      bloxTx,
      subs,
      communities,
    ] = await Promise.all([
      db.from("profiles").select("id,created_at,last_active_at"),
      db.from("profiles").select("created_at").gte("created_at", since30),
      db.from("matches").select("id,created_at"),
      db.from("messages").select("created_at").gte("created_at", since30),
      db.from("swipes").select("id,action,created_at").gte("created_at", since30),
      db.from("videos").select("id,created_at,views_count,likes_count"),
      db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      db.from("data_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("spark_plus_active", true),
      db.from("blox_transactions").select("amount,kind,created_at"),
      db.from("subscriptions").select("status,current_period_start"),
      db.from("communities").select("id", { count: "exact", head: true }),
    ]);
    for (const r of [
      profiles,
      newProfiles30,
      matches,
      messages30,
      swipes30,
      videos,
      bloxTx,
      subs,
      communities,
    ]) {
      if (r.error) throw r.error;
    }

    const allProfiles = profiles.data ?? [];
    const totalUsers = allProfiles.length;
    const dau = allProfiles.filter(
      (p) => p.last_active_at && new Date(p.last_active_at) >= new Date(since7),
    ).length;
    const mau = allProfiles.filter(
      (p) => p.last_active_at && new Date(p.last_active_at) >= new Date(since30),
    ).length;

    // Rough day-1 retention: of users who signed up 2-8 days ago, how many
    // have been active since the day after they signed up.
    const cohortStart = daysAgo(8);
    const cohortEnd = daysAgo(2);
    const cohort = allProfiles.filter((p) => {
      const created = new Date(p.created_at);
      return created >= cohortStart && created <= cohortEnd;
    });
    const cohortRetained = cohort.filter((p) => {
      if (!p.last_active_at) return false;
      const created = new Date(p.created_at);
      const active = new Date(p.last_active_at);
      return active.getTime() - created.getTime() > 24 * 3_600_000;
    });
    const day1Retention = cohort.length
      ? Math.round((cohortRetained.length / cohort.length) * 100)
      : 0;

    const swipeRows = swipes30.data ?? [];
    const rightSwipes = swipeRows.filter((s) => s.action === "like" || s.action === "super").length;
    const matchRate = swipeRows.length
      ? Math.round(((matches.data?.length ?? 0) / swipeRows.length) * 1000) / 10
      : 0;

    const bloxRows = bloxTx.data ?? [];
    const bloxByKind: Record<string, number> = {};
    for (const row of bloxRows) {
      bloxByKind[row.kind] = (bloxByKind[row.kind] ?? 0) + row.amount;
    }
    const packPurchaseCount = bloxRows.filter((r) => r.kind === "purchase" && r.amount > 0).length;
    const adRewardClaimCount = bloxRows.filter((r) => r.kind === "ad_reward").length;

    const activeSubs = (subs.data ?? []).filter((s) => ["active", "trialing"].includes(s.status));
    const estimatedMrr = Math.round(activeSubs.length * 4.99 * 100) / 100;

    return {
      overview: {
        totalUsers,
        newUsers30: newProfiles30.data?.length ?? 0,
        totalMatches: matches.data?.length ?? 0,
        totalMessages30: messages30.data?.length ?? 0,
        totalVideos: videos.data?.length ?? 0,
        openReports: reportsOpen.count ?? 0,
        pendingDataRequests: dataRequestsOpen.count ?? 0,
        totalCommunities: communities.count ?? 0,
      },
      global: {
        signupsByDay: bucketByDay(allProfiles, 30),
        dau,
        mau,
        stickiness: mau ? Math.round((dau / mau) * 100) : 0,
      },
      monetization: {
        sparkPlusActive: sparkPlusActive.count ?? 0,
        estimatedMrr,
        bloxPurchasesByDay: bucketByDay(
          bloxRows.filter((r) => r.kind === "purchase"),
          30,
        ),
        bloxByKind,
        packPurchaseCount,
        adRewardClaimCount,
      },
      retention: {
        day1Retention,
        cohortSize: cohort.length,
        dau,
        mau,
      },
      sparks: {
        totalMatches: matches.data?.length ?? 0,
        swipes30: swipeRows.length,
        rightSwipes30: rightSwipes,
        matchRatePercent: matchRate,
        matchesByDay: bucketByDay(matches.data ?? [], 30),
      },
      messages: {
        total30: messages30.data?.length ?? 0,
        byDay: bucketByDay(messages30.data ?? [], 30),
      },
    };
  });

const contentSearchSchema = z.object({ query: z.string().max(200) });

/** Video/creator/comment search for the Content tab. Matches on caption,
 * hashtags, creator username, or comment text, and always returns enough
 * creator identity (UID, email, Roblox) that staff can act on a hit. */
export const adminSearchContent = createServerFn({ method: "GET" })
  .validator(contentSearchSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const db = await requireStaff(context.userId);
    const q = data.query.trim();

    let videoIds: string[] | null = null;
    if (q) {
      const { data: commentHits } = await db
        .from("video_comments")
        .select("video_id")
        .ilike("content", `%${q}%`)
        .limit(200);
      videoIds = [...new Set((commentHits ?? []).map((c) => c.video_id))];
    }

    let query = db
      .from("videos")
      .select(
        "id,user_id,storage_path,caption,hashtags,views_count,likes_count,comments_count,visibility,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (q) {
      const orParts = [`caption.ilike.${pgIlikePattern(q)}`, `hashtags.cs.{${pgQuote(q)}}`];
      if (videoIds?.length) orParts.push(`id.in.(${videoIds.join(",")})`);
      query = query.or(orParts.join(","));
    }
    const { data: videos, error } = await query;
    if (error) throw error;

    const creatorIds = [...new Set((videos ?? []).map((v) => v.user_id))];
    let creatorRows: { id: string; username: string | null; roblox_username: string | null }[] = [];
    if (q && creatorIds.length === 0) {
      const { data: byCreator } = await db
        .from("profiles")
        .select("id,username,roblox_username")
        .or(`username.ilike.${pgIlikePattern(q)},roblox_username.ilike.${pgIlikePattern(q)}`)
        .limit(20);
      creatorRows = byCreator ?? [];
    }

    const allCreatorIds = [...new Set([...creatorIds, ...creatorRows.map((c) => c.id)])];
    const { data: profiles } = allCreatorIds.length
      ? await db.from("profiles").select("id,username,roblox_username").in("id", allCreatorIds)
      : { data: [] };
    const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 500 });
    const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? null]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    let extraVideos: typeof videos = [];
    if (q && creatorRows.length) {
      const { data: byCreatorVideos } = await db
        .from("videos")
        .select(
          "id,user_id,storage_path,caption,hashtags,views_count,likes_count,comments_count,visibility,created_at",
        )
        .in(
          "user_id",
          creatorRows.map((c) => c.id),
        )
        .order("created_at", { ascending: false })
        .limit(60);
      extraVideos = byCreatorVideos ?? [];
    }

    const merged = [...(videos ?? []), ...extraVideos].filter(
      (v, i, all) => all.findIndex((x) => x.id === v.id) === i,
    );

    return merged.map((v) => {
      const p = profileById.get(v.user_id);
      return {
        ...v,
        creatorUsername: p?.username ?? null,
        creatorRobloxUsername: p?.roblox_username ?? null,
        creatorEmail: emailById.get(v.user_id) ?? null,
      };
    });
  });

/** Blox economy + subscription ledger for the Billing tab. */
export const adminBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireStaff(context.userId);
    const [tx, subs, balances] = await Promise.all([
      db
        .from("blox_transactions")
        .select("id,user_id,amount,kind,reference_id,description,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("subscriptions")
        .select(
          "id,user_id,status,price_id,current_period_start,current_period_end,cancel_at_period_end,environment",
        )
        .order("current_period_start", { ascending: false })
        .limit(200),
      db.from("profiles").select("blox_balance"),
    ]);
    for (const r of [tx, subs, balances]) if (r.error) throw r.error;

    const userIds = [
      ...new Set([
        ...(tx.data ?? []).map((t) => t.user_id),
        ...(subs.data ?? []).map((s) => s.user_id),
      ]),
    ];
    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id,username").in("id", userIds)
      : { data: [] };
    const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    const totalBloxInCirculation = (balances.data ?? []).reduce(
      (sum, p) => sum + (p.blox_balance ?? 0),
      0,
    );
    const totalPurchased = (tx.data ?? [])
      .filter((t) => t.kind === "purchase" && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpentOnBadges = (tx.data ?? [])
      .filter((t) => t.kind === "badge_purchase")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalQuestRewards = (tx.data ?? [])
      .filter((t) => t.kind === "quest_reward")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      transactions: (tx.data ?? []).map((t) => ({
        ...t,
        username: usernameById.get(t.user_id) ?? null,
      })),
      subscriptions: (subs.data ?? []).map((s) => ({
        ...s,
        username: usernameById.get(s.user_id) ?? null,
      })),
      economy: { totalBloxInCirculation, totalPurchased, totalSpentOnBadges, totalQuestRewards },
    };
  });

/** Every conversation that triggered a banned-word safety alert, with the
 * offending message located and its context (10 messages before it, every
 * message after) so a moderator can see the whole exchange before acting. */
export const adminSuspiciousActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireStaff(context.userId);
    const [{ data: alerts, error: alertError }, { data: words, error: wordsError }] =
      await Promise.all([
        db
          .from("notifications")
          .select("conversation_id,created_at")
          .eq("body", "safety_alert")
          .order("created_at", { ascending: false })
          .limit(60),
        db.from("banned_words").select("word"),
      ]);
    if (alertError) throw alertError;
    if (wordsError) throw wordsError;

    const wordRegexes = (words ?? []).map((w) => new RegExp(`\\b${w.word}\\b`, "i"));
    const conversationIds = [
      ...new Set((alerts ?? []).map((a) => a.conversation_id).filter((id): id is string => !!id)),
    ].slice(0, 20);

    const results = [];
    for (const conversationId of conversationIds) {
      const { data: msgs } = await db
        .from("messages")
        .select("id,sender_id,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);
      const rows = msgs ?? [];
      const hitIndex = rows.findIndex(
        (m) => m.content && wordRegexes.some((re) => re.test(m.content!)),
      );
      const flagged = hitIndex === -1 ? undefined : rows[hitIndex];
      if (!flagged) continue;
      const start = Math.max(0, hitIndex - 10);
      const context_ = rows.slice(start, hitIndex);
      const after = rows.slice(hitIndex + 1);

      const senderIds = [
        ...new Set([
          flagged.sender_id,
          ...context_.map((m) => m.sender_id),
          ...after.map((m) => m.sender_id),
        ]),
      ];
      const { data: people } = await db.from("profiles").select("id,username").in("id", senderIds);
      const usernameById = new Map((people ?? []).map((p) => [p.id, p.username]));

      results.push({
        conversationId,
        flaggedAt: flagged.created_at,
        flaggedMessage: { ...flagged, username: usernameById.get(flagged.sender_id) ?? null },
        senderId: flagged.sender_id,
        senderUsername: usernameById.get(flagged.sender_id) ?? null,
        before: context_.map((m) => ({ ...m, username: usernameById.get(m.sender_id) ?? null })),
        after: after
          .slice(0, 50)
          .map((m) => ({ ...m, username: usernameById.get(m.sender_id) ?? null })),
      });
    }
    return results;
  });
