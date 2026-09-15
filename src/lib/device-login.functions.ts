import { randomInt } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** 7 digits, grouped as 3-4 for readability (e.g. "482-9137") - easy to read
 * off one screen and type on another. Combined with the per-IP throttle in
 * redeemDeviceLoginCode below (3 attempts per rolling 3-second window),
 * brute-forcing the 10^7 keyspace within a code's 5-minute lifetime isn't
 * practical. */
function generateCode(): string {
  const digits = String(randomInt(0, 10_000_000)).padStart(7, "0");
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function requestIp(): string {
  const req = getRequest();
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * "Connecter un autre appareil" in Settings, and the post-signup screen on
 * the website: the already-signed-in side mints a short code the user can
 * type into the app (or another browser) to sign in as the same account
 * instantly, instead of repeating Google/Roblox sign-in there - which
 * Google in particular actively blocks inside an embedded app WebView.
 * See redeemDeviceLoginCode for the other half, called from a signed-out
 * state.
 */
export const createDeviceLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Astronomically unlikely to collide, but retry once on a primary-key
    // clash rather than surface a confusing error to the user.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode();
      const { error } = await supabaseAdmin.from("device_login_codes").insert({
        code,
        user_id: context.userId,
      });
      if (!error) return { code, expiresInSeconds: 300 };
      if (error.code !== "23505") throw error; // not a unique-violation, give up
    }
    throw new Error("could_not_generate_code");
  });

const redeemSchema = z.object({ code: z.string().min(1).max(20) });

/**
 * Called from the signed-out /auth screen: turns a valid, unused,
 * unexpired code into a real Supabase session token the client can apply
 * immediately with supabase.auth.verifyOtp({ token_hash, type: "magiclink" })
 * - no email round-trip, no redirect, the code IS the credential. Marks the
 * code used atomically (an update guarded by "used_at is null" - if two
 * requests race on the same code, only one can win the update) so it can't
 * be replayed even if someone captured it in transit.
 *
 * Throttled per source IP: at most 3 attempts per rolling 3-second window
 * (device_code_attempts), regardless of whether the code guessed exists -
 * a 7-digit code has a much smaller keyspace than the app's earlier
 * alphanumeric one, so this matters here in a way it wouldn't otherwise.
 */
export const redeemDeviceLoginCode = createServerFn({ method: "POST" })
  .validator(redeemSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = requestIp();

    const { data: bucket } = await supabaseAdmin
      .from("device_code_attempts")
      .select("attempts,window_started_at")
      .eq("ip", ip)
      .maybeSingle();
    const windowAge = bucket ? Date.now() - new Date(bucket.window_started_at).getTime() : Infinity;
    if (bucket && windowAge < 3000 && bucket.attempts >= 3) {
      throw new Error("rate_limited");
    }
    if (!bucket || windowAge >= 3000) {
      await supabaseAdmin
        .from("device_code_attempts")
        .upsert({ ip, attempts: 1, window_started_at: new Date().toISOString() });
    } else {
      await supabaseAdmin
        .from("device_code_attempts")
        .update({ attempts: bucket.attempts + 1 })
        .eq("ip", ip);
    }

    const code = data.code.trim().toUpperCase();

    const { data: row } = await supabaseAdmin
      .from("device_login_codes")
      .select("user_id,expires_at,used_at")
      .eq("code", code)
      .maybeSingle();
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("invalid_or_expired_code");
    }

    const { data: claimed } = await supabaseAdmin
      .from("device_login_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code)
      .is("used_at", null)
      .select("user_id")
      .maybeSingle();
    if (!claimed) throw new Error("invalid_or_expired_code"); // lost the race

    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      claimed.user_id,
    );
    if (userError || !authUser.user.email) throw userError ?? new Error("no_email_on_account");

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    });
    if (linkError || !link.properties?.hashed_token) {
      throw linkError ?? new Error("could_not_create_session_link");
    }

    // Successful redemption - clear this IP's throttle bucket so a shared
    // network (school wifi, NAT) isn't left cooling down after a real login.
    await supabaseAdmin.from("device_code_attempts").delete().eq("ip", ip);

    return { tokenHash: link.properties.hashed_token };
  });
