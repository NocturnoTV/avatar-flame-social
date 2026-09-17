export const PROFILE_FONTS = [
  "default",
  "rounded",
  "serif",
  "mono",
  "display",
  "elegant",
  "handwritten",
  "condensed",
  "futuristic",
] as const;

export const PROFILE_FONT_LABELS: Record<(typeof PROFILE_FONTS)[number], string> = {
  default: "Classique",
  rounded: "Arrondie",
  serif: "Élégante",
  mono: "Monospace",
  display: "Impact",
  elegant: "Éditoriale",
  handwritten: "Manuscrite",
  condensed: "Condensée",
  futuristic: "Futuriste",
};

export const PROFILE_GLOWS = [
  "none",
  "blue",
  "cyan",
  "royal",
  "pink",
  "red",
  "orange",
  "gold",
  "green",
  "violet",
  "white",
  "rainbow",
] as const;

export const PROFILE_GLOW_LABELS: Record<(typeof PROFILE_GLOWS)[number], string> = {
  none: "Aucun",
  blue: "Bleu électrique",
  cyan: "Cyan",
  royal: "Bleu royal",
  pink: "Rose",
  red: "Rouge",
  orange: "Orange",
  gold: "Or",
  green: "Vert",
  violet: "Violet",
  white: "Blanc",
  rainbow: "Arc-en-ciel",
};

export function isSparkPlusActive(profile?: {
  spark_plus_active?: boolean | null;
  spark_plus_expires_at?: string | null;
} | null) {
  if (!profile?.spark_plus_active) return false;
  if (!profile.spark_plus_expires_at) return true;
  return new Date(profile.spark_plus_expires_at).getTime() > Date.now();
}

export function profileFontClass(font?: string | null) {
  if (font === "rounded") return "font-[ui-rounded,'Arial_Rounded_MT_Bold',sans-serif]";
  if (font === "serif") return "font-serif";
  if (font === "mono") return "font-mono";
  if (font === "display") return "font-black uppercase tracking-[0.08em]";
  if (font === "elegant") return "font-['Palatino_Linotype',Palatino,Georgia,serif] italic";
  if (font === "handwritten") return "font-['Segoe_Print','Bradley_Hand',cursive]";
  if (font === "condensed") return "font-['Arial_Narrow','Roboto_Condensed',sans-serif] font-bold";
  if (font === "futuristic") return "font-['Eurostile','Trebuchet_MS',sans-serif] font-black uppercase tracking-[0.12em]";
  return "font-sans";
}

export function profileGlowClass(glow?: string | null) {
  if (PROFILE_GLOWS.includes(glow as (typeof PROFILE_GLOWS)[number]) && glow !== "none") {
    return `profile-glow-${glow}`;
  }
  return "";
}
