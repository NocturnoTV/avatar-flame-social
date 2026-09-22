import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LangCode = "fr" | "en" | "es" | "pt" | "de" | "ko";
const SUPPORTED_LANGS: LangCode[] = ["fr", "en", "es", "pt", "de", "ko"];
function toLangCode(value: string | null | undefined): LangCode {
  return (SUPPORTED_LANGS as string[]).includes(value ?? "") ? (value as LangCode) : "en";
}

// Push text doesn't go through the client-side i18n dictionary (that's a
// browser-context React module) - kept as its own small table here, mirroring
// the same 6 languages, so a notification always reads in the recipient's
// own selected language rather than the sender's.
const KIND_BODY: Record<LangCode, Record<string, string>> = {
  fr: {
    image: "📷 Photo",
    voice: "🎤 Message vocal",
    sticker: "🙂 Autocollant",
    missed_call: "📞 Appel manqué",
    shared_video: "🎬 Vidéo",
  },
  en: {
    image: "📷 Photo",
    voice: "🎤 Voice message",
    sticker: "🙂 Sticker",
    missed_call: "📞 Missed call",
    shared_video: "🎬 Video",
  },
  es: {
    image: "📷 Foto",
    voice: "🎤 Mensaje de voz",
    sticker: "🙂 Sticker",
    missed_call: "📞 Llamada perdida",
    shared_video: "🎬 Vídeo",
  },
  pt: {
    image: "📷 Foto",
    voice: "🎤 Mensagem de voz",
    sticker: "🙂 Autocolante",
    missed_call: "📞 Chamada perdida",
    shared_video: "🎬 Vídeo",
  },
  de: {
    image: "📷 Foto",
    voice: "🎤 Sprachnachricht",
    sticker: "🙂 Sticker",
    missed_call: "📞 Verpasster Anruf",
    shared_video: "🎬 Video",
  },
  ko: {
    image: "📷 사진",
    voice: "🎤 음성 메시지",
    sticker: "🙂 스티커",
    missed_call: "📞 부재중 전화",
    shared_video: "🎬 동영상",
  },
};

const GIFT_LABEL: Record<LangCode, (amount: number) => string> = {
  fr: (a) => `🎁 Cadeau : ${a.toLocaleString("fr-FR")} Blox`,
  en: (a) => `🎁 Gift: ${a.toLocaleString("en-US")} Blox`,
  es: (a) => `🎁 Regalo: ${a.toLocaleString("es-ES")} Blox`,
  pt: (a) => `🎁 Presente: ${a.toLocaleString("pt-PT")} Blox`,
  de: (a) => `🎁 Geschenk: ${a.toLocaleString("de-DE")} Blox`,
  ko: (a) => `🎁 선물: ${a.toLocaleString("ko-KR")} Blox`,
};
const GIFT_PLAIN: Record<LangCode, string> = {
  fr: "🎁 Cadeau",
  en: "🎁 Gift",
  es: "🎁 Regalo",
  pt: "🎁 Presente",
  de: "🎁 Geschenk",
  ko: "🎁 선물",
};

function giftBody(content: string | null | undefined, lang: LangCode): string {
  try {
    const parsed = content ? (JSON.parse(content) as { amount?: number }) : null;
    return parsed?.amount ? GIFT_LABEL[lang](parsed.amount) : GIFT_PLAIN[lang];
  } catch {
    return GIFT_PLAIN[lang];
  }
}

/** Pushes a real OS notification to every other participant of a
 * conversation right after a message is sent - the in-app unread badge
 * already comes from Realtime, this is the "phone is locked" case.
 * Respects both a muted conversation and the recipient's own
 * profiles_private.notification_prefs (paused, or "messages" turned off in
 * Settings) - the same two checks the DB already applies to the in-app
 * notifications table, so push never fires when the in-app one wouldn't
 * either. The body is localized per recipient's own selected language,
 * not the sender's. */
export const notifyNewMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      conversationId: z.string().uuid(),
      kind: z.enum(["text", "image", "voice", "sticker", "gift", "missed_call"]),
      content: z.string().max(500).nullable().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The caller may only trigger pushes for a conversation they belong to,
    // otherwise anyone could spam arbitrary members with chosen text.
    const { data: membership } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) return { sentTo: 0 };

    const [{ data: participants }, { data: sender }] = await Promise.all([
      supabaseAdmin
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", data.conversationId)
        .neq("user_id", context.userId)
        .or("muted.is.null,muted.eq.false"),
      supabaseAdmin.from("profiles").select("username").eq("id", context.userId).maybeSingle(),
    ]);
    const recipientIds = (participants ?? []).map((p) => p.user_id);
    if (!recipientIds.length) return { sentTo: 0 };

    const [{ data: prefsRows }, { data: langRows }] = await Promise.all([
      supabaseAdmin
        .from("profiles_private")
        .select("user_id,notification_prefs")
        .in("user_id", recipientIds),
      supabaseAdmin.from("profiles").select("id,language").in("id", recipientIds),
    ]);
    const allowed = recipientIds.filter((id) => {
      const prefs = (prefsRows ?? []).find((p) => p.user_id === id)?.notification_prefs as
        | Record<string, unknown>
        | null
        | undefined;
      if (!prefs) return true;
      if (prefs["paused"] === true) return false;
      if (prefs["messages"] === false) return false;
      return true;
    });
    if (!allowed.length) return { sentTo: 0 };

    const { sendPushToUsers } = await import("@/lib/push.server");
    const isSharedVideo = data.kind === "text" && /^video:[0-9a-f-]{36}$/i.test(data.content ?? "");

    // Group by language so each group gets its own localized body in one
    // batched send - a 1:1 DM is just a group of one.
    const byLang = new Map<LangCode, string[]>();
    for (const id of allowed) {
      const lang = toLangCode((langRows ?? []).find((r) => r.id === id)?.language);
      byLang.set(lang, [...(byLang.get(lang) ?? []), id]);
    }

    await Promise.all(
      [...byLang.entries()].map(([lang, ids]) => {
        const body: string =
          data.kind === "gift"
            ? giftBody(data.content, lang)
            : isSharedVideo
              ? KIND_BODY[lang]["shared_video"]!
              : data.kind === "text"
                ? (data.content?.trim().slice(0, 100) ?? "")
                : (KIND_BODY[lang][data.kind] ?? "");
        return sendPushToUsers(ids, { title: sender?.username ?? "BloxSpark", body });
      }),
    );

    return { sentTo: allowed.length };
  });
