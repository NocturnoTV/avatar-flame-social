/**
 * Per-conversation, per-viewer chat personalization (wallpaper + bubble
 * color). Purely a local display preference — like a phone's chat theme —
 * so it lives in localStorage rather than a synced table.
 */
export type Wallpaper = {
  id: string;
  label: string;
  css: string;
  /** Only "default" differs by theme — a chosen wallpaper stays as chosen. */
  darkCss?: string;
};

export const WALLPAPERS: Wallpaper[] = [
  { id: "default", label: "Default", css: "#ffffff", darkCss: "#000000" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(160deg,#FFE5EC 0%,#FFF3E0 100%)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(160deg,#E3F6FF 0%,#EAF2FF 100%)" },
  { id: "nebula", label: "Nebula", css: "linear-gradient(160deg,#F1E9FF 0%,#E7EEFF 100%)" },
  { id: "mint", label: "Mint", css: "linear-gradient(160deg,#E6FFF6 0%,#F2FFF0 100%)" },
  { id: "candy", label: "Candy", css: "linear-gradient(160deg,#FFE9F5 0%,#F5E9FF 100%)" },
  {
    id: "dots",
    label: "Dots",
    css:
      "radial-gradient(#e5e5e5 1px, transparent 1px) 0 0 / 18px 18px, #ffffff",
  },
];

export type BubbleTheme = { id: string; label: string; from: string; to: string };

export const BUBBLE_THEMES: BubbleTheme[] = [
  { id: "default", label: "Purple", from: "#A855F7", to: "#7C3AED" },
  { id: "sunset", label: "Sunset", from: "#FF6B6B", to: "#FFA36C" },
  { id: "candy", label: "Candy", from: "#FF3568", to: "#FF7CE5" },
  { id: "mint", label: "Mint", from: "#18BFE2", to: "#20D778" },
  { id: "grape", label: "Grape", from: "#7B61FF", to: "#B96BFF" },
  { id: "midnight", label: "Midnight", from: "#111827", to: "#374151" },
];

function key(conversationId: string, kind: "wallpaper" | "bubble") {
  return `bloxspark-chat-${kind}-${conversationId}`;
}

export function getWallpaper(conversationId: string): Wallpaper {
  try {
    const id = window.localStorage.getItem(key(conversationId, "wallpaper"));
    return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0]!;
  } catch {
    return WALLPAPERS[0]!;
  }
}

export function setWallpaper(conversationId: string, id: string) {
  try {
    window.localStorage.setItem(key(conversationId, "wallpaper"), id);
  } catch {
    /* ignore (private browsing, storage disabled, etc.) */
  }
}

export function resolveWallpaperCss(wallpaper: Wallpaper, appTheme: "dark" | "light") {
  return appTheme === "dark" && wallpaper.darkCss ? wallpaper.darkCss : wallpaper.css;
}

export function getBubbleTheme(conversationId: string): BubbleTheme {
  try {
    const id = window.localStorage.getItem(key(conversationId, "bubble"));
    return BUBBLE_THEMES.find((b) => b.id === id) ?? BUBBLE_THEMES[0]!;
  } catch {
    return BUBBLE_THEMES[0]!;
  }
}

export function setBubbleTheme(conversationId: string, id: string) {
  try {
    window.localStorage.setItem(key(conversationId, "bubble"), id);
  } catch {
    /* ignore */
  }
}
