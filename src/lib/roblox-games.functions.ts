import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const searchSchema = z.object({ query: z.string().trim().min(2).max(80) });

type RobloxSearchContent = {
  universeId?: number;
  rootPlaceId?: number;
  name?: string;
  playerCount?: number;
  canonicalUrlPath?: string;
};

export type RobloxGameSearchResult = {
  universeId: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  playerCount: number;
};

const FALLBACK_GAMES: Array<
  RobloxSearchContent & { universeId: number; rootPlaceId: number; name: string }
> = [
  { universeId: 1686885941, rootPlaceId: 4924922222, name: "Brookhaven 🏡RP", playerCount: 0 },
  { universeId: 994732206, rootPlaceId: 2753915549, name: "Blox Fruits", playerCount: 0 },
  { universeId: 383310974, rootPlaceId: 920587237, name: "Adopt Me!", playerCount: 0 },
  { universeId: 66654135, rootPlaceId: 142823291, name: "Murder Mystery 2", playerCount: 0 },
  { universeId: 703124385, rootPlaceId: 1962086868, name: "Tower of Hell", playerCount: 0 },
  { universeId: 245662005, rootPlaceId: 606849621, name: "Jailbreak", playerCount: 0 },
  { universeId: 2619619496, rootPlaceId: 6872265039, name: "BedWars", playerCount: 0 },
  { universeId: 6238705697, rootPlaceId: 15101393044, name: "Dress To Impress", playerCount: 0 },
];

async function fetchRobloxSearch(baseUrl: string, query: string) {
  const url = new URL("/search-api/omni-search", baseUrl);
  url.searchParams.set("searchQuery", query);
  url.searchParams.set("sessionId", crypto.randomUUID());
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 BloxSpark" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  return (await response.json()) as {
    searchResults?: Array<{ contentGroupType?: string; contents?: RobloxSearchContent[] }>;
  };
}

export const searchPopularRobloxGames = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    let payload: Awaited<ReturnType<typeof fetchRobloxSearch>> = null;
    for (const baseUrl of ["https://apis.roblox.com", "https://apis.roproxy.com"]) {
      try {
        payload = await fetchRobloxSearch(baseUrl, data.query);
        if (payload?.searchResults?.length) break;
      } catch {
        // The next provider or the built-in catalog keeps the search usable.
      }
    }

    let contents =
      payload?.searchResults
        ?.filter((group) => group.contentGroupType === "Game")
        .flatMap((group) => group.contents ?? [])
        .filter(
          (
            game,
          ): game is RobloxSearchContent & {
            universeId: number;
            rootPlaceId: number;
            name: string;
          } => Boolean(game.universeId && game.rootPlaceId && game.name),
        )
        .slice(0, 30) ?? [];

    if (!contents.length) {
      const normalized = data.query.toLocaleLowerCase();
      contents = FALLBACK_GAMES.filter((game) =>
        game.name.toLocaleLowerCase().includes(normalized),
      );
    }

    const thumbnailMap = new Map<string, string>();
    if (contents.length) {
      for (const host of ["https://thumbnails.roblox.com", "https://thumbnails.roproxy.com"]) {
        try {
          const thumbnails = new URL("/v1/games/icons", host);
          thumbnails.searchParams.set(
            "universeIds",
            contents.map((game) => game.universeId).join(","),
          );
          thumbnails.searchParams.set("returnPolicy", "PlaceHolder");
          thumbnails.searchParams.set("size", "150x150");
          thumbnails.searchParams.set("format", "Png");
          thumbnails.searchParams.set("isCircular", "false");
          const thumbResponse = await fetch(thumbnails, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(6_000),
          });
          if (!thumbResponse.ok) continue;
          const thumbPayload = (await thumbResponse.json()) as {
            data?: Array<{ targetId?: number; imageUrl?: string }>;
          };
          for (const thumb of thumbPayload.data ?? []) {
            if (thumb.targetId && thumb.imageUrl)
              thumbnailMap.set(String(thumb.targetId), thumb.imageUrl);
          }
          break;
        } catch {
          // Game results remain usable without thumbnails.
        }
      }
    }

    return contents.map((game): RobloxGameSearchResult => ({
      universeId: String(game.universeId),
      name: game.name,
      url: `https://www.roblox.com/games/${game.rootPlaceId}`,
      thumbnailUrl: thumbnailMap.get(String(game.universeId)) ?? null,
      playerCount: game.playerCount ?? 0,
    }));
  });
