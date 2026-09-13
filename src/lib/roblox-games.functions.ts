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

export const searchPopularRobloxGames = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const url = new URL("https://apis.roblox.com/search-api/omni-search");
    url.searchParams.set("searchQuery", data.query);
    url.searchParams.set("sessionId", crypto.randomUUID());

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "BloxSpark/1.0" },
    });
    if (!response.ok) throw new Error("Roblox search is temporarily unavailable.");
    const payload = (await response.json()) as {
      searchResults?: Array<{ contentGroupType?: string; contents?: RobloxSearchContent[] }>;
    };
    const contents =
      payload.searchResults
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

    const thumbnailMap = new Map<string, string>();
    if (contents.length) {
      const thumbnails = new URL("https://thumbnails.roblox.com/v1/games/icons");
      thumbnails.searchParams.set("universeIds", contents.map((game) => game.universeId).join(","));
      thumbnails.searchParams.set("returnPolicy", "PlaceHolder");
      thumbnails.searchParams.set("size", "150x150");
      thumbnails.searchParams.set("format", "Png");
      thumbnails.searchParams.set("isCircular", "false");
      const thumbResponse = await fetch(thumbnails, { headers: { Accept: "application/json" } });
      if (thumbResponse.ok) {
        const thumbPayload = (await thumbResponse.json()) as {
          data?: Array<{ targetId?: number; imageUrl?: string }>;
        };
        for (const thumb of thumbPayload.data ?? []) {
          if (thumb.targetId && thumb.imageUrl)
            thumbnailMap.set(String(thumb.targetId), thumb.imageUrl);
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
