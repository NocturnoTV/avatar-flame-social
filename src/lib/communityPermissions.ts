export type CommunityPermission =
  | "manage_community"
  | "manage_channels"
  | "manage_roles"
  | "manage_members"
  | "view_audit_log"
  | "manage_affiliates";

export const COMMUNITY_PERMISSIONS: { id: CommunityPermission; label: string; hint: string }[] = [
  {
    id: "manage_community",
    label: "Gérer la communauté",
    hint: "Icône, bannière, description, tag, jeux, visibilité.",
  },
  {
    id: "manage_channels",
    label: "Gérer les salons",
    hint: "Créer, renommer, déplacer, supprimer des salons et catégories.",
  },
  {
    id: "manage_roles",
    label: "Gérer les rôles",
    hint: "Créer des rôles et les attribuer aux membres.",
  },
  {
    id: "manage_members",
    label: "Gérer les membres",
    hint: "Exclure, bannir, voir les profils Roblox.",
  },
  {
    id: "view_audit_log",
    label: "Voir les logs",
    hint: "Historique des actions de modération.",
  },
  {
    id: "manage_affiliates",
    label: "Gérer les communautés affiliées",
    hint: "Ajouter ou retirer des communautés partenaires.",
  },
];
