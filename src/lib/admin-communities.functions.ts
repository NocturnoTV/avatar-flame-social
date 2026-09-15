import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Same staff check as admin.functions.ts's requireStaff, but communities
 * moderation (verify/restrict visibility/delete) is left to moderators too,
 * not admin-only - matching the rest of the moderation tools. */
async function requireStaff(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  const roles = (data ?? []).map((row) => row.role);
  if (!roles.some((role) => role === "admin" || role === "moderator")) {
    throw new Error("forbidden");
  }
  return { supabaseAdmin };
}

export type AdminCommunityRow = {
  id: string;
  handle: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  member_count: number;
  visibility: string;
  verified: boolean;
  owner_id: string;
  owner_username: string | null;
  created_at: string;
};

export const adminListCommunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCommunityRow[]> => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { data, error } = await db
      .from("communities")
      .select(
        "id,handle,name,icon_url,banner_url,member_count,visibility,verified,owner_id,created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const ownerIds = [...new Set(rows.map((c) => c.owner_id))];
    const { data: owners } = ownerIds.length
      ? await db.from("profiles").select("id,username").in("id", ownerIds)
      : { data: [] as { id: string; username: string | null }[] };
    const ownerById = new Map((owners ?? []).map((o) => [o.id, o.username]));
    return rows.map((c) => ({
      ...c,
      owner_username: ownerById.get(c.owner_id) ?? null,
    }));
  });

const communityActionSchema = z.object({
  action: z.enum(["verify", "unverify", "set_visibility", "delete"]),
  communityId: z.string().uuid(),
  visibility: z.enum(["public", "private_request", "private_friends"]).optional(),
});

export const adminManageCommunity = createServerFn({ method: "POST" })
  .validator(communityActionSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);

    if (data.action === "verify") {
      await db.from("communities").update({ verified: true }).eq("id", data.communityId);
    }
    if (data.action === "unverify") {
      await db.from("communities").update({ verified: false }).eq("id", data.communityId);
    }
    if (data.action === "set_visibility") {
      if (!data.visibility) throw new Error("visibility_required");
      await db
        .from("communities")
        .update({ visibility: data.visibility })
        .eq("id", data.communityId);
    }
    if (data.action === "delete") {
      const { error } = await db.from("communities").delete().eq("id", data.communityId);
      if (error) throw error;
    }

    await db.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: `community_${data.action}`,
      target_id: data.communityId,
      details: data.visibility ?? null,
    });

    return { ok: true };
  });
