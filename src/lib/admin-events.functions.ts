import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Same staff check as the other admin.functions.ts helpers. */
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

export const adminListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { data, error } = await db
      .from("events")
      .select(
        "id,kind,title,description,banner_url,prize,organizer_name,location_type,location,starts_at,ends_at,created_at",
      )
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const eventSchema = z.object({
  kind: z.enum(["event", "giveaway"]),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  bannerUrl: z.string().max(2000).optional(),
  prize: z.string().max(200).optional(),
  organizerName: z.string().max(120).optional(),
  locationType: z.enum(["online", "in_person"]),
  location: z.string().max(200).optional(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const adminCreateEvent = createServerFn({ method: "POST" })
  .validator(eventSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { error } = await db.from("events").insert({
      kind: data.kind,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      banner_url: data.bannerUrl?.trim() || null,
      prize: data.prize?.trim() || null,
      organizer_name: data.organizerName?.trim() || null,
      location_type: data.locationType,
      location: data.location?.trim() || null,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const adminUpdateEvent = createServerFn({ method: "POST" })
  .validator(eventSchema.extend({ id: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { error } = await db
      .from("events")
      .update({
        kind: data.kind,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        banner_url: data.bannerUrl?.trim() || null,
        prize: data.prize?.trim() || null,
        organizer_name: data.organizerName?.trim() || null,
        location_type: data.locationType,
        location: data.location?.trim() || null,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteEvent = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { error } = await db.from("events").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
