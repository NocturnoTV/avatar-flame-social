import { createHash, randomBytes } from "node:crypto";
import { useSession as getServerSession } from "@tanstack/react-start/server";

export const ROBLOX_CLIENT_ID = process.env["ROBLOX_CLIENT_ID"] ?? "4495295082449707042";
export const ROBLOX_REDIRECT_URI =
  process.env["ROBLOX_REDIRECT_URI"] ?? "https://bloxspark.app/auth/roblox/callback";

export type RobloxOAuthSession = {
  state?: string;
  verifier?: string;
  nonce?: string;
  userId?: string;
  returnTo?: "/onboarding" | "/settings";
  createdAt?: number;
};

function requiredClientSecret() {
  const secret = process.env["ROBLOX_CLIENT_SECRET"];
  if (!secret) throw new Error("ROBLOX_CLIENT_SECRET is not configured on the server.");
  return secret;
}

export function robloxClientSecret() {
  return requiredClientSecret();
}

export async function getRobloxOAuthSession() {
  const password = createHash("sha256").update(requiredClientSecret()).digest("hex");
  return getServerSession<RobloxOAuthSession>({
    name: "bloxspark-roblox-oauth",
    password,
    maxAge: 10 * 60,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
    },
  });
}

export type RobloxOAuthSessionHandle = Awaited<ReturnType<typeof getRobloxOAuthSession>>;

export function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export type RobloxIdentity = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type RobloxUserInfo = {
  sub?: string;
  preferred_username?: string;
  name?: string;
  nickname?: string;
  picture?: string | null;
};

type RobloxPublicUser = { name?: string; displayName?: string };
type RobloxGame = { id?: number; name?: string; rootPlace?: { id?: number } };
type RobloxGamesResponse = { data?: RobloxGame[]; nextPageCursor?: string | null };
type Thumbnail = { targetId?: number; imageUrl?: string; state?: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Roblox request failed (${response.status}).`);
  return (await response.json()) as T;
}

export async function exchangeRobloxCode(code: string, verifier: string) {
  const body = new URLSearchParams({
    client_id: ROBLOX_CLIENT_ID,
    client_secret: robloxClientSecret(),
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: ROBLOX_REDIRECT_URI,
  });
  return fetchJson<{ access_token?: string }>("https://apis.roblox.com/oauth/v1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function fetchRobloxIdentity(accessToken: string): Promise<RobloxIdentity> {
  const info = await fetchJson<RobloxUserInfo>("https://apis.roblox.com/oauth/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!info.sub || !info.preferred_username)
    throw new Error("Roblox returned an incomplete profile.");
  return {
    id: info.sub,
    username: info.preferred_username,
    displayName: info.name ?? info.nickname ?? info.preferred_username,
    avatarUrl: info.picture ?? null,
  };
}

export async function fetchPublicRobloxIdentity(robloxUserId: string): Promise<RobloxIdentity> {
  const [user, avatar] = await Promise.all([
    fetchJson<RobloxPublicUser>(
      `https://users.roblox.com/v1/users/${encodeURIComponent(robloxUserId)}`,
    ),
    fetchJson<{ data?: Thumbnail[] }>(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(robloxUserId)}&size=420x420&format=Png&isCircular=false`,
    ),
  ]);
  if (!user.name) throw new Error("Roblox profile not found.");
  return {
    id: robloxUserId,
    username: user.name,
    displayName: user.displayName ?? user.name,
    avatarUrl: avatar.data?.[0]?.imageUrl ?? null,
  };
}

export type SyncedRobloxGame = {
  universeId: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
};

export async function fetchRobloxGames(robloxUserId: string): Promise<SyncedRobloxGame[]> {
  const result = await fetchJson<RobloxGamesResponse>(
    `https://games.roblox.com/v2/users/${encodeURIComponent(robloxUserId)}/games?accessFilter=Public&sortOrder=Desc&limit=10`,
  );
  const games = (result.data ?? []).filter(
    (game): game is RobloxGame & { id: number; name: string } =>
      typeof game.id === "number" && typeof game.name === "string",
  );
  if (games.length === 0) return [];

  const ids = games.map((game) => game.id).join(",");
  const thumbs = await fetchJson<{ data?: Thumbnail[] }>(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
  );
  const byId = new Map(
    (thumbs.data ?? []).map((thumb) => [String(thumb.targetId), thumb.imageUrl ?? null]),
  );

  return games.slice(0, 5).map((game) => ({
    universeId: String(game.id),
    name: game.name.slice(0, 60),
    url: `https://www.roblox.com/games/${game.rootPlace?.id ?? game.id}`,
    thumbnailUrl: byId.get(String(game.id)) ?? null,
  }));
}

export async function persistRobloxAccount(userId: string, identity: RobloxIdentity) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conflict } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("roblox_user_id", identity.id)
    .neq("id", userId)
    .maybeSingle();
  if (conflict)
    throw new Error("This Roblox account is already linked to another BloxSpark account.");

  const games = await fetchRobloxGames(identity.id);
  const now = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      roblox_user_id: identity.id,
      roblox_username: identity.username,
      roblox_display_name: identity.displayName,
      roblox_avatar_url: identity.avatarUrl,
      avatar_url: identity.avatarUrl,
      roblox_connected_at: now,
      roblox_synced_at: now,
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  const { error: deleteError } = await supabaseAdmin
    .from("roblox_games")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
  if (games.length > 0) {
    const { error: gamesError } = await supabaseAdmin.from("roblox_games").insert(
      games.map((game, position) => ({
        user_id: userId,
        name: game.name,
        url: game.url,
        position,
        roblox_universe_id: game.universeId,
        thumbnail_url: game.thumbnailUrl,
        source: "roblox",
        synced_at: now,
      })),
    );
    if (gamesError) throw gamesError;
  }
  return { identity, games };
}
