/**
 * Fixed catalog of purchasable Blox packs. Each `lookupKey` matches a
 * one-time Stripe Price (see createBloxPackCheckout) - the amount charged
 * always comes from Stripe itself, this file is only used to render the
 * cards and to know how many Blox a given pack credits once the webhook
 * confirms payment.
 */
export type BloxPackId = "starter" | "plus" | "pro" | "mega" | "ultimate";

export type BloxPack = {
  id: BloxPackId;
  lookupKey: string;
  blox: number;
  priceEur: number;
  bonusPercent: number;
  emoji: string;
};

export const BLOX_PACKS: BloxPack[] = [
  {
    id: "starter",
    lookupKey: "blox_starter",
    blox: 500,
    priceEur: 0.99,
    bonusPercent: 0,
    emoji: "🟢",
  },
  { id: "plus", lookupKey: "blox_plus", blox: 2800, priceEur: 4.99, bonusPercent: 12, emoji: "🔵" },
  { id: "pro", lookupKey: "blox_pro", blox: 6500, priceEur: 9.99, bonusPercent: 30, emoji: "🟣" },
  {
    id: "mega",
    lookupKey: "blox_mega",
    blox: 14000,
    priceEur: 19.99,
    bonusPercent: 40,
    emoji: "🟠",
  },
  {
    id: "ultimate",
    lookupKey: "blox_ultimate",
    blox: 32000,
    priceEur: 39.99,
    bonusPercent: 60,
    emoji: "🔥",
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
