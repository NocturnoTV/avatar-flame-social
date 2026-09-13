export const BANNERS: Record<string, string> = {
  nebula: "linear-gradient(135deg,#1d4ed8,#38bdf8)",
  lava: "linear-gradient(135deg,#075985,#2563eb)",
  ocean: "linear-gradient(135deg,#00c6ff,#0072ff)",
  matrix: "linear-gradient(135deg,#0c4a6e,#0284c7)",
  candy: "linear-gradient(135deg,#60a5fa,#dbeafe)",
  midnight: "linear-gradient(135deg,#0f172a,#1e40af)",
};

export const FRAMES: Record<string, string> = {
  none: "",
  glow: "ring-4 ring-primary/60 shadow-[0_0_30px_var(--spark)]",
  gold: "ring-4 ring-yellow-400",
  neon: "ring-4 ring-fuchsia-500 shadow-[0_0_25px_#e879f9]",
  pixel: "ring-4 ring-emerald-400 rounded-none",
};

export const ACCENTS: Record<string, string> = {
  spark: "#2563eb",
  violet: "#3b82f6",
  cyan: "#22d3ee",
  lime: "#0ea5e9",
  amber: "#1d4ed8",
  pink: "#60a5fa",
};

export const STICKERS = ["🔥", "🎮", "⭐", "🐱", "👾", "🍕", "🏆", "💎", "🎧", "🚀"];

export function ageFrom(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
