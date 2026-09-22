import creamOrbs from "@/assets/wallpapers/cream-orbs.png";
import beigeSwirl from "@/assets/wallpapers/beige-swirl.webp";
import blackOrbs from "@/assets/wallpapers/black-orbs.png";
import navySwirl from "@/assets/wallpapers/navy-swirl.webp";
import greenOrbs from "@/assets/wallpapers/green-orbs.png";
import greenSolid from "@/assets/wallpapers/green-solid.png";
import mintSolid from "@/assets/wallpapers/mint-solid.png";
import yellowOrbs from "@/assets/wallpapers/yellow-orbs.png";
import yellowSolid from "@/assets/wallpapers/yellow-solid.png";
import skyblueOrbs from "@/assets/wallpapers/skyblue-orbs.png";
import paleblueSwirl from "@/assets/wallpapers/paleblue-swirl.png";
import tealSwirl from "@/assets/wallpapers/teal-swirl.png";
import lightblueSolid from "@/assets/wallpapers/lightblue-solid.png";
import blueSolid from "@/assets/wallpapers/blue-solid.png";
import redOrbs from "@/assets/wallpapers/red-orbs.png";
import redSolid from "@/assets/wallpapers/red-solid.png";

/**
 * Per-conversation, per-viewer chat personalization (wallpaper + bubble
 * color). Purely a local display preference - like a phone's chat theme -
 * so it lives in localStorage rather than a synced table.
 */
export type Wallpaper = {
  id: string;
  /** i18n key for the tile's name - translated everywhere it's shown. */
  labelKey: string;
  /** Fallback/preview color, and what "default" resolves to. */
  css: string;
  /** Only "default" differs by theme - a chosen wallpaper stays as chosen. */
  darkCss?: string;
  /** Full-bleed image, when this wallpaper is a photo rather than a plain
   * color/gradient (everything except "default" right now). */
  image?: string;
};

// Ordered by color family (light/black/green/yellow/blue/red) so the picker
// grid reads as a smooth gradient rather than a random jumble - "default"
// (the app's own background) always comes first since it's the common case.
export const WALLPAPERS: Wallpaper[] = [
  { id: "default", labelKey: "wallpaperDefault", css: "#faf7fe", darkCss: "#08090d" },
  { id: "cream-orbs", labelKey: "wallpaperCreamOrbs", css: "#efe9df", image: creamOrbs },
  { id: "beige-swirl", labelKey: "wallpaperBeigeSwirl", css: "#e3d9c8", image: beigeSwirl },
  { id: "black-orbs", labelKey: "wallpaperBlackOrbs", css: "#0a0a0a", image: blackOrbs },
  { id: "navy-swirl", labelKey: "wallpaperNavySwirl", css: "#101826", image: navySwirl },
  { id: "green-orbs", labelKey: "wallpaperGreenOrbs", css: "#a9c98a", image: greenOrbs },
  { id: "green-solid", labelKey: "wallpaperGreenSolid", css: "#6fb56a", image: greenSolid },
  { id: "mint-solid", labelKey: "wallpaperMintSolid", css: "#d6f7cf", image: mintSolid },
  { id: "yellow-orbs", labelKey: "wallpaperYellowOrbs", css: "#f2d34a", image: yellowOrbs },
  { id: "yellow-solid", labelKey: "wallpaperYellowSolid", css: "#fdea0a", image: yellowSolid },
  { id: "skyblue-orbs", labelKey: "wallpaperSkyblueOrbs", css: "#a9c9e8", image: skyblueOrbs },
  { id: "paleblue-swirl", labelKey: "wallpaperPaleblueSwirl", css: "#c9d8e4", image: paleblueSwirl },
  { id: "teal-swirl", labelKey: "wallpaperTealSwirl", css: "#5f8fbf", image: tealSwirl },
  { id: "lightblue-solid", labelKey: "wallpaperLightblueSolid", css: "#a8d0ef", image: lightblueSolid },
  { id: "blue-solid", labelKey: "wallpaperBlueSolid", css: "#6ea1de", image: blueSolid },
  { id: "red-orbs", labelKey: "wallpaperRedOrbs", css: "#d9605c", image: redOrbs },
  { id: "red-solid", labelKey: "wallpaperRedSolid", css: "#cc0000", image: redSolid },
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
    if (id === "custom") {
      const custom = getCustomWallpaper(conversationId);
      if (custom) return { id: "custom", labelKey: "wallpaperAlbum", css: "#000000", image: custom };
    }
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

/** A viewer-chosen custom photo (Spark+ only) - stored as a data URL in
 * localStorage alongside the preset choice, under its own id so switching
 * back to a preset doesn't lose it. */
export function getCustomWallpaper(conversationId: string): string | null {
  try {
    return window.localStorage.getItem(key(conversationId, "wallpaper") + "-custom");
  } catch {
    return null;
  }
}

export function setCustomWallpaper(conversationId: string, dataUrl: string) {
  try {
    window.localStorage.setItem(key(conversationId, "wallpaper") + "-custom", dataUrl);
    setWallpaper(conversationId, "custom");
  } catch {
    /* ignore */
  }
}

export function resolveWallpaperCss(wallpaper: Wallpaper, appTheme: "dark" | "light") {
  if (wallpaper.image) return `url(${wallpaper.image})`;
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
