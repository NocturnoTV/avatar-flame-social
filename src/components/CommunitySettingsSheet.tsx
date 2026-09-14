import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Crown, Search, Shield, Trash2, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StoredImage } from "@/components/Media";
import { Button, Input, Sheet, Textarea } from "@/components/ui-kit";
import { COMMUNITY_PERMISSIONS, type CommunityPermission } from "@/lib/communityPermissions";
import { uploadFile } from "@/lib/media";
import { useSession } from "@/lib/session";
import { cn, errorMessage } from "@/lib/utils";

type SettingsTab = "profile" | "channels" | "roles" | "members" | "affiliates" | "logs";

const SETTINGS_TABS: { id: SettingsTab; label: string; perm: CommunityPermission | null }[] = [
  { id: "profile", label: "Profil", perm: "manage_community" },
  { id: "channels", label: "Salons", perm: "manage_channels" },
  { id: "roles", label: "Rôles", perm: "manage_roles" },
  { id: "members", label: "Membres", perm: "manage_members" },
  { id: "affiliates", label: "Affiliés", perm: "manage_affiliates" },
  { id: "logs", label: "Logs", perm: "view_audit_log" },
];

export function CommunitySettingsSheet({
  open,
  onClose,
  communityId,
  isOwner,
  can,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  isOwner: boolean;
  can: (perm: CommunityPermission) => boolean;
}) {
  const availableTabs = SETTINGS_TABS.filter((t) => !t.perm || can(t.perm));
  const [tab, setTab] = useState<SettingsTab>(availableTabs[0]?.id ?? "profile");

  return (
    <Sheet open={open} onClose={onClose} title="Paramètres de la communauté">
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
        {availableTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition",
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-h-[65vh] overflow-y-auto">
        {tab === "profile" ? <ProfileSettings communityId={communityId} /> : null}
        {tab === "channels" ? <ChannelsSettings communityId={communityId} /> : null}
        {tab === "roles" ? <RolesSettings communityId={communityId} /> : null}
        {tab === "members" ? (
          <MembersSettings communityId={communityId} isOwner={isOwner} onClose={onClose} />
        ) : null}
        {tab === "affiliates" ? <AffiliatesSettings communityId={communityId} /> : null}
        {tab === "logs" ? <LogsSettings communityId={communityId} /> : null}
      </div>
    </Sheet>
  );
}

// ---------- Profile ----------
function ProfileSettings({ communityId }: { communityId: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [gameName, setGameName] = useState("");

  const community = useQuery({
    queryKey: ["community-settings-profile", communityId],
    queryFn: async () => {
      const { data } = await supabase.from("communities").select("*").eq("id", communityId).maybeSingle();
      return data;
    },
  });

  const games = useQuery({
    queryKey: ["community-settings-games", communityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_games")
        .select("id,name,thumbnail_url")
        .eq("community_id", communityId)
        .order("position");
      return data ?? [];
    },
  });

  const c = community.data ? { ...community.data, ...draft } : community.data;
  const dirty = Object.keys(draft).length > 0;

  function patch(values: Record<string, unknown>) {
    setDraft((d) => ({ ...d, ...values }));
  }

  async function save() {
    const { error } = await supabase.from("communities").update(draft as never).eq("id", communityId);
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setDraft({});
    toast.success("Enregistré.");
    void community.refetch();
    void qc.invalidateQueries({ queryKey: ["community"] });
  }

  async function uploadImage(kind: "icon_url" | "banner_url", file: File) {
    if (!user) return;
    try {
      const path = await uploadFile("community-media", user.id, file, file.name.split(".").pop() ?? "jpg");
      patch({ [kind]: path });
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  async function addGame() {
    if (!gameName.trim() || games.data!.length >= 5) return;
    const { error } = await supabase.rpc("community_add_game", {
      _community: communityId,
      _name: gameName.trim(),
      _universe_id: null,
      _thumbnail: null,
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setGameName("");
    void games.refetch();
  }

  async function removeGame(id: string) {
    await supabase.rpc("community_remove_game", { _game: id });
    void games.refetch();
  }

  if (!c) return null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div>
          <p className="mb-1 text-xs font-bold text-muted-foreground">Icône</p>
          <label className="block h-16 w-16 cursor-pointer overflow-hidden rounded-2xl border border-border">
            <StoredImage path={c.icon_url} alt="" className="h-full w-full object-cover" fallback="🎮" />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage("icon_url", f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="flex-1">
          <p className="mb-1 text-xs font-bold text-muted-foreground">Bannière</p>
          <label className="block h-16 cursor-pointer overflow-hidden rounded-2xl border border-border">
            <StoredImage path={c.banner_url} alt="" className="h-full w-full object-cover" fallback="🖼️" />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage("banner_url", f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold text-muted-foreground">Nom</p>
        <Input defaultValue={c.name} onBlur={(e) => patch({ name: e.target.value.trim() })} />
      </div>
      <div>
        <p className="mb-1 text-xs font-bold text-muted-foreground">Tag (2-5 caractères)</p>
        <Input
          defaultValue={c.tag}
          maxLength={5}
          onBlur={(e) => patch({ tag: e.target.value.trim().toUpperCase() })}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-bold text-muted-foreground">Description</p>
        <Textarea
          defaultValue={c.description ?? ""}
          maxLength={300}
          rows={3}
          onBlur={(e) => patch({ description: e.target.value })}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-bold text-muted-foreground">Visibilité</p>
        <select
          value={c.visibility}
          onChange={(e) => patch({ visibility: e.target.value })}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="public">Publique</option>
          <option value="private_request">Privée — sur demande</option>
          <option value="private_friends">Privée — amis seulement</option>
        </select>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold text-muted-foreground">
          Jeux Roblox associés ({games.data?.length ?? 0}/5)
        </p>
        <div className="space-y-1.5">
          {(games.data ?? []).map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <button onClick={() => void removeGame(g.id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        {(games.data?.length ?? 0) < 5 ? (
          <div className="mt-1.5 flex gap-2">
            <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Nom du jeu" />
            <Button size="sm" onClick={() => void addGame()} disabled={!gameName.trim()}>
              Ajouter
            </Button>
          </div>
        ) : null}
      </div>

      <Button className="w-full" disabled={!dirty} onClick={() => void save()}>
        Enregistrer
      </Button>
    </div>
  );
}

// ---------- Channels & categories ----------
function ChannelsSettings({ communityId }: { communityId: string }) {
  const [newCategory, setNewCategory] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [targetCategory, setTargetCategory] = useState<string>("");

  const categories = useQuery({
    queryKey: ["community-categories", communityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_channel_categories")
        .select("id,name,position")
        .eq("community_id", communityId)
        .order("position");
      return data ?? [];
    },
  });

  const channels = useQuery({
    queryKey: ["community-channels", communityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_channels")
        .select("id,category_id,name,position,is_default")
        .eq("community_id", communityId)
        .order("position");
      return data ?? [];
    },
  });

  async function addCategory() {
    if (!newCategory.trim()) return;
    const { error } = await supabase.rpc("community_create_category", {
      _community: communityId,
      _name: newCategory.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setNewCategory("");
    void categories.refetch();
  }

  async function removeCategory(id: string) {
    await supabase.rpc("community_delete_category", { _category: id });
    void categories.refetch();
    void channels.refetch();
  }

  async function addChannel() {
    if (!newChannel.trim()) return;
    const { error } = await supabase.rpc("community_create_channel", {
      _community: communityId,
      _category: targetCategory || null,
      _name: newChannel.trim(),
    });
    if (error) {
      toast.error(errorMessage(error, "Une erreur est survenue."));
      return;
    }
    setNewChannel("");
    void channels.refetch();
  }

  async function renameChannel(id: string, name: string) {
    await supabase.rpc("community_rename_channel", { _channel: id, _name: name });
    void channels.refetch();
  }

  async function removeChannel(id: string) {
    const { error } = await supabase.rpc("community_delete_channel", { _channel: id });
    if (error) toast.error(errorMessage(error, "Impossible de supprimer ce salon."));
    void channels.refetch();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Salons</p>
        <div className="space-y-1.5">
          {(channels.data ?? []).map((ch) => (
            <div key={ch.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5">
              <input
                defaultValue={ch.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== ch.name) void renameChannel(ch.id, e.target.value.trim());
                }}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {ch.is_default ? (
                <span className="shrink-0 text-[10px] font-bold text-muted-foreground">Par défaut</span>
              ) : (
                <button onClick={() => void removeChannel(ch.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={targetCategory}
            onChange={(e) => setTargetCategory(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-2 text-xs"
          >
            <option value="">Sans catégorie</option>
            {(categories.data ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <Input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="nom-du-salon" />
          <Button size="sm" onClick={() => void addChannel()} disabled={!newChannel.trim()}>
            +
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Catégories</p>
        <div className="space-y-1.5">
          {(categories.data ?? []).map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{cat.name}</span>
              <button onClick={() => void removeCategory(cat.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nom de la catégorie" />
          <Button size="sm" onClick={() => void addCategory()} disabled={!newCategory.trim()}>
            +
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Roles ----------
function RolesSettings({ communityId }: { communityId: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#A855F7");
  const [perms, setPerms] = useState<Set<CommunityPermission>>(new Set());

  const roles = useQuery({
    queryKey: ["community-roles-settings", communityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_roles")
        .select("id,name,color,permissions,is_default")
        .eq("community_id", communityId)
        .order("position");
      return data ?? [];
    },
  });

  function startEdit(role?: (typeof roles.data extends (infer T)[] | undefined ? T : never)) {
    if (role) {
      setEditing(role.id);
      setName(role.name);
      setColor(role.color);
      setPerms(new Set(role.permissions as CommunityPermission[]));
    } else {
      setEditing("new");
      setName("");
      setColor("#A855F7");
      setPerms(new Set());
    }
  }

  function togglePerm(p: CommunityPermission) {
    setPerms((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function save() {
    if (!name.trim()) return;
    if (editing === "new") {
      const { error } = await supabase.rpc("community_create_role", {
        _community: communityId,
        _name: name.trim(),
        _color: color,
        _permissions: [...perms],
      });
      if (error) {
        toast.error(error.message.includes("role_limit_reached") ? "Limite de rôles atteinte." : errorMessage(error, "Une erreur est survenue."));
        return;
      }
    } else if (editing) {
      const { error } = await supabase.rpc("community_update_role", {
        _role: editing,
        _name: name.trim(),
        _color: color,
        _permissions: [...perms],
      });
      if (error) {
        toast.error(errorMessage(error, "Une erreur est survenue."));
        return;
      }
    }
    setEditing(null);
    void roles.refetch();
  }

  async function removeRole(id: string) {
    const { error } = await supabase.rpc("community_delete_role", { _role: id });
    if (error) toast.error(errorMessage(error, "Impossible de supprimer ce rôle."));
    void roles.refetch();
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du rôle" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Couleur</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded" />
        </div>
        <div className="space-y-2">
          {COMMUNITY_PERMISSIONS.map((p) => (
            <label key={p.id} className="flex items-start gap-2 rounded-xl bg-surface p-2.5 text-sm">
              <input
                type="checkbox"
                checked={perms.has(p.id)}
                onChange={() => togglePerm(p.id)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void save()} disabled={!name.trim()}>
            Enregistrer
          </Button>
          <Button variant="outline" onClick={() => setEditing(null)}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(roles.data ?? []).map((role) => (
        <div key={role.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: role.color }} />
          <button onClick={() => startEdit(role)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
            {role.name}
          </button>
          {!role.is_default ? (
            <button onClick={() => void removeRole(role.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      <Button size="sm" className="w-full" onClick={() => startEdit()}>
        + Nouveau rôle
      </Button>
    </div>
  );
}

// ---------- Members ----------
function MembersSettings({
  communityId,
  isOwner,
  onClose,
}: {
  communityId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [managingId, setManagingId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["community-members-settings", communityId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_members")
        .select("user_id,role,joined_at")
        .eq("community_id", communityId)
        .order("joined_at");
      const ids = (rows ?? []).map((r) => r.user_id);
      const [{ data: people }, { data: memberRoles }, { data: roles }] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id,username,avatar_url,roblox_username").in("id", ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase.from("community_member_roles").select("user_id,role_id").eq("community_id", communityId)
          : Promise.resolve({ data: [] }),
        supabase.from("community_roles").select("id,name,color").eq("community_id", communityId),
      ]);
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({
        ...r,
        person: peopleById.get(r.user_id),
        roleIds: (memberRoles ?? []).filter((mr) => mr.user_id === r.user_id).map((mr) => mr.role_id),
        allRoles: roles ?? [],
      }));
    },
  });

  const filtered = (members.data ?? []).filter((m) =>
    (m.person?.username ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  async function toggleRole(targetId: string, roleId: string, has: boolean) {
    if (has) {
      await supabase.rpc("community_unassign_role", { _community: communityId, _target: targetId, _role: roleId });
    } else {
      await supabase.rpc("community_assign_role", { _community: communityId, _target: targetId, _role: roleId });
    }
    void members.refetch();
  }

  async function kick(targetId: string) {
    const { error } = await supabase.rpc("community_kick_member", { _community: communityId, _target: targetId });
    if (error) toast.error(errorMessage(error, "Une erreur est survenue."));
    else toast.success("Membre exclu.");
    void members.refetch();
  }

  async function ban(targetId: string) {
    const { error } = await supabase.rpc("community_ban_member", {
      _community: communityId,
      _target: targetId,
      _reason: banReason.trim() || null,
    });
    if (error) toast.error(errorMessage(error, "Une erreur est survenue."));
    else toast.success("Membre banni.");
    setBanReason("");
    setManagingId(null);
    void members.refetch();
  }

  async function transferOwnership() {
    if (!user?.email || !transferTarget) return;
    setBusyTransfer(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: transferPassword,
      });
      if (authError) throw new Error("Mot de passe incorrect.");
      const { error } = await supabase.rpc("community_transfer_ownership", {
        _community: communityId,
        _new_owner: transferTarget,
      });
      if (error) throw error;
      toast.success("Propriété transférée.");
      setTransferTarget(null);
      setTransferPassword("");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Une erreur est survenue."));
    } finally {
      setBusyTransfer(false);
    }
  }
  const [busyTransfer, setBusyTransfer] = useState(false);

  if (transferTarget) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Confirme ton mot de passe pour transférer la propriété de la communauté.
        </p>
        <Input
          type="password"
          value={transferPassword}
          onChange={(e) => setTransferPassword(e.target.value)}
          placeholder="Mot de passe"
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void transferOwnership()} disabled={!transferPassword || busyTransfer}>
            {busyTransfer ? "..." : "Confirmer le transfert"}
          </Button>
          <Button variant="outline" onClick={() => setTransferTarget(null)}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre..."
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
        />
      </div>
      <div className="space-y-2">
        {filtered.map((m) => (
          <div key={m.user_id} className="rounded-2xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <StoredImage
                path={m.person?.avatar_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                fallback="🎮"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                  {m.person?.username ?? "?"}
                  {m.role === "owner" ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Membre depuis le {new Date(m.joined_at).toLocaleDateString("fr-FR")}
                  {m.person?.roblox_username ? ` · Roblox: ${m.person.roblox_username}` : ""}
                </p>
              </div>
              <button
                onClick={() => setManagingId((cur) => (cur === m.user_id ? null : m.user_id))}
                aria-label="Gérer"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
              >
                <Shield className="h-4 w-4" />
              </button>
            </div>

            {managingId === m.user_id ? (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {m.allRoles
                    .filter((r) => r.name !== "@everyone")
                    .map((r) => {
                      const has = m.roleIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          onClick={() => void toggleRole(m.user_id, r.id, has)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                            has ? "border-transparent text-white" : "border-border text-muted-foreground",
                          )}
                          style={has ? { background: r.color } : undefined}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                </div>
                {m.role !== "owner" ? (
                  <>
                    <Input
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Raison du bannissement (optionnel)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void kick(m.user_id)}>
                        <UserMinus className="h-3.5 w-3.5" /> Exclure
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void ban(m.user_id)}>
                        <Ban className="h-3.5 w-3.5" /> Bannir
                      </Button>
                      {isOwner ? (
                        <Button size="sm" variant="outline" onClick={() => setTransferTarget(m.user_id)}>
                          <Crown className="h-3.5 w-3.5" /> Transférer la propriété
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Affiliates ----------
function AffiliatesSettings({ communityId }: { communityId: string }) {
  const [search, setSearch] = useState("");

  const affiliates = useQuery({
    queryKey: ["community-affiliates-settings", communityId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_affiliates")
        .select("affiliate_id")
        .eq("community_id", communityId);
      const ids = (rows ?? []).map((r) => r.affiliate_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("communities").select("id,handle,name,icon_url").in("id", ids);
      return data ?? [];
    },
  });

  const results = useQuery({
    queryKey: ["community-affiliate-search", search.trim()],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("communities")
        .select("id,handle,name,icon_url")
        .ilike("name", `%${search.trim()}%`)
        .neq("id", communityId)
        .limit(10);
      return data ?? [];
    },
  });

  async function add(id: string) {
    const { error } = await supabase.rpc("community_add_affiliate", { _community: communityId, _affiliate: id });
    if (error) {
      toast.error(
        error.message.includes("affiliate_limit_reached") ? "Limite de communautés affiliées atteinte." : errorMessage(error, "Une erreur est survenue."),
      );
      return;
    }
    setSearch("");
    void affiliates.refetch();
  }

  async function remove(id: string) {
    await supabase.rpc("community_remove_affiliate", { _community: communityId, _affiliate: id });
    void affiliates.refetch();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
          Communautés affiliées ({affiliates.data?.length ?? 0})
        </p>
        <div className="space-y-1.5">
          {(affiliates.data ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5">
              <StoredImage path={a.icon_url} alt="" className="h-6 w-6 rounded" fallback="🎮" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
              <button onClick={() => void remove(a.id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {!affiliates.data?.length ? (
            <p className="text-xs text-muted-foreground">Aucune communauté affiliée.</p>
          ) : null}
        </div>
      </div>
      <div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher une communauté à ajouter..." />
        <div className="mt-2 space-y-1.5">
          {(results.data ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => void add(r.id)}
              className="flex w-full items-center gap-2 rounded-xl bg-surface px-3 py-1.5 text-left hover:bg-surface-2"
            >
              <StoredImage path={r.icon_url} alt="" className="h-6 w-6 rounded" fallback="🎮" />
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Logs ----------
function LogsSettings({ communityId }: { communityId: string }) {
  const logs = useQuery({
    queryKey: ["community-audit-log", communityId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("community_audit_log")
        .select("id,actor_id,action,target_user_id,details,created_at")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = [...new Set((rows ?? []).flatMap((r) => [r.actor_id, r.target_user_id]).filter(Boolean))] as string[];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id,username").in("id", ids)
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.id, p.username]));
      return (rows ?? []).map((r) => ({
        ...r,
        actorName: r.actor_id ? (byId.get(r.actor_id) ?? "?") : "Système",
        targetName: r.target_user_id ? byId.get(r.target_user_id) : null,
      }));
    },
  });

  const ACTION_LABELS: Record<string, string> = {
    create_channel: "a créé le salon",
    rename_channel: "a renommé un salon",
    delete_channel: "a supprimé un salon",
    create_role: "a créé le rôle",
    update_role: "a modifié le rôle",
    assign_role: "a attribué un rôle à",
    unassign_role: "a retiré un rôle à",
    kick: "a exclu",
    ban: "a banni",
    unban: "a débanni",
    transfer_ownership: "a transféré la propriété à",
  };

  return (
    <div className="space-y-2">
      {!logs.data?.length ? <p className="text-xs text-muted-foreground">Aucune activité pour l'instant.</p> : null}
      {(logs.data ?? []).map((log) => (
        <div key={log.id} className="rounded-xl bg-surface px-3 py-2 text-xs">
          <p>
            <span className="font-bold">{log.actorName}</span> {ACTION_LABELS[log.action] ?? log.action}{" "}
            {log.targetName ? <span className="font-bold">{log.targetName}</span> : null}
            {log.details ? ` "${log.details}"` : ""}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {new Date(log.created_at).toLocaleString("fr-FR")}
          </p>
        </div>
      ))}
    </div>
  );
}
