import { createFileRoute } from "@tanstack/react-router";
import {
  consumeOAuthState,
  exchangeRobloxCode,
  fetchRobloxIdentity,
  persistRobloxAccount,
} from "@/lib/roblox-oauth.server";

function redirectTo(origin: string, path: "/onboarding" | "/settings", status: string) {
  const url = new URL(path, origin);
  url.searchParams.set(status === "connected" ? "roblox" : "roblox_error", status);
  return new Response(null, { status: 302, headers: { location: url.toString() } });
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]").slice(0, 240);
}

export const Route = createFileRoute("/auth/roblox/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        let returnTo: "/onboarding" | "/settings" = "/settings";
        try {
          if (requestUrl.searchParams.get("error"))
            return redirectTo(requestUrl.origin, returnTo, "authorization_denied");

          const code = requestUrl.searchParams.get("code");
          const state = requestUrl.searchParams.get("state");
          if (!code || !state) return redirectTo(requestUrl.origin, returnTo, "invalid_state");

          const pending = await consumeOAuthState(state);
          if (!pending) return redirectTo(requestUrl.origin, returnTo, "expired_session");
          returnTo = pending.returnTo;

          const token = await exchangeRobloxCode(code, pending.verifier);
          if (!token.access_token)
            return redirectTo(requestUrl.origin, returnTo, "token_exchange_failed");

          const identity = await fetchRobloxIdentity(token.access_token);
          await persistRobloxAccount(pending.userId, identity);
          return redirectTo(requestUrl.origin, returnTo, "connected");
        } catch (error) {
          console.error("Roblox OAuth callback failed:", safeErrorMessage(error));
          const message = safeErrorMessage(error);
          const reason = message.includes("already linked")
            ? "already_linked"
            : message.includes("ROBLOX_CLIENT_SECRET")
              ? "server_configuration"
              : "sync_failed";
          return redirectTo(requestUrl.origin, returnTo, reason);
        }
      },
    },
  },
});
