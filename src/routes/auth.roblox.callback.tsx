import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeRobloxCode,
  fetchRobloxIdentity,
  persistRobloxAccount,
  getRobloxOAuthSession,
  type RobloxOAuthSessionHandle,
} from "@/lib/roblox-oauth.server";

function targetUrl(origin: string, path: "/onboarding" | "/settings", status: string) {
  const url = new URL(path, origin);
  url.searchParams.set(status === "connected" ? "roblox" : "roblox_error", status);
  return url.toString();
}

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  return error.message.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]").slice(0, 240);
}

async function clearSession(session: RobloxOAuthSessionHandle | null) {
  if (!session) return;
  try {
    await session.clear();
  } catch (error) {
    console.error("Roblox OAuth callback: session_clear", safeErrorMessage(error));
  }
}

export const Route = createFileRoute("/auth/roblox/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        let session: RobloxOAuthSessionHandle | null = null;
        let returnTo: "/onboarding" | "/settings" = "/settings";
        const fail = async (reason: string, stage: string, error?: unknown) => {
          if (error) console.error(`Roblox OAuth callback: ${stage}`, safeErrorMessage(error));
          await clearSession(session);
          return Response.redirect(targetUrl(requestUrl.origin, returnTo, reason), 302);
        };

        try {
          session = await getRobloxOAuthSession();
          returnTo = session.data.returnTo === "/onboarding" ? "/onboarding" : "/settings";

          if (requestUrl.searchParams.get("error"))
            return fail("authorization_denied", "authorization");
          const code = requestUrl.searchParams.get("code");
          const state = requestUrl.searchParams.get("state");
          if (!code || !state || !session.data.state || state !== session.data.state)
            return fail("invalid_state", "state_validation");
          if (!session.data.userId || !session.data.verifier || !session.data.createdAt)
            return fail("expired_session", "session_validation");
          if (Date.now() - session.data.createdAt > 10 * 60 * 1000)
            return fail("expired_session", "session_expired");

          const token = await exchangeRobloxCode(code, session.data.verifier);
          if (!token.access_token) return fail("token_exchange_failed", "token_exchange");
          const identity = await fetchRobloxIdentity(token.access_token);
          await persistRobloxAccount(session.data.userId, identity);
          await clearSession(session);
          return Response.redirect(targetUrl(requestUrl.origin, returnTo, "connected"), 302);
        } catch (error) {
          const reason =
            error instanceof Error && error.message.includes("already linked")
              ? "already_linked"
              : error instanceof Error && error.message.includes("ROBLOX_CLIENT_SECRET")
                ? "server_configuration"
                : "sync_failed";
          return fail(reason, "unhandled", error);
        }
      },
    },
  },
});
