import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ROBLOX_CLIENT_ID,
  ROBLOX_REDIRECT_URI,
  fetchPublicRobloxIdentity,
  persistRobloxAccount,
  pkceChallenge,
  randomUrlSafe,
  saveOAuthState,
} from "@/lib/roblox-oauth.server";

const returnToSchema = z.object({ returnTo: z.enum(["/onboarding", "/settings"]) });

export const beginRobloxOAuth = createServerFn({ method: "POST" })
  .validator(returnToSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const state = randomUrlSafe();
    const verifier = randomUrlSafe(48);
    const nonce = randomUrlSafe();
    await saveOAuthState({
      state,
      verifier,
      nonce,
      userId: context.userId,
      returnTo: data.returnTo,
    });

    const url = new URL("https://apis.roblox.com/oauth/v1/authorize");
    url.search = new URLSearchParams({
      client_id: ROBLOX_CLIENT_ID,
      redirect_uri: ROBLOX_REDIRECT_URI,
      response_type: "code",
      scope: "openid profile",
      state,
      nonce,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return { url: url.toString() };
  });

export const syncRobloxAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    disableResponseCaching();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("roblox_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile?.roblox_user_id) throw new Error("No Roblox account is linked.");
    const identity = await fetchPublicRobloxIdentity(profile.roblox_user_id);
    return persistRobloxAccount(context.userId, identity);
  });

export const disconnectRobloxAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    disableResponseCaching();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: readError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url,roblox_avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    if (readError) throw readError;
    const avatarWasFromRoblox = profile?.avatar_url === profile?.roblox_avatar_url;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        roblox_user_id: null,
        roblox_username: null,
        roblox_display_name: null,
        roblox_avatar_url: null,
        roblox_connected_at: null,
        roblox_synced_at: null,
        ...(avatarWasFromRoblox ? { avatar_url: null } : {}),
      })
      .eq("id", context.userId);
    if (error) throw error;
    const { error: gamesError } = await supabaseAdmin
      .from("roblox_games")
      .delete()
      .eq("user_id", context.userId)
      .eq("source", "roblox");
    if (gamesError) throw gamesError;
    return { success: true };
  });
