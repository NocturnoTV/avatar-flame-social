import { createServerFn } from "@tanstack/react-start";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const replySchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  status: z.enum(["pending", "in_progress", "resolved", "wont_fix"]).optional(),
});

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

export const staffReplyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => replySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((row) => row.role === "admin" || row.role === "moderator")) {
      throw new Error("forbidden");
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("bug_reports")
      .select("id,reporter_id,title,status")
      .eq("id", data.ticketId)
      .single();
    if (ticketError) throw ticketError;

    const now = new Date().toISOString();
    const { error: messageError } = await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: context.userId,
      body: data.message,
      is_staff: true,
    });
    if (messageError) throw messageError;

    const nextStatus = data.status ?? (ticket.status === "pending" ? "in_progress" : ticket.status);
    await supabaseAdmin
      .from("bug_reports")
      .update({
        status: nextStatus,
        handled_by: context.userId,
        handled_at: now,
        last_activity_at: now,
      })
      .eq("id", ticket.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: ticket.reporter_id,
      kind: "system",
      body: `${ticket.title}: ${data.message.slice(0, 180)}`,
    });

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(ticket.reporter_id);
    const email = authUser.user?.email;
    let emailSent = false;
    if (email && process.env["LOVABLE_API_KEY"]) {
      const safeTitle = escapeHtml(ticket.title);
      const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br />");
      const ticketUrl = `https://bloxspark.app/support?ticket=${ticket.id}`;
      try {
        await sendLovableEmail(
          {
            to: email,
            from: "BloxSpark Support <support@bloxspark.app>",
            sender_domain: "notify.bloxspark.app",
            subject: `BloxSpark Support replied: ${ticket.title}`,
            purpose: "transactional",
            label: "support_ticket_reply",
            idempotency_key: `ticket-${ticket.id}-${Date.now()}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;background:#0f0b1b;color:#fff;padding:32px;border-radius:24px"><div style="font-weight:900;font-size:22px;color:#c084fc">BLOXSPARK SUPPORT</div><h1 style="font-size:24px">${safeTitle}</h1><p style="color:#c4b5fd">Your support request has a new reply.</p><div style="background:#211638;border:1px solid #6d28d9;border-radius:18px;padding:20px;line-height:1.6">${safeMessage}</div><p style="color:#a1a1aa;font-size:13px">Status: ${escapeHtml(nextStatus.replace("_", " "))}</p><a href="${ticketUrl}" style="display:inline-block;margin-top:14px;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:999px">Open my ticket</a><p style="color:#71717a;font-size:12px;margin-top:28px">This operational email was sent because you have an active BloxSpark support request.</p></div>`,
            text: `BloxSpark Support replied to "${ticket.title}"\n\n${data.message}\n\nStatus: ${nextStatus}\nOpen your ticket: ${ticketUrl}`,
          },
          {
            apiKey: process.env["LOVABLE_API_KEY"],
            sendUrl: process.env["LOVABLE_SEND_URL"],
          },
        );
        emailSent = true;
      } catch (error) {
        console.error("Support ticket email failed", error);
      }
    }

    return { emailSent, status: nextStatus };
  });
