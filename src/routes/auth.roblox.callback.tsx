import { createFileRoute } from "@tanstack/react-router";
import {
  exchangeRobloxCode,
  fetchRobloxIdentity,
  persistRobloxAccount,
  getRobloxOAuthSession,
} from "@/lib/roblox-oauth.server";

function targetUrl(origin: string, path: "/onboarding" | "/settings", status: string) {
  const url = new URL(path, origin);
  url.searchParams.set(status === "connected" ? "roblox" : "roblox_error", status);
  return url.toString();
}

export const Route = createFileRoute("/auth/roblox/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const session = await getRobloxOAuthSession();
        const returnTo = session.data.returnTo ?? "/settings";
        const fail = async (reason: string) => {
          await session.clear();
          return Response.redirect(targetUrl(requestUrl.origin, returnTo, reason), 302);
        };

        if (requestUrl.searchParams.get("error")) return fail("authorization_denied");
        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");
        if (!code || !state || !session.data.state || state !== session.data.state)
          return fail("invalid_state");
        if (!session.data.userId || !session.data.verifier || !session.data.createdAt)
          return fail("expired_session");
        if (Date.now() - session.data.createdAt > 10 * 60 * 1000) return fail("expired_session");

        try {
          const token = await exchangeRobloxCode(code, session.data.verifier);
          if (!token.access_token) return fail("token_exchange_failed");
          const identity = await fetchRobloxIdentity(token.access_token);
          await persistRobloxAccount(session.data.userId, identity);
          await session.clear();
          return Response.redirect(targetUrl(requestUrl.origin, returnTo, "connected"), 302);
        } catch (error) {
          console.error(
            "Roblox OAuth callback failed",
            error instanceof Error ? error.message : error,
          );
          const message =
            error instanceof Error && error.message.includes("already linked")
              ? "already_linked"
              : "sync_failed";
          return fail(message);
        }
      },
    },
  },
});
