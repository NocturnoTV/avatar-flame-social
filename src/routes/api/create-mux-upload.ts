import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Mints a Mux direct-upload URL for either a Feed post's video attachment
 * (post_videos) or a Discover video (videos.mux_* columns). Authenticated
 * (verifies the caller's Supabase JWT itself, the same way
 * requireSupabaseAuth does for createServerFn's), since this needs to be a
 * plain HTTP endpoint - the eventual upload widget POSTs bytes straight to
 * the Mux URL this returns, never through our own server.
 */

const PROD_ORIGIN = "https://bloxspark.app";
// Same preview-zone list previewAuthStorage.ts uses for Lovable preview
// surfaces - reused rather than re-guessed here.
const PREVIEW_ZONES = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "lovable.app",
  "gpt-eng.com",
  "gptengineer.run",
];
const MAX_FILE_SIZE = 250 * 1024 * 1024;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === PROD_ORIGIN) return true;
  try {
    const host = new URL(origin).hostname;
    return PREVIEW_ZONES.some((zone) => host === zone || host.endsWith("." + zone));
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : PROD_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

/** Same JWT verification recipe as requireSupabaseAuth (auth-middleware.ts),
 * done by hand here since this route is a raw HTTP endpoint, not a
 * createServerFn the middleware can wrap. */
async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token || token.split(".").length !== 3) return null;

  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

export const Route = createFileRoute("/api/create-mux-upload")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) }),

      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = corsHeaders(origin);

        const userId = await getAuthenticatedUserId(request);
        if (!userId) {
          return Response.json({ error: "unauthorized" }, { status: 401, headers });
        }

        let body: {
          fileName?: unknown;
          fileSize?: unknown;
          mimeType?: unknown;
          postId?: unknown;
          target?: unknown;
          targetId?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers });
        }

        const fileName = typeof body.fileName === "string" ? body.fileName : null;
        const fileSize = typeof body.fileSize === "number" ? body.fileSize : null;
        const mimeType = typeof body.mimeType === "string" ? body.mimeType : null;
        const postId = typeof body.postId === "string" ? body.postId : null;
        const target = body.target === "discover" ? "discover" : "feed";
        const targetId = typeof body.targetId === "string" ? body.targetId : null;

        if (!fileName || !mimeType?.startsWith("video/")) {
          return Response.json({ error: "invalid_file_type" }, { status: 400, headers });
        }
        if (fileSize === null || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
          return Response.json({ error: "file_too_large" }, { status: 400, headers });
        }
        if (target === "discover" && !targetId) {
          return Response.json({ error: "target_id_required" }, { status: 400, headers });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let passthrough: string;
        let onMuxUploadIdKnown: (uploadId: string) => Promise<void>;
        let onMuxInitFailed: () => Promise<void>;

        if (target === "discover") {
          // The video row already exists (Discover's studio wizard creates
          // it with all its metadata up front) - never trust a foreign key
          // handed in by the client, confirm it's really this caller's row.
          const { data: videoRow } = await supabaseAdmin
            .from("videos")
            .select("id,user_id")
            .eq("id", targetId!)
            .maybeSingle();
          if (!videoRow || videoRow.user_id !== userId) {
            return Response.json({ error: "not_found" }, { status: 404, headers });
          }
          passthrough = `discover:${videoRow.id}`;
          onMuxUploadIdKnown = async (uploadId) => {
            await supabaseAdmin.from("videos").update({ mux_upload_id: uploadId }).eq("id", videoRow.id);
          };
          onMuxInitFailed = async () => {
            await supabaseAdmin
              .from("videos")
              .update({ mux_status: "failed", mux_error_message: "Could not start the video upload." })
              .eq("id", videoRow.id);
          };
        } else {
          // A postId is only honored once we've confirmed it really belongs
          // to this caller - never trust a foreign key handed in by the
          // client.
          let verifiedPostId: string | null = null;
          if (postId) {
            const { data: postRow } = await supabaseAdmin
              .from("feed_posts")
              .select("id,user_id")
              .eq("id", postId)
              .maybeSingle();
            if (postRow && postRow.user_id === userId) verifiedPostId = postRow.id;
          }

          const { data: videoRow, error: insertError } = await supabaseAdmin
            .from("post_videos")
            .insert({ user_id: userId, post_id: verifiedPostId, status: "uploading" })
            .select("id")
            .single();
          if (insertError || !videoRow) {
            console.error("post_videos insert failed:", insertError?.message);
            return Response.json({ error: "internal_error" }, { status: 500, headers });
          }
          passthrough = `feed:${videoRow.id}`;
          onMuxUploadIdKnown = async (uploadId) => {
            await supabaseAdmin.from("post_videos").update({ mux_upload_id: uploadId }).eq("id", videoRow.id);
          };
          onMuxInitFailed = async () => {
            await supabaseAdmin
              .from("post_videos")
              .update({ status: "failed", error_message: "Could not start the video upload." })
              .eq("id", videoRow.id);
          };
        }

        const MUX_TOKEN_ID = process.env["MUX_TOKEN_ID"];
        const MUX_TOKEN_SECRET = process.env["MUX_TOKEN_SECRET"];
        if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
          console.error("Mux credentials are not configured");
          await onMuxInitFailed();
          return Response.json({ error: "internal_error" }, { status: 500, headers });
        }

        const corsOrigin = isAllowedOrigin(origin) && origin ? origin : PROD_ORIGIN;
        const basicAuth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString("base64");

        try {
          const muxResponse = await fetch("https://api.mux.com/video/v1/uploads", {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cors_origin: corsOrigin,
              new_asset_settings: {
                playback_policies: ["public"],
                video_quality: "basic",
                passthrough,
              },
            }),
          });

          if (!muxResponse.ok) {
            console.error("Mux upload creation failed:", muxResponse.status);
            await onMuxInitFailed();
            return Response.json({ error: "mux_error" }, { status: 502, headers });
          }

          const muxData = (await muxResponse.json()) as { data: { id: string; url: string } };
          await onMuxUploadIdKnown(muxData.data.id);

          return Response.json(
            { videoId: targetId ?? passthrough.split(":")[1], uploadId: muxData.data.id, uploadUrl: muxData.data.url },
            { headers },
          );
        } catch (err) {
          console.error("Mux upload creation threw:", err instanceof Error ? err.message : err);
          await onMuxInitFailed();
          return Response.json({ error: "internal_error" }, { status: 500, headers });
        }
      },
    },
  },
});
