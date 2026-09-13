export const PROFILE_FONTS = ["default", "rounded", "serif", "mono", "display"] as const;
export const PROFILE_GLOWS = ["none", "blue", "cyan", "royal"] as const;

export function profileFontClass(font?: string | null) {
  if (font === "rounded") return "font-[ui-rounded,'Arial_Rounded_MT_Bold',sans-serif]";
  if (font === "serif") return "font-serif";
  if (font === "mono") return "font-mono";
  if (font === "display") return "font-black uppercase tracking-[0.08em]";
  return "font-sans";
}

export function profileGlowClass(glow?: string | null) {
  if (glow === "blue") return "shadow-[0_0_35px_rgba(37,99,235,.5)] ring-2 ring-blue-500/70";
  if (glow === "cyan") return "shadow-[0_0_35px_rgba(34,211,238,.5)] ring-2 ring-cyan-400/70";
  if (glow === "royal") return "shadow-[0_0_35px_rgba(29,78,216,.65)] ring-2 ring-blue-700/80";
  return "";
}
