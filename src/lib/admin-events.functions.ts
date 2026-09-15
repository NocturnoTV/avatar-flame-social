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
    const { data: events, error } = await db
      .from("events")
      .select(
        "id,kind,title,description,banner_url,prize,organizer_name,location_type,location,starts_at,ends_at,created_at,winner_id",
      )
      .order("starts_at", { ascending: false });
    if (error) throw error;
    const winnerIds = [
      ...new Set((events ?? []).map((e) => e.winner_id).filter(Boolean)),
    ] as string[];
    const { data: winners } = winnerIds.length
      ? await db.from("profiles").select("id,username").in("id", winnerIds)
      : { data: [] as { id: string; username: string | null }[] };
    const winnerById = new Map((winners ?? []).map((w) => [w.id, w.username]));
    return (events ?? []).map((e) => ({
      ...e,
      winner_username: e.winner_id ? (winnerById.get(e.winner_id) ?? null) : null,
    }));
  });

export const adminListEventParticipants = createServerFn({ method: "GET" })
  .validator(z.object({ eventId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { data: rows, error } = await db
      .from("event_participants")
      .select("user_id,joined_at")
      .eq("event_id", data.eventId)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id,username,avatar_url").in("id", ids)
      : { data: [] as { id: string; username: string | null; avatar_url: string | null }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({
      user_id: r.user_id,
      joined_at: r.joined_at,
      profile: byId.get(r.user_id) ?? null,
    }));
  });

export const adminSetEventWinner = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: z.string().uuid(), userId: z.string().uuid().nullable() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await requireStaff(context.userId);
    const { data: event, error } = await db
      .from("events")
      .update({ winner_id: data.userId })
      .eq("id", data.eventId)
      .select("title")
      .single();
    if (error) throw error;
    if (data.userId) {
      // Congratulate the winner via Team Spark - same marker pattern as
      // every other Team Spark message, rendered live in their language.
      await db.from("notifications").insert({
        user_id: data.userId,
        kind: "system",
        body: `giveaway_won:${event?.title ?? ""}`,
      });
    }
    return { ok: true };
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
