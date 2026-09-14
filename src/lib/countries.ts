/**
 * Country picker for the Sparks profile: a fixed list of ISO-3166 alpha-2
 * codes rendered with the flag emoji trick (regional indicator symbols) and
 * localized names via the built-in Intl.DisplayNames - no manual translation
 * table needed.
 */
export const COUNTRY_CODES = [
  "FR", "US", "GB", "CA", "BE", "CH", "LU", "MC",
  "DE", "AT", "NL", "ES", "PT", "IT", "IE", "SE",
  "NO", "DK", "FI", "PL", "CZ", "RO", "HU", "GR",
  "BR", "MX", "AR", "CL", "CO", "PE",
  "KR", "JP", "CN", "IN", "PH", "ID", "VN", "TH",
  "AU", "NZ", "ZA", "MA", "DZ", "TN",
  "TR", "RU", "UA",
] as const;

export function countryFlagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌍";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌍";
  return upper.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function countryName(code: string | null | undefined, locale: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
