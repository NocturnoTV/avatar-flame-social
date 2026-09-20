import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { pgQuote } from "@/lib/pgFilter";

const schema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(6).max(200),
});

/**
 * Signs a user in with their BloxSpark username or their Roblox username.
 * The email lookup happens server-side only: the address is never returned
 * to the browser, and credentials are always required.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
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
    if (!email) throw new Error("invalid_credentials");

    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: signIn, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !signIn.session) throw new Error("invalid_credentials");
    return {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
