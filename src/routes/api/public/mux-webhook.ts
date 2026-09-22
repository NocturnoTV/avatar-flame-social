import { createFileRoute } from "@tanstack/react-router";

/**
 * Public webhook receiver for Mux Video events, covering both Feed video
 * attachments (post_videos) and Discover videos (videos.mux_* columns). No
 * Supabase/Lovable JWT check - Mux calls this directly, server to server,
 * and authenticates itself via the mux-signature header instead. Idempotent
 * via mux_webhook_events (keyed on Mux's own event id), and never regresses
 * a "ready" video or overwrites a valid playback id, since Mux can deliver
 * webhooks late or out of order.
 */

const MAX_SIGNATURE_AGE_SECONDS = 300;
const GENERIC_UPLOAD_ERROR = "The video upload failed.";
const GENERIC_ASSET_ERROR = "The video could not be processed.";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyMuxSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");

  return v1Signatures.some((sig) => timingSafeEqual(sig, expected));
}

type MuxPlaybackId = { id: string; policy: string };
type MuxEvent = {
  id: string;
  type: string;
  data: {
    id?: string;
    asset_id?: string;
    passthrough?: string;
    duration?: number;
    aspect_ratio?: string;
    playback_ids?: MuxPlaybackId[];
  };
};

/** A resolved row to update - either a Feed video attachment (post_videos,
 * status/error_message) or a Discover video (videos, mux_status/
 * mux_error_message columns on the shared table, no aspect_ratio column
 * there since Discover is always vertical). */
type VideoTarget =
  | { table: "post_videos"; id: string; currentStatus: string | null }
  | { table: "videos"; id: string; currentStatus: string | null };

function parsePassthrough(passthrough: string | undefined): { table: VideoTarget["table"]; id: string } | null {
  if (!passthrough) return null;
  const sep = passthrough.indexOf(":");
  if (sep < 0) return null;
  const prefix = passthrough.slice(0, sep);
  const id = passthrough.slice(sep + 1);
  if (!id) return null;
  if (prefix === "feed") return { table: "post_videos", id };
  if (prefix === "discover") return { table: "videos", id };
  return null;
}

async function findTargetByUploadId(supabaseAdmin: any, uploadId: string): Promise<VideoTarget | null> {
  const { data: feedRow } = await supabaseAdmin
    .from("post_videos")
    .select("id,status")
    .eq("mux_upload_id", uploadId)
    .maybeSingle();
  if (feedRow) return { table: "post_videos", id: feedRow.id, currentStatus: feedRow.status };

  const { data: discoverRow } = await supabaseAdmin
    .from("videos")
    .select("id,mux_status")
    .eq("mux_upload_id", uploadId)
    .maybeSingle();
  if (discoverRow) return { table: "videos", id: discoverRow.id, currentStatus: discoverRow.mux_status };

  return null;
}

async function findTargetForAsset(supabaseAdmin: any, data: MuxEvent["data"]): Promise<VideoTarget | null> {
  const fromPassthrough = parsePassthrough(data.passthrough);
  if (fromPassthrough) {
    const statusColumn = fromPassthrough.table === "post_videos" ? "status" : "mux_status";
    const { data: row } = await supabaseAdmin
      .from(fromPassthrough.table)
      .select(`id,${statusColumn}`)
      .eq("id", fromPassthrough.id)
      .maybeSingle();
    if (row) return { table: fromPassthrough.table, id: row.id, currentStatus: row[statusColumn] } as VideoTarget;
  }
  if (data.id) {
    const { data: feedRow } = await supabaseAdmin
      .from("post_videos")
      .select("id,status")
      .eq("mux_asset_id", data.id)
      .maybeSingle();
    if (feedRow) return { table: "post_videos", id: feedRow.id, currentStatus: feedRow.status };

    const { data: discoverRow } = await supabaseAdmin
      .from("videos")
      .select("id,mux_status")
      .eq("mux_asset_id", data.id)
      .maybeSingle();
    if (discoverRow) return { table: "videos", id: discoverRow.id, currentStatus: discoverRow.mux_status };
  }
  return null;
}

function statusUpdate(target: VideoTarget, value: Record<string, unknown>): Record<string, unknown> {
  if (target.table === "post_videos") {
    const { status, error_message, ...rest } = value as {
      status?: unknown;
      error_message?: unknown;
      [key: string]: unknown;
    };
    return { ...rest, ...(status !== undefined ? { status } : {}), ...(error_message !== undefined ? { error_message } : {}) };
  }
  const { status, error_message, ...rest } = value as {
    status?: unknown;
    error_message?: unknown;
    [key: string]: unknown;
  };
  return {
    ...rest,
    ...(status !== undefined ? { mux_status: status } : {}),
    ...(error_message !== undefined ? { mux_error_message: error_message } : {}),
  };
}

async function handleUploadAssetCreated(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (!data.id || !data.asset_id) return;
  const target = await findTargetByUploadId(supabaseAdmin, data.id);
  if (!target) return;
  await supabaseAdmin
    .from(target.table)
    .update(
      statusUpdate(target, {
        mux_asset_id: data.asset_id,
        // Never regress an already-ready video back to processing -
        // webhooks can arrive out of order.
        ...(target.currentStatus === "ready" ? {} : { status: "processing" }),
      }),
    )
    .eq("id", target.id);
}

async function handleUploadErrored(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (!data.id) return;
  const target = await findTargetByUploadId(supabaseAdmin, data.id);
  if (!target || target.currentStatus === "ready") return;
  await supabaseAdmin
    .from(target.table)
    .update(statusUpdate(target, { status: "failed", error_message: GENERIC_UPLOAD_ERROR }))
    .eq("id", target.id);
}

async function handleUploadCancelled(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (!data.id) return;
  const target = await findTargetByUploadId(supabaseAdmin, data.id);
  if (!target || target.currentStatus === "ready") return;
  await supabaseAdmin
    .from(target.table)
    .update(statusUpdate(target, { status: "failed", error_message: GENERIC_UPLOAD_ERROR }))
    .eq("id", target.id);
}

async function handleAssetReady(supabaseAdmin: any, data: MuxEvent["data"]) {
  const target = await findTargetForAsset(supabaseAdmin, data);
  if (!target) return;

  const publicPlaybackId = data.playback_ids?.find((p) => p.policy === "public")?.id;

  const update: Record<string, unknown> = { status: "ready", error_message: null };
  if (data.id) update["mux_asset_id"] = data.id;
  if (typeof data.duration === "number") update["duration_seconds"] = data.duration;
  if (data.aspect_ratio && target.table === "post_videos") update["aspect_ratio"] = data.aspect_ratio;
  // Only ever set a playback id we actually found - never overwrite an
  // existing valid one with null.
  if (publicPlaybackId) update["mux_playback_id"] = publicPlaybackId;

  await supabaseAdmin.from(target.table).update(statusUpdate(target, update)).eq("id", target.id);
}

async function handleAssetErrored(supabaseAdmin: any, data: MuxEvent["data"]) {
  const target = await findTargetForAsset(supabaseAdmin, data);
  if (!target) return;
  await supabaseAdmin
    .from(target.table)
    .update(statusUpdate(target, { status: "failed", error_message: GENERIC_ASSET_ERROR }))
    .eq("id", target.id);
}

async function handleAssetDeleted(supabaseAdmin: any, data: MuxEvent["data"]) {
  const target = await findTargetForAsset(supabaseAdmin, data);
  if (!target) return;
  await supabaseAdmin
    .from(target.table)
    .update(statusUpdate(target, { status: "deleted", mux_playback_id: null }))
    .eq("id", target.id);
}

async function processEvent(supabaseAdmin: any, event: MuxEvent) {
  switch (event.type) {
    case "video.upload.asset_created":
      return handleUploadAssetCreated(supabaseAdmin, event.data);
    case "video.upload.errored":
      return handleUploadErrored(supabaseAdmin, event.data);
    case "video.upload.cancelled":
      return handleUploadCancelled(supabaseAdmin, event.data);
    case "video.asset.ready":
      return handleAssetReady(supabaseAdmin, event.data);
    case "video.asset.errored":
      return handleAssetErrored(supabaseAdmin, event.data);
    case "video.asset.deleted":
      return handleAssetDeleted(supabaseAdmin, event.data);
    default:
      // Unrecognized event type - already recorded in mux_webhook_events by
      // the caller for idempotency/audit purposes; nothing else to do.
      return;
  }
}

export const Route = createFileRoute("/api/public/mux-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["MUX_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("MUX_WEBHOOK_SECRET is not configured");
          return Response.json({ error: "webhook_not_configured" }, { status: 500 });
        }

        const signatureHeader = request.headers.get("mux-signature");
        const rawBody = await request.text();

        const valid = await verifyMuxSignature(rawBody, signatureHeader, secret);
        if (!valid) {
          return Response.json({ error: "invalid_signature" }, { status: 401 });
        }

        let event: MuxEvent;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        if (!event.id || !event.type) {
          return Response.json({ error: "invalid_event" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: record the event id first. A unique-constraint
        // conflict means we've already processed it - ack without
        // reprocessing rather than erroring, since Mux retries on non-2xx.
        const objectId = event.data?.id ?? event.data?.passthrough ?? null;
        const { error: insertError } = await supabaseAdmin.from("mux_webhook_events").insert({
          mux_event_id: event.id,
          event_type: event.type,
          object_id: objectId,
          payload: event,
        });
        if (insertError) {
          if (insertError.code === "23505") {
            return Response.json({ received: true, duplicate: true });
          }
          console.error("mux_webhook_events insert failed:", insertError.message);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }

        try {
          await processEvent(supabaseAdmin, event);
        } catch (err) {
          console.error("Mux webhook processing failed:", event.type, err instanceof Error ? err.message : err);
          // Already recorded for idempotency - still ack so Mux doesn't
          // retry a permanently-failing event forever.
        }

        return Response.json({ received: true });
      },
    },
  },
});
