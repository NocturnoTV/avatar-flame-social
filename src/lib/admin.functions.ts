import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireStaff(userId: string, adminOnly = false) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((row) => row.role);
  if (
    adminOnly
      ? !roles.includes("admin")
      : !roles.some((role) => role === "admin" || role === "moderator")
  ) {
    throw new Error("forbidden");
  }
  return { supabaseAdmin, roles };
}

export const adminListMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, roles: callerRoles } = await requireStaff(context.userId);
    const canManageCredentials = callerRoles.includes("admin");
    const [{ data: authPage, error: authError }, profilesResult, { data: roles }, { data: creatorRows }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
        (supabaseAdmin as any)
          .from("profiles")
          .select(
            "id,username,avatar_url,roblox_username,roblox_display_name,language,verified,onboarding_completed,created_at,last_active_at,spark_plus_active,spark_plus_expires_at,age,blox_balance,profiles_private(birth_date,parent_name,parent_email,parental_consent,moderation_status,warning_count,banned_until,moderation_note)",
          )
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("user_roles").select("user_id,role"),
        supabaseAdmin.from("videos").select("user_id"),
      ]);
    const creatorIds = new Set((creatorRows ?? []).map((v) => v.user_id));
    const profiles = profilesResult.data as Array<Record<string, unknown>> | null;
    const profileError = profilesResult.error;
    if (authError) throw authError;
    if (profileError) throw profileError;

    const authById = new Map((authPage?.users ?? []).map((user) => [user.id, user]));
    const rolesById = new Map<string, string[]>();
    for (const row of roles ?? []) {
      const list = rolesById.get(row.user_id) ?? [];
      list.push(row.role);
      rolesById.set(row.user_id, list);
    }

    return (profiles ?? []).map((profile) => {
      const auth = authById.get(String(profile["id"]));
      const rawPriv = profile["profiles_private"];
      const priv = (Array.isArray(rawPriv) ? rawPriv[0] : rawPriv) as
        Record<string, unknown> | null | undefined;
      return {
        id: String(profile["id"]),
        username: (profile["username"] as string | null) ?? null,
        avatar_url: (profile["avatar_url"] as string | null) ?? null,
        roblox_username: (profile["roblox_username"] as string | null) ?? null,
        roblox_display_name: (profile["roblox_display_name"] as string | null) ?? null,
        language: String(profile["language"] ?? "en"),
        verified: Boolean(profile["verified"]),
        onboarding_completed: Boolean(profile["onboarding_completed"]),
        created_at: String(profile["created_at"] ?? ""),
        last_active_at: (profile["last_active_at"] as string | null) ?? null,
        moderation_status: String(priv?.["moderation_status"] ?? "active"),
        warning_count: Number(priv?.["warning_count"] ?? 0),
        moderation_note: (priv?.["moderation_note"] as string | null) ?? null,
        email: canManageCredentials ? (auth?.email ?? null) : null,
        emailConfirmedAt: auth?.email_confirmed_at ?? null,
        lastSignInAt: auth?.last_sign_in_at ?? null,
        bannedUntil: auth?.banned_until ?? (priv?.["banned_until"] as string | null) ?? null,
        roles: rolesById.get(String(profile["id"])) ?? [],
        sparkPlusActive: Boolean(profile["spark_plus_active"]),
        sparkPlusExpiresAt: (profile["spark_plus_expires_at"] as string | null) ?? null,
        birthDate: (priv?.["birth_date"] as string | null) ?? null,
        parentName: canManageCredentials
          ? ((priv?.["parent_name"] as string | null) ?? null)
          : null,
        parentEmail: canManageCredentials
          ? ((priv?.["parent_email"] as string | null) ?? null)
          : null,
        parentalConsent: Boolean(priv?.["parental_consent"]),
        bloxBalance: Number(profile["blox_balance"] ?? 0),
        isCreator: creatorIds.has(String(profile["id"])),
      };
    });
  });

const detailSchema = z.object({ userId: z.string().uuid() });

export const adminGetMemberDetail = createServerFn({ method: "GET" })
  .validator(detailSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireStaff(context.userId);
    const [videos, messages, notifications, reports, audit, matches, sanctions, disputes, bloxTx] =
      await Promise.all([
        supabaseAdmin
          .from("videos")
          .select("id,storage_path,caption,visibility,views_count,created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("messages")
          .select("id,conversation_id,kind,content,media_url,created_at")
          .eq("sender_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("notifications")
          .select("id,kind,body,read,created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("reports")
          .select("id,reason,details,status,created_at,reporter_id,target_user_id")
          .or(`reporter_id.eq.${data.userId},target_user_id.eq.${data.userId}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("admin_audit_log")
          .select("id,action,details,created_at,admin_id")
          .eq("target_user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("matches")
          .select("id,user_a,user_b,created_at")
          .or(`user_a.eq.${data.userId},user_b.eq.${data.userId}`)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("moderation_sanctions")
          .select("id,action,reason,moderator_id,created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("moderation_disputes")
          .select("id,sanction_id,message,status,moderator_note,created_at,reviewed_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("blox_transactions")
          .select("id,amount,kind,reference_id,description,created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    for (const result of [
      videos,
      messages,
      notifications,
      reports,
      audit,
      matches,
      sanctions,
      disputes,
      bloxTx,
    ]) {
      if (result.error) throw result.error;
    }

    const matchPartnerIds = (matches.data ?? []).map((m) =>
      m.user_a === data.userId ? m.user_b : m.user_a,
    );
    const moderatorIds = (sanctions.data ?? [])
      .map((s) => s.moderator_id)
      .filter((id): id is string => !!id);
    const { data: people } =
      matchPartnerIds.length || moderatorIds.length
        ? await supabaseAdmin
            .from("profiles")
            .select("id,username")
            .in("id", [...new Set([...matchPartnerIds, ...moderatorIds])])
        : { data: [] as { id: string; username: string | null }[] };
    const usernameById = new Map((people ?? []).map((p) => [p.id, p.username]));

    return {
      videos: videos.data ?? [],
      messages: messages.data ?? [],
      notifications: notifications.data ?? [],
      reports: reports.data ?? [],
      audit: audit.data ?? [],
      matches: (matches.data ?? []).map((m) => ({
        id: m.id,
        created_at: m.created_at,
        partnerUsername: usernameById.get(m.user_a === data.userId ? m.user_b : m.user_a) ?? null,
      })),
      sanctions: (sanctions.data ?? []).map((s) => ({
        ...s,
        moderatorUsername: s.moderator_id ? (usernameById.get(s.moderator_id) ?? null) : null,
      })),
      disputes: disputes.data ?? [],
      bloxTransactions: bloxTx.data ?? [],
    };
  });

/** Signs the admin in as another user, for support/debugging. Uses a
 * Supabase-generated magic link rather than exposing any credential - the
 * admin's own session is untouched until they actually open the link. Every
 * call is written to admin_audit_log; only admins (not moderators) may do
 * this, and only against a non-admin target. */
export const adminImpersonate = createServerFn({ method: "POST" })
  .validator(detailSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireStaff(context.userId, true);
    if (data.userId === context.userId) throw new Error("cannot_impersonate_self");

    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((targetRoles ?? []).some((r) => r.role === "admin")) {
      throw new Error("cannot_impersonate_admin");
    }

    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (userError || !authUser.user.email) throw userError ?? new Error("no_email_on_account");

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    });
    if (linkError || !link.properties?.action_link) {
      throw linkError ?? new Error("could_not_create_session_link");
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: "impersonate",
      target_user_id: data.userId,
      details: "Generated a sign-in link to take control of this account",
    });

    return { url: link.properties.action_link };
  });

const actionSchema = z.object({
  action: z.enum([
    "warn",
    "notify",
    "ban",
    "unban",
    "update_email",
    "update_password",
    "hide_video",
    "restore_video",
    "delete_video",
    "approve_video",
    "reject_video",
    "delete_post",
    "grant_spark_plus",
    "revoke_spark_plus",
    "grant_blox",
  ]),
  userId: z.string().uuid(),
  value: z.string().max(500).optional(),
  targetId: z.string().uuid().optional(),
});

export const adminManageMember = createServerFn({ method: "POST" })
  .validator(actionSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const adminOnly = [
      "ban",
      "unban",
      "update_email",
      "update_password",
      "grant_spark_plus",
      "revoke_spark_plus",
      "grant_blox",
    ].includes(data.action);
    const { supabaseAdmin } = await requireStaff(context.userId, adminOnly);
    if (data.userId === context.userId && data.action === "ban") throw new Error("cannot_ban_self");

    const db = supabaseAdmin as any;
    const value = data.value?.trim() ?? "";
    let details = value || data.targetId || null;

    if (data.action === "warn") {
      if (!value) throw new Error("warning_required");
      const { data: profile } = await db
        .from("profiles_private")
        .select("warning_count")
        .eq("user_id", data.userId)
        .maybeSingle();
      await db
        .from("profiles_private")
        .upsert(
          {
            user_id: data.userId,
            moderation_status: "warned",
            warning_count: Number(profile?.warning_count ?? 0) + 1,
            moderation_note: value,
          },
          { onConflict: "user_id" },
        );
      await db.from("moderation_sanctions").insert({
        user_id: data.userId,
        action: "warn",
        reason: value,
        moderator_id: context.userId,
      });
      // Rendered client-side via a detailed, translated template (see
      // notifModerationWarning in i18n.tsx) rather than baking English text
      // in here - same marker pattern as every other Team Spark message.
      await db.from("notifications").insert({
        user_id: data.userId,
        kind: "system",
        body: `moderation_warning:${encodeURIComponent(value)}`,
      });
    }

    if (data.action === "notify") {
      if (!value) throw new Error("notification_required");
      await db.from("notifications").insert({ user_id: data.userId, kind: "system", body: value });
    }

    if (data.action === "ban") {
      const duration = value || "876000h";
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: duration,
      });
      if (error) throw error;
      await db.from("profiles_private").upsert(
        {
          user_id: data.userId,
          moderation_status: "banned",
          banned_until: "9999-12-31T23:59:59Z",
          moderation_note: value || "Permanent ban",
        },
        { onConflict: "user_id" },
      );
      await db.from("moderation_sanctions").insert({
        user_id: data.userId,
        action: "ban",
        reason: value || "Permanent ban",
        moderator_id: context.userId,
      });
      details = value || "permanent";
    }

    if (data.action === "unban") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: "none",
      });
      if (error) throw error;
      await db
        .from("profiles_private")
        .update({ moderation_status: "active", banned_until: null })
        .eq("user_id", data.userId);
      await db.from("moderation_sanctions").insert({
        user_id: data.userId,
        action: "unban",
        reason: value || null,
        moderator_id: context.userId,
      });
    }

    if (data.action === "update_email") {
      const email = z.string().email().parse(value);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email,
        email_confirm: true,
      });
      if (error) throw error;
      details = "email_updated";
    }

    if (data.action === "update_password") {
      const password = z.string().min(8).max(200).parse(value);
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
      if (error) throw error;
      details = "password_reset";
    }

    if (data.action === "grant_spark_plus") {
      const duration = value || "1m";
      let expiresAt: string | null = null;
      if (duration !== "lifetime") {
        const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[duration];
        if (!months) throw new Error("invalid_duration");
        const expires = new Date();
        expires.setMonth(expires.getMonth() + months);
        expiresAt = expires.toISOString();
      }
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ spark_plus_active: true, spark_plus_expires_at: expiresAt })
        .eq("id", data.userId);
      if (error) throw error;
      details = duration;
    }

    if (data.action === "revoke_spark_plus") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ spark_plus_active: false, spark_plus_expires_at: null })
        .eq("id", data.userId);
      if (error) throw error;
    }

    if (data.action === "grant_blox") {
      const amount = z.coerce.number().int().min(1).max(1_000_000).parse(value);
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("blox_balance")
        .eq("id", data.userId)
        .single();
      if (profileError) throw profileError;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ blox_balance: Number(profile.blox_balance ?? 0) + amount })
        .eq("id", data.userId);
      if (error) throw error;
      const { error: ledgerError } = await supabaseAdmin.from("blox_transactions").insert({
        user_id: data.userId,
        amount,
        kind: "admin_grant",
        reference_id: context.userId,
        description: "Blox granted by staff",
      });
      if (ledgerError) throw ledgerError;
      await db.from("notifications").insert({
        user_id: data.userId,
        kind: "system",
        body: `The BloxSpark team gave you ${amount.toLocaleString()} Blox.`,
      });
      details = String(amount);
    }

    if (["hide_video", "restore_video", "delete_video"].includes(data.action)) {
      if (!data.targetId) throw new Error("video_required");
      if (data.action === "delete_video") {
        const { error } = await supabaseAdmin
          .from("videos")
          .delete()
          .eq("id", data.targetId)
          .eq("user_id", data.userId);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("videos")
          .update({ visibility: data.action === "hide_video" ? "private" : "public" })
          .eq("id", data.targetId)
          .eq("user_id", data.userId);
        if (error) throw error;
      }
    }

    if (data.action === "approve_video" || data.action === "reject_video") {
      if (!data.targetId) throw new Error("video_required");
      const { error } = await supabaseAdmin
        .from("videos")
        .update({ moderation_status: data.action === "approve_video" ? "approved" : "rejected" })
        .eq("id", data.targetId)
        .eq("user_id", data.userId);
      if (error) throw error;
      // Second Team Spark message: the decision on this account's first
      // video - rendered client-side in the viewer's current language, same
      // marker pattern as safety_alert / purchase_thanks.
      await supabaseAdmin.from("notifications").insert({
        user_id: data.userId,
        kind: "system",
        body: data.action === "approve_video" ? "video_approved" : "video_rejected",
        video_id: data.targetId,
      });
    }

    if (data.action === "delete_post") {
      if (!data.targetId) throw new Error("post_required");
      const { error } = await supabaseAdmin
        .from("feed_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", data.targetId)
        .eq("user_id", data.userId);
      if (error) throw error;
    }

    const { error: auditError } = await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: data.action,
      target_user_id: data.userId,
      target_id: data.targetId ?? null,
      details,
    });
    if (auditError) throw auditError;
    return { success: true };
  });

const disputeReviewSchema = z.object({
  disputeId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  moderatorNote: z.string().max(1000).optional(),
});

/** Staff decides a contestation filed from Support. Accepting also clears
 * the sanction it was filed against (back to "active") so the member isn't
 * left flagged after a warning/ban has been overturned. Either way the
 * member gets a Team Spark reply, translated live like every other one. */
export const adminReviewDispute = createServerFn({ method: "POST" })
  .validator(disputeReviewSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireStaff(context.userId);
    const { data: dispute, error } = await supabaseAdmin
      .from("moderation_disputes")
      .update({
        status: data.decision,
        moderator_id: context.userId,
        moderator_note: data.moderatorNote?.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.disputeId)
      .select("id,user_id,sanction_id")
      .single();
    if (error) throw error;

    if (data.decision === "accepted" && dispute.sanction_id) {
      const { data: sanction } = await supabaseAdmin
        .from("moderation_sanctions")
        .select("action")
        .eq("id", dispute.sanction_id)
        .maybeSingle();
      if (sanction?.action === "ban") {
        await supabaseAdmin.auth.admin.updateUserById(dispute.user_id, { ban_duration: "none" });
      }
      await (supabaseAdmin as any)
        .from("profiles_private")
        .update({ moderation_status: "active", banned_until: null })
        .eq("user_id", dispute.user_id);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: dispute.user_id,
      kind: "system",
      body: `dispute_${data.decision}`,
    });

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: `dispute_${data.decision}`,
      target_user_id: dispute.user_id,
      target_id: dispute.id,
      details: data.moderatorNote ?? null,
    });

    return { ok: true };
  });

const broadcastSchema = z.object({
  message: z.string().trim().min(1).max(500),
  audience: z.enum(["all", "spark_plus", "specific"]).default("all"),
  userIds: z.array(z.string().uuid()).max(500).optional(),
  channels: z
    .object({
      teamSpark: z.boolean().default(true),
      push: z.boolean().default(true),
      email: z.boolean().default(false),
    })
    .default({ teamSpark: true, push: true, email: false }),
});

/**
 * Sends one "system" (Team Spark) notification to a chosen audience at once
 * - admin-only, since "all" reaches the whole user base in one call. Reuses
 * the exact same notifications row shape as every individual Team Spark
 * message this session (localizeTeamSparkBody in messages.$id.tsx renders a
 * raw, non-marker body as-is when it doesn't match a known marker prefix),
 * and still goes through enforce_notification_preferences per recipient - a
 * member who opted out of "Bloxspark announcements" simply never gets a row
 * inserted for them, same as any other notification kind.
 */
export const adminBroadcastNotification = createServerFn({ method: "POST" })
  .validator(broadcastSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireStaff(context.userId, true);

    let query = supabaseAdmin.from("profiles").select("id");
    if (data.audience === "spark_plus") {
      query = query.eq("spark_plus_active", true);
    } else if (data.audience === "specific") {
      if (!data.userIds?.length) throw new Error("no_recipients_selected");
      query = query.in("id", data.userIds);
    }
    const { data: profiles, error } = await query;
    if (error) throw error;
    const recipientIds = (profiles ?? []).map((p) => p.id);

    if (data.channels.teamSpark) {
      const rows = recipientIds.map((id) => ({
        user_id: id,
        kind: "system" as const,
        body: data.message,
      }));
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: insertError } = await supabaseAdmin
          .from("notifications")
          .insert(rows.slice(i, i + CHUNK));
        if (insertError) throw insertError;
      }
    }

    const sentChannels = Object.entries(data.channels)
      .filter(([, on]) => on)
      .map(([name]) => name);
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: "broadcast_notification",
      details: `Sent to ${recipientIds.length} members (${data.audience}) via ${sentChannels.join(", ") || "no channel"}: ${data.message.slice(0, 200)}`,
    });

    if (data.channels.push) {
      const { sendPushToUsers } = await import("@/lib/push.server");
      void sendPushToUsers(recipientIds, { title: "BloxSpark", body: data.message });
    }
    if (data.channels.email) {
      const { sendEmailToUsers } = await import("@/lib/email.server");
      void sendEmailToUsers(recipientIds, { subject: "BloxSpark", body: data.message });
    }

    return { sentTo: recipientIds.length };
  });

const migrateVideosSchema = z.object({ limit: z.number().int().min(1).max(20).default(10) });

/** Backfills already-published Discover videos onto Mux, a batch at a time
 * (admin-triggered - there's no cron/background-job runner in this stack,
 * and one call per batch keeps each request well under any platform
 * timeout). Ingests directly from a signed Supabase Storage URL via Mux's
 * asset-creation endpoint (no upload step needed, unlike a fresh upload),
 * then lets the existing webhook (video.asset.ready/errored) finish the job
 * via the same "discover:<id>" passthrough used for new uploads. */
export const adminMigrateVideosToMux = createServerFn({ method: "POST" })
  .validator(migrateVideosSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireStaff(context.userId, true);

    const { count: remainingBefore } = await supabaseAdmin
      .from("videos")
      .select("id", { count: "exact", head: true })
      .not("storage_path", "is", null)
      .is("mux_status", null);

    const { data: candidates, error } = await supabaseAdmin
      .from("videos")
      .select("id,storage_path")
      .not("storage_path", "is", null)
      .is("mux_status", null)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw error;

    const MUX_TOKEN_ID = process.env["MUX_TOKEN_ID"];
    const MUX_TOKEN_SECRET = process.env["MUX_TOKEN_SECRET"];
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) throw new Error("mux_not_configured");
    const basicAuth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString("base64");

    let migrated = 0;
    const errors: { videoId: string; message: string }[] = [];

    for (const video of candidates ?? []) {
      const storagePath = video.storage_path;
      if (!storagePath) continue;
      try {
        const slash = storagePath.indexOf("/");
        const bucket = storagePath.slice(0, slash);
        const path = storagePath.slice(slash + 1);
        const { data: signed, error: signError } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
        if (signError || !signed) throw new Error(signError?.message ?? "sign_failed");

        const muxRes = await fetch("https://api.mux.com/video/v1/assets", {
          method: "POST",
          headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            input: [{ url: signed.signedUrl }],
            playback_policy: ["public"],
            video_quality: "basic",
            passthrough: `discover:${video.id}`,
          }),
        });
        if (!muxRes.ok) throw new Error(`mux_error_${muxRes.status}`);
        const muxData = (await muxRes.json()) as { data: { id: string } };

        await supabaseAdmin
          .from("videos")
          .update({ mux_asset_id: muxData.data.id, mux_status: "processing" })
          .eq("id", video.id);
        migrated++;
      } catch (err) {
        errors.push({ videoId: video.id, message: err instanceof Error ? err.message : "unknown" });
        await supabaseAdmin
          .from("videos")
          .update({ mux_status: "failed", mux_error_message: "Backfill ingestion failed." })
          .eq("id", video.id);
      }
    }

    return {
      migrated,
      attempted: candidates?.length ?? 0,
      remaining: Math.max(0, (remainingBefore ?? 0) - migrated),
      errors,
    };
  });
