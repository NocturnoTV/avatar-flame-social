import { createFileRoute } from "@tanstack/react-router";

/**
 * Public webhook receiver for Mux Video events. No Supabase/Lovable JWT
 * check - Mux calls this directly, server to server, and authenticates
 * itself via the mux-signature header instead. Idempotent via
 * mux_webhook_events (keyed on Mux's own event id), and never regresses a
 * "ready" video or overwrites a valid playback id, since Mux can deliver
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

async function handleUploadAssetCreated(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (!data.id || !data.asset_id) return;
  const { data: row } = await supabaseAdmin
    .from("post_videos")
    .select("id,status")
    .eq("mux_upload_id", data.id)
    .maybeSingle();
  if (!row) return;
  await supabaseAdmin
    .from("post_videos")
    .update({
      mux_asset_id: data.asset_id,
      // Never regress an already-ready video back to processing - webhooks
      // can arrive out of order.
      ...(row.status === "ready" ? {} : { status: "processing" }),
    })
    .eq("id", row.id);
}

async function handleUploadErrored(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (!data.id) return;
  await supabaseAdmin
    .from("post_videos")
    .update({ status: "failed", error_message: GENERIC_UPLOAD_ERROR })
    .eq("mux_upload_id", data.id)
    .neq("status", "ready");
}

async function handleUploadCancelled(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (!data.id) return;
  await supabaseAdmin
    .from("post_videos")
    .update({ status: "failed", error_message: GENERIC_UPLOAD_ERROR })
    .eq("mux_upload_id", data.id)
    .neq("status", "ready");
}

async function findVideoRowForAsset(supabaseAdmin: any, data: MuxEvent["data"]) {
  if (data.passthrough) {
    const { data: byPassthrough } = await supabaseAdmin
      .from("post_videos")
      .select("id,status,mux_playback_id")
      .eq("id", data.passthrough)
      .maybeSingle();
    if (byPassthrough) return byPassthrough;
  }
  if (data.id) {
    const { data: byAssetId } = await supabaseAdmin
      .from("post_videos")
      .select("id,status,mux_playback_id")
      .eq("mux_asset_id", data.id)
      .maybeSingle();
    if (byAssetId) return byAssetId;
  }
  return null;
}

async function handleAssetReady(supabaseAdmin: any, data: MuxEvent["data"]) {
  const row = await findVideoRowForAsset(supabaseAdmin, data);
  if (!row) return;

  const publicPlaybackId = data.playback_ids?.find((p) => p.policy === "public")?.id;

  const update: Record<string, unknown> = {
    status: "ready",
    error_message: null,
  };
  if (data.id) update["mux_asset_id"] = data.id;
  if (typeof data.duration === "number") update["duration_seconds"] = data.duration;
  if (data.aspect_ratio) update["aspect_ratio"] = data.aspect_ratio;
  // Only ever set a playback id we actually found - never overwrite an
  // existing valid one with null.
  if (publicPlaybackId) update["mux_playback_id"] = publicPlaybackId;

  await supabaseAdmin.from("post_videos").update(update).eq("id", row.id);
}

async function handleAssetErrored(supabaseAdmin: any, data: MuxEvent["data"]) {
  const row = await findVideoRowForAsset(supabaseAdmin, data);
  if (!row) return;
  await supabaseAdmin
    .from("post_videos")
    .update({ status: "failed", error_message: GENERIC_ASSET_ERROR })
    .eq("id", row.id);
}

async function handleAssetDeleted(supabaseAdmin: any, data: MuxEvent["data"]) {
  const row = await findVideoRowForAsset(supabaseAdmin, data);
  if (!row) return;
  await supabaseAdmin
    .from("post_videos")
    .update({ status: "deleted", mux_playback_id: null })
    .eq("id", row.id);
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
