import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2, LoaderCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import { searchPopularRobloxGames, type RobloxGameSearchResult } from "@/lib/roblox-games.functions";

export const Route = createFileRoute("/_authenticated/communities/create")({
  head: () => ({ meta: [{ title: "Créer une communauté — Bloxspark" }] }),
  component: CreateCommunity,
});

const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
];

const DESCRIPTION_MAX = 30;
const TAG_MAX = 5;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function CreateCommunity() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [game, setGame] = useState<RobloxGameSearchResult | null>(null);
  const [gameSearch, setGameSearch] = useState("");
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [language, setLanguage] = useState("fr");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);

  const gameResults = useQuery({
    queryKey: ["community-game-search", gameSearch.trim()],
    enabled: gamePickerOpen && gameSearch.trim().length >= 2,
    queryFn: () => searchPopularRobloxGames({ data: { query: gameSearch.trim() } }),
    staleTime: 5 * 60 * 1000,
  });

  async function create() {
    if (!user || !name.trim()) {
      toast.error("Le nom est requis.");
      return;
    }
    if (!/^[A-Z0-9]{2,5}$/.test(tag)) {
      toast.error(`Le tag doit contenir 2 à ${TAG_MAX} lettres ou chiffres.`);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("communities")
      .insert({
        name: name.trim(),
        handle: slugify(tag) || slugify(name),
        tag,
        description: description.trim() || null,
        category: "community",
        game_name: game?.name ?? null,
        language,
        visibility,
        rules: rules.trim() || null,
        owner_id: user.id,
      })
      .select("handle")
      .single();
    setSaving(false);
    if (error) {
      const message = error.message.includes("communities_name_unique_idx")
        ? "Ce nom de communauté est déjà pris."
        : error.message.includes("communities_tag_unique_idx")
          ? "Ce tag est déjà pris."
          : error.message.includes("communities_handle_key")
            ? "Ce tag génère une adresse déjà utilisée, essaie un autre tag."
            : errorMessage(error, "Une erreur est survenue.");
      toast.error(message);
      return;
    }
    toast.success("Communauté créée ! 🎉");
    await navigate({ to: "/communities/$handle", params: { handle: data.handle } });
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-4">
      <header className="flex items-center gap-3">
        <Link
          to="/communities"
          aria-label="Retour"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-black">Créer une communauté</h1>
      </header>

      <div className="mt-6 space-y-5">
        <div>
          <Label>Nom de la communauté</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Murder Mystery 2 FR"
          />
        </div>

        <div>
          <Label>
            Tag ({tag.length}/{TAG_MAX})
          </Label>
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TAG_MAX))}
            placeholder="Ex : MM2FR"
            className="uppercase"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            2 à 5 lettres ou chiffres, unique — deux communautés ne peuvent pas avoir le même nom ni le même tag.
          </p>
        </div>

        <div>
          <Label>
            Description ({description.length}/{DESCRIPTION_MAX})
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            placeholder="Une phrase courte pour présenter ta communauté"
            rows={2}
            maxLength={DESCRIPTION_MAX}
          />
        </div>

        <div>
          <Label>Jeu Roblox associé</Label>
          {game ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
              {game.thumbnailUrl ? (
                <img src={game.thumbnailUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                  <Gamepad2 className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{game.name}</span>
              <button
                type="button"
                onClick={() => setGame(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setGamePickerOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-2xl border border-input bg-background/75 px-4 py-3 text-left text-sm transition hover:border-primary"
              >
                <span className="flex items-center gap-2 font-semibold text-muted-foreground">
                  <Search className="h-4 w-4 text-primary" /> Rechercher un jeu...
                </span>
              </button>
              {gamePickerOpen ? (
                <div className="mt-2 overflow-hidden rounded-2xl border border-primary/30 bg-popover shadow-xl">
                  <div className="flex items-center gap-2 border-b border-border px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={gameSearch}
                      onChange={(e) => setGameSearch(e.target.value)}
                      placeholder="Brookhaven, Adopt Me, Blox Fruits…"
                      className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                    {gameResults.isFetching ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                    ) : null}
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {gameSearch.trim().length < 2 ? (
                      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                        Tape au moins 2 lettres pour chercher un jeu.
                      </p>
                    ) : null}
                    {(gameResults.data ?? []).map((g) => (
                      <button
                        key={g.universeId}
                        type="button"
                        onClick={() => {
                          setGame(g);
                          setGamePickerOpen(false);
                          setGameSearch("");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-primary/10"
                      >
                        {g.thumbnailUrl ? (
                          <img src={g.thumbnailUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                        ) : (
                          <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2">
                            <Gamepad2 className="h-4 w-4" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{g.name}</span>
                      </button>
                    ))}
                    {gameResults.isSuccess && !gameResults.data.length ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">Aucun jeu trouvé.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div>
          <Label>Langue</Label>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Visibilité</Label>
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}>
            <option value="public">Publique — tout le monde peut trouver et rejoindre</option>
            <option value="private">Privée — visible mais nécessite une approbation</option>
          </Select>
        </div>

        <div>
          <Label>Règles (recommandé)</Label>
          <Textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder={"1. Respectez les autres membres\n2. Pas de spam\n3. Pas de harcèlement"}
            rows={4}
          />
        </div>

        <Button className="w-full" disabled={saving} onClick={() => void create()}>
          {saving ? "Création..." : "Créer la communauté"}
        </Button>
      </div>
    </div>
  );
}
