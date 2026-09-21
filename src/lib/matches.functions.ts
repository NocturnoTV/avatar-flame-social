import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LangCode = "fr" | "en" | "es" | "pt" | "de" | "ko";
const SUPPORTED_LANGS: LangCode[] = ["fr", "en", "es", "pt", "de", "ko"];
function toLangCode(value: string | null | undefined): LangCode {
  return (SUPPORTED_LANGS as string[]).includes(value ?? "") ? (value as LangCode) : "en";
}

const MATCH_BODY: Record<LangCode, (name: string) => string> = {
  fr: (name) => `✨ Nouveau match avec ${name} !`,
  en: (name) => `✨ New match with ${name}!`,
  es: (name) => `✨ ¡Nuevo match con ${name}!`,
  pt: (name) => `✨ Novo match com ${name}!`,
  de: (name) => `✨ Neues Match mit ${name}!`,
  ko: (name) => `✨ ${name}님과 매칭되었어요!`,
};

/** Pushes a real OS notification to the other person the moment a match
 * happens - perform_swipe already writes the in-app "match" notification
 * row for both sides, this is just the "phone is locked" bonus on top,
 * same as notifyNewMessage. Only the *other* person needs it: whoever just
 * triggered the swipe is already looking at the match screen. */
export const notifyNewMatch = createServerFn({ method: "POST" })
  .validator(z.object({ targetUserId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: prefsRow }, { data: langRow }, { data: sender }] = await Promise.all([
      supabaseAdmin
        .from("profiles_private")
        .select("notification_prefs")
        .eq("user_id", data.targetUserId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("language").eq("id", data.targetUserId).maybeSingle(),
      supabaseAdmin.from("profiles").select("username").eq("id", context.userId).maybeSingle(),
    ]);
    const prefs = prefsRow?.notification_prefs as Record<string, unknown> | null | undefined;
    if (prefs?.["paused"] === true || prefs?.["matches"] === false) return { sent: false };

    const { sendPushToUsers } = await import("@/lib/push.server");
    const lang = toLangCode(langRow?.language);
    void sendPushToUsers([data.targetUserId], {
      title: "BloxSpark",
      body: MATCH_BODY[lang](sender?.username ?? "?"),
    });

    return { sent: true };
  });
