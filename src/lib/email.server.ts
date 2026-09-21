/**
 * Real transactional email, on top of Supabase's own built-in auth emails
 * (signup/recovery/magic-link - see src/lib/email-templates/*.tsx). Those
 * only cover auth flows; this is for arbitrary admin-sent email (e.g. a
 * broadcast announcement).
 *
 * Uses Resend's plain HTTP API rather than pulling in an SDK, matching the
 * hand-rolled-fetch style already used for push (src/lib/push.server.ts).
 * Needs RESEND_API_KEY and RESEND_FROM_EMAIL (a from-address on a domain
 * verified in the Resend dashboard). Silently does nothing if they aren't
 * set, so email stays optional rather than a hard dependency.
 */
export async function sendEmailToUsers(
  userIds: string[],
  message: { subject: string; body: string },
) {
  if (userIds.length === 0) return;
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results = await Promise.all(
    userIds.map((id) => supabaseAdmin.auth.admin.getUserById(id)),
  );
  const emails = results
    .map((r) => r.data.user?.email)
    .filter((e): e is string => !!e);
  if (!emails.length) return;

  const html = `<p>${message.body.replace(/\n/g, "<br>")}</p>`;
  const CHUNK = 100; // Resend caps recipients per call
  for (let i = 0; i < emails.length; i += CHUNK) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        bcc: emails.slice(i, i + CHUNK),
        subject: message.subject,
        html,
      }),
    }).catch(() => {
      // Best-effort - the in-app notification and/or push are the real
      // guarantee, email is a bonus channel.
    });
  }
}
