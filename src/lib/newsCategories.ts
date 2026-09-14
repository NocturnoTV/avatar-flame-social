export type NewsCategory =
  | "updates"
  | "events"
  | "games"
  | "creators"
  | "development"
  | "community"
  | "security";

export const NEWS_CATEGORIES: { id: NewsCategory; label: string; badgeClass: string }[] = [
  { id: "updates", label: "Mises à jour", badgeClass: "bg-primary/15 text-primary" },
  { id: "events", label: "Événements", badgeClass: "bg-primary/15 text-primary" },
  { id: "games", label: "Jeux", badgeClass: "bg-emerald-500/15 text-emerald-400" },
  { id: "creators", label: "Créateurs", badgeClass: "bg-amber-500/15 text-amber-400" },
  { id: "development", label: "Développement", badgeClass: "bg-sky-500/15 text-sky-400" },
  { id: "community", label: "Communauté", badgeClass: "bg-fuchsia-500/15 text-fuchsia-400" },
  { id: "security", label: "Sécurité", badgeClass: "bg-red-500/10 text-red-400" },
];

export function newsCategoryLabel(id: string) {
  return NEWS_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function newsCategoryBadgeClass(id: string) {
  return NEWS_CATEGORIES.find((c) => c.id === id)?.badgeClass ?? "bg-surface-2 text-muted-foreground";
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
