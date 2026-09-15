import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Unambiguous alphabet (no 0/O/1/I/L) so a code is easy to read off one
 * screen and type on another. 8 characters over 31 symbols is ~2^39 of
 * keyspace - combined with the 10-minute expiry below, brute-forcing a
 * single live code by guessing is not practical. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

/**
 * "Connecter un autre appareil" in Settings: the already-signed-in device
 * mints a short code the user can type into the app (or another browser)
 * to sign in as the same account instantly, instead of repeating the full
 * Roblox OAuth flow there. Requires being signed in - see
 * redeemDeviceLoginCode for the other half, called from a signed-out state.
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
      if (!error) return { code, expiresInSeconds: 600 };
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
 */
export const redeemDeviceLoginCode = createServerFn({ method: "POST" })
  .validator(redeemSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    return { tokenHash: link.properties.hashed_token };
  });
