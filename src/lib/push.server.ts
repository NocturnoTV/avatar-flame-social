import crypto from "node:crypto";

/**
 * Real OS-level push notifications (Firebase Cloud Messaging), on top of
 * the in-app "notifications" table rows. FCM's modern API (HTTP v1) needs
 * an OAuth access token minted from a service-account key rather than the
 * old static server key, so this signs that token itself instead of
 * pulling in the full firebase-admin SDK for one endpoint.
 *
 * Needs three env vars (from the service account JSON downloaded in
 * Firebase console -> Project settings -> Service accounts -> Generate new
 * private key): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 * FIREBASE_PRIVATE_KEY (paste the key's \n line breaks as literal \n).
 * Silently does nothing if they aren't set, so push is optional rather than
 * a hard dependency for every environment.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string) {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(): Promise<string | null> {
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = base64url(
    crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), privateKey),
  );
  const jwt = `${header}.${claims}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    console.error("Firebase token exchange failed", await response.text().catch(() => ""));
    return null;
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

/** Sends one push notification to every device registered to the given
 * users. Best-effort: a missing config or a per-token failure never throws
 * - the in-app notification row is the source of truth, this is a bonus. */
export async function sendPushToUsers(
  userIds: string[],
  message: { title: string; body: string },
) {
  if (userIds.length === 0) return;
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const accessToken = await getAccessToken();
  if (!projectId || !accessToken) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: devices } = await supabaseAdmin
    .from("push_device_tokens")
    .select("token")
    .in("user_id", userIds);
  if (!devices?.length) return;

  const staleTokens: string[] = [];
  await Promise.all(
    devices.map(async ({ token }) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
            },
          }),
        },
      );
      // UNREGISTERED / NOT_FOUND means the app was uninstalled or the token
      // rotated without us hearing about it - stop retrying that device.
      if (response.status === 404 || response.status === 400) {
        const body = await response.text().catch(() => "");
        if (body.includes("UNREGISTERED") || body.includes("NOT_FOUND")) {
          staleTokens.push(token);
        }
      }
    }),
  );

  if (staleTokens.length) {
    await supabaseAdmin.from("push_device_tokens").delete().in("token", staleTokens);
  }
}
