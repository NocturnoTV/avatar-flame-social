import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { pgQuote } from "@/lib/pgFilter";

const schema = z.object({ identifier: z.string().trim().min(1).max(120) });

/**
 * Sends a password-reset email for a BloxSpark username, Roblox username,
 * or email address - resolved to an email server-side the same way
 * signInWithIdentifier does, so the address is never exposed to the
 * browser. Always resolves the same way regardless of whether an account
 * was found, so this can't be used to check which usernames/emails exist.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(schema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const identifier = data.identifier.replace(/^@/, "");

    let email: string | null = null;
    if (identifier.includes("@")) {
      email = identifier;
    } else {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .or(`username.ilike.${pgQuote(identifier)},roblox_username.ilike.${pgQuote(identifier)}`)
        .limit(1)
        .maybeSingle();
      if (profile) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        email = userData.user?.email ?? null;
      }
    }

    if (email) {
      const client = createClient(
        process.env["SUPABASE_URL"]!,
        process.env["SUPABASE_PUBLISHABLE_KEY"]!,
        { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
      );
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: "https://bloxspark.app/auth?reset=1",
      });
    }

    return { ok: true };
  });
