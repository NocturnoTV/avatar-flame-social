export const BANNERS: Record<string, string> = {
  nebula: "linear-gradient(135deg,#ff4d5e,#7b2bff)",
  lava: "linear-gradient(135deg,#ff9d00,#ff2d55)",
  ocean: "linear-gradient(135deg,#00c6ff,#0072ff)",
  matrix: "linear-gradient(135deg,#00ff87,#0f2027)",
  candy: "linear-gradient(135deg,#ff9a9e,#fad0c4)",
  midnight: "linear-gradient(135deg,#232526,#414345)",
};

export const FRAMES: Record<string, string> = {
  none: "",
  glow: "ring-4 ring-primary/60 shadow-[0_0_30px_var(--spark)]",
  gold: "ring-4 ring-yellow-400",
  neon: "ring-4 ring-fuchsia-500 shadow-[0_0_25px_#e879f9]",
  pixel: "ring-4 ring-emerald-400 rounded-none",
};

export const ACCENTS: Record<string, string> = {
  spark: "#ff3b4e",
  violet: "#8b5cf6",
  cyan: "#22d3ee",
  lime: "#a3e635",
  amber: "#f59e0b",
  pink: "#ec4899",
};

export const STICKERS = ["🔥", "🎮", "⭐", "🐱", "👾", "🍕", "🏆", "💎", "🎧", "🚀"];

export function ageFrom(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
