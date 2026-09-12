import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export type AppRole = "admin" | "moderator" | "user";

/** Rôles du membre connecté, lus côté serveur (jamais stockés dans le navigateur). */
export function useRoles() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = query.data ?? [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("admin") || roles.includes("moderator"),
    loading: query.isLoading,
  };
}
