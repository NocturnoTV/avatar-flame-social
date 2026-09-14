/**
 * Fixed catalog of purchasable Blox packs. Each `lookupKey` matches a
 * one-time Stripe Price (see createBloxPackCheckout) - the amount charged
 * always comes from Stripe itself, this file is only used to render the
 * cards and to know how many Blox a given pack credits once the webhook
 * confirms payment. Each pack also carries its own color identity per the
 * Shop design spec (Starter=cyan, Plus=blue, Pro=violet/pink, Mega=orange,
 * Ultimate=rose).
 */
export type BloxPackId = "starter" | "plus" | "pro" | "mega" | "ultimate";

export type BloxPack = {
  id: BloxPackId;
  lookupKey: string;
  blox: number;
  priceEur: number;
  bonusPercent: number;
  emoji: string;
  name: string;
  tagline: string;
  /** Tailwind gradient classes for the buy button. */
  gradient: string;
  /** Border/glow accent color (hex) for the card. */
  accent: string;
};

export const BLOX_PACKS: BloxPack[] = [
  {
    id: "starter",
    lookupKey: "blox_starter",
    blox: 500,
    priceEur: 0.99,
    bonusPercent: 0,
    emoji: "🟦",
    name: "Starter",
    tagline: "Idéal pour commencer",
    gradient: "from-[#22D3EE] to-[#3B82F6]",
    accent: "#22D3EE",
  },
  {
    id: "plus",
    lookupKey: "blox_plus",
    blox: 2800,
    priceEur: 4.99,
    bonusPercent: 12,
    emoji: "🔷",
    name: "Plus",
    tagline: "Un peu plus de possibilités",
    gradient: "from-[#3B82F6] to-[#60A5FA]",
    accent: "#3B82F6",
  },
  {
    id: "pro",
    lookupKey: "blox_pro",
    blox: 6500,
    priceEur: 9.99,
    bonusPercent: 30,
    emoji: "🟣",
    name: "Pro",
    tagline: "Le choix des créateurs",
    gradient: "from-[#8B5CF6] to-[#EC4899]",
    accent: "#A855F7",
  },
  {
    id: "mega",
    lookupKey: "blox_mega",
    blox: 14000,
    priceEur: 19.99,
    bonusPercent: 40,
    emoji: "🟠",
    name: "Mega",
    tagline: "Pour aller plus loin",
    gradient: "from-[#F59E0B] to-[#F97316]",
    accent: "#F59E0B",
  },
  {
    id: "ultimate",
    lookupKey: "blox_ultimate",
    blox: 32000,
    priceEur: 39.99,
    bonusPercent: 60,
    emoji: "🎁",
    name: "Ultimate",
    tagline: "Le pack ultime",
    gradient: "from-[#F43F5E] to-[#EC4899]",
    accent: "#F43F5E",
  },
];

/** Featured introductory-price card shown on the Blox Store to nudge a
 * badge-shopper into topping up first - a real separate Stripe price, not
 * just a decorative strikethrough. */
export const BLOX_PROMO_PACK = {
  lookupKey: "blox_pro_promo",
  blox: 6500,
  priceEur: 7.99,
  compareAtEur: 9.99,
  bonusPercent: 30,
};

export function bloxPack(id: string) {
  return BLOX_PACKS.find((p) => p.id === id);
}
