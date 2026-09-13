import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/communities/create")({
  head: () => ({ meta: [{ title: "Créer une communauté — Bloxspark" }] }),
  component: CreateCommunity,
});

const CATEGORIES = [
  { id: "games", label: "Jeux" },
  { id: "development", label: "Développement" },
  { id: "creators", label: "Créateurs" },
  { id: "roleplay", label: "Roleplay" },
  { id: "competitive", label: "Compétitif" },
  { id: "social", label: "Social" },
  { id: "building", label: "Construction" },
  { id: "community", label: "Communauté" },
  { id: "other", label: "Autre" },
];

const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
];

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
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("games");
  const [gameName, setGameName] = useState("");
  const [language, setLanguage] = useState("fr");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!user || !name.trim() || !handle.trim()) {
      toast.error("Le nom et le @handle sont requis.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("communities")
      .insert({
        name: name.trim(),
        handle: handle.trim(),
        description: description.trim() || null,
        category,
        game_name: gameName.trim() || null,
        language,
        visibility,
        rules: rules.trim() || null,
        owner_id: user.id,
      })
      .select("handle")
      .single();
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate") ? "Ce @handle est déjà pris." : errorMessage(error, "Une erreur est survenue."),
      );
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
            onChange={(e) => {
              setName(e.target.value);
              if (!handleTouched) setHandle(slugify(e.target.value));
            }}
            placeholder="Ex : Murder Mystery 2 FR"
          />
        </div>

        <div>
          <Label>@handle</Label>
          <Input
            value={handle}
            onChange={(e) => {
              setHandleTouched(true);
              setHandle(slugify(e.target.value));
            }}
            placeholder="Ex : mm2fr"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décris ta communauté..."
            rows={4}
          />
        </div>

        <div>
          <Label>Catégorie</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Jeu Roblox associé (optionnel)</Label>
          <Input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Rechercher un jeu..."
          />
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
